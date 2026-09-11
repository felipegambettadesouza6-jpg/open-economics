import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getOfficialDataset } from "@/lib/catalog/official-datasets";
import { routeV2Get } from "@/lib/api/v2";
import { semanticSearch } from "@/lib/semantic/search";

type UnknownRecord = Record<string, unknown>;

const MODEL_TEXT_ROW_LIMIT = 12;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactForText(
  value: unknown,
  limits: { array: number; fields: number; depth: number; string: number },
  depth = 0,
): unknown {
  if (typeof value === "string") {
    return value.length <= limits.string ? value : `${value.slice(0, limits.string)}… [${value.length - limits.string} characters omitted]`;
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= limits.depth) {
    if (Array.isArray(value)) return `[${value.length} items; nested values omitted from text]`;
    if (isRecord(value)) return `{${Object.keys(value).length} fields; nested values omitted from text}`;
    return String(value);
  }
  if (Array.isArray(value)) {
    const visible = value.slice(0, limits.array).map((item) => compactForText(item, limits, depth + 1));
    if (value.length > limits.array) visible.push({ omittedItems: value.length - limits.array });
    return visible;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    const compact: UnknownRecord = {};
    for (const [key, item] of entries.slice(0, limits.fields)) compact[key] = compactForText(item, limits, depth + 1);
    if (entries.length > limits.fields) compact.omittedFields = entries.length - limits.fields;
    return compact;
  }
  return String(value);
}

function stringifyForText(value: unknown, budget: number) {
  const candidates = [
    { array: 12, fields: 24, depth: 5, string: 800 },
    { array: 6, fields: 16, depth: 4, string: 400 },
    { array: 3, fields: 10, depth: 3, string: 240 },
    { array: 1, fields: 6, depth: 2, string: 160 },
  ];
  for (const limits of candidates) {
    const text = JSON.stringify(compactForText(value, limits), null, 2);
    if (text.length <= budget) return text;
  }
  return JSON.stringify({ note: "Additional nested fields are available in result.structuredContent." }, null, 2);
}

function modelVisibleResult(value: unknown, summary: string) {
  if (!isRecord(value)) return `${summary}\n\nResult:\n${stringifyForText(value, 8_000)}`;

  const meta = isRecord(value.meta) ? value.meta : undefined;
  const dataset = meta && isRecord(meta.dataset)
    ? meta.dataset
    : typeof value.id === "string" && (typeof value.sourceAgency === "string" || typeof value.sourceUrl === "string")
      ? value
      : undefined;
  const provenance = meta && isRecord(meta.provenance) ? meta.provenance : undefined;
  const sourceUrl = dataset && typeof dataset.sourceUrl === "string"
    ? dataset.sourceUrl
    : provenance && typeof provenance.source_url === "string"
      ? provenance.source_url
      : provenance && typeof provenance.publication_url === "string"
        ? provenance.publication_url
        : undefined;

  const lines = [summary];
  if (dataset) {
    const identity = [dataset.id, dataset.title].filter((item): item is string => typeof item === "string");
    const agency = typeof dataset.sourceAgency === "string" ? ` (${dataset.sourceAgency})` : "";
    if (identity.length > 0) lines.push(`Dataset: ${identity.join(" — ")}${agency}`);
  }
  if (sourceUrl) lines.push(`Official source: ${sourceUrl}`);

  if (Array.isArray(value.data)) {
    const visibleData = value.data.slice(0, MODEL_TEXT_ROW_LIMIT);
    const available = meta && typeof meta.available === "number" ? `; ${meta.available} available from the selected source/query` : "";
    const queryTruncated = meta && typeof meta.truncated === "boolean" ? `; query truncated: ${meta.truncated}` : "";
    lines.push(`Data shown in text: ${visibleData.length} of ${value.data.length} returned row(s)${available}${queryTruncated}.`);
    lines.push(`Data:\n${stringifyForText(visibleData, 8_000)}`);
    if (meta) {
      const textMeta: UnknownRecord = {};
      for (const key of ["selection", "schema", "table", "source_snapshot", "provenance", "date_semantics", "value_semantics", "returned", "available", "truncated"]) {
        if (key in meta) textMeta[key] = meta[key];
      }
      lines.push(`Metadata:\n${stringifyForText(textMeta, 5_000)}`);
    }
    lines.push(`Full machine-readable result: result.structuredContent contains all ${value.data.length} returned row(s).`);
  } else if ("data" in value) {
    lines.push(`Data and metadata:\n${stringifyForText(value, 11_000)}`);
    lines.push("Full machine-readable result: result.structuredContent contains the complete result.");
  } else {
    lines.push(`Result:\n${stringifyForText(value, 11_000)}`);
    lines.push("Full machine-readable result: result.structuredContent contains the complete result.");
  }

  return lines.join("\n\n");
}

function result(value: unknown, summary: string) {
  return {
    content: [{ type: "text" as const, text: modelVisibleResult(value, summary) }],
    structuredContent: value as Record<string, unknown>,
  };
}

// The payloads intentionally retain source-defined fields, but their stable
// envelopes are explicit so MCP clients can render and validate useful output
// without changing the REST-aligned response contracts.
const searchOutputSchema = z.looseObject({
  query: z.string().describe("The original natural-language economic need."),
  normalizedQuery: z.string().describe("Normalized form used for semantic resolution."),
  resolution: z.looseObject({
    status: z.string().describe("Resolution state for the requested concept."),
    confidence: z.number().optional().describe("Resolution confidence from 0 to 1."),
    explanation: z.string().describe("Why the concept was or was not resolved."),
  }).describe("Concept-resolution result."),
  concepts: z.array(z.looseObject({ id: z.string().describe("Stable Open Economics concept ID.") })).describe("Ranked economic concepts matched to the request."),
  datasets: z.array(z.looseObject({
    id: z.string().describe("Stable official dataset ID."),
    provider: z.string().describe("Open Economics provider identifier."),
    sourceAgency: z.string().describe("Official publishing agency."),
    title: z.string().describe("Official dataset title."),
    sourceUrl: z.string().describe("Official source URL."),
    metadataUrl: z.string().describe("Official metadata URL."),
  })).describe("Ranked official datasets and their source identity."),
  availability: z.looseObject({
    status: z.string().describe("Availability state in the current Open Economics coverage."),
    complete: z.boolean().describe("Whether the requested need is completely covered."),
    explanation: z.string().describe("Coverage explanation."),
    missingSources: z.array(z.string()).describe("Required source integrations that are not present."),
  }).describe("Coverage assessment."),
}).describe("Semantic discovery result with ranked concepts, official datasets, and coverage state.");

const datasetOutputSchema = z.looseObject({
  id: z.string().describe("Stable official dataset ID."),
  provider: z.string().describe("Open Economics provider identifier."),
  sourceAgency: z.string().describe("Official publishing agency."),
  title: z.string().describe("Official dataset title."),
  collection: z.string().nullable().optional().describe("Official collection identifier, when supplied by the publisher."),
  collectionName: z.string().nullable().optional().describe("Official collection name, when supplied by the publisher."),
  sourceUrl: z.string().describe("Official source URL."),
  metadataUrl: z.string().describe("Official metadata URL."),
  queryCapability: z.string().describe("Supported query capability."),
}).describe("Official dataset identity, source, provenance, and query capability.");

const v2OutputSchema = z.looseObject({
  data: z.unknown().describe("Source-preserving data or schema payload for the selected official dataset."),
  meta: z.looseObject({
    dataset: z.unknown().optional().describe("Open Economics dataset identity when supplied."),
    provenance: z.unknown().optional().describe("Upstream source URLs, versions, timestamps, and methodology details."),
  }).describe("Response metadata and source provenance."),
  links: z.looseObject({
    self: z.string().optional().describe("Canonical URL for this response."),
    observations: z.string().optional().describe("Canonical observations endpoint for this dataset."),
  }).optional().describe("Related API links."),
}).describe("REST-aligned Open Economics response with data, metadata, links, and source provenance.");

async function v2(path: string, parameters: Record<string, string | number | undefined> = {}) {
  const url = new URL(path, "https://open-economics.local");
  for (const [key, value] of Object.entries(parameters)) if (value !== undefined) url.searchParams.set(key, String(value));
  const response = await routeV2Get(new Request(url));
  if (!response) throw new Error(`Unknown Open Economics route: ${url.pathname}`);
  return response.body;
}

function buildServer() {
  const server = new McpServer(
    {
      name: "open-economics",
      title: "Open Economics",
      version: "2.0.2",
      description: "Free, read-only access to official Brazilian economic data through semantic discovery, REST-aligned MCP tools, and source-preserving results.",
      websiteUrl: "https://open-economics-data.knbf982hkn.chatgpt.site/en",
      icons: [{ src: "https://raw.githubusercontent.com/felipegambettadesouza6-jpg/open-economics/main/public/open-economics-icon-400.png", mimeType: "image/png", sizes: ["400x400"] }],
    },
    { capabilities: { tools: {} }, instructions: "Resolve the user's economic need with search_official_data before selecting data. Never substitute a nearby series for an unsupported need. Preserve units, reference periods, dimensions, source identifiers, source URLs, and retrieval times in answers." },
  );

  server.registerTool(
    "search_official_data",
    {
      title: "Search Brazilian official economic data",
      description: "Start here for a natural-language Brazilian economic-information need in Portuguese or English. Resolves the economic concept independently of current coverage, returns ranked official datasets, stable-series shortcuts, confidence, missing source integrations, and an explicit unresolved/partial state. Use this before any data query when the exact official dataset ID is unknown.",
      inputSchema: z.object({
        query: z.string().min(2).max(300).describe("The user's complete economic-data need, including measure, geography, period, and breakdown when known."),
        limit: z.number().int().min(1).max(25).default(10).describe("Maximum official dataset candidates to return."),
      }),
      outputSchema: searchOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      const search = semanticSearch(query, limit);
      const summary = search.resolution.status === "resolved"
        ? `Resolved to ${search.concepts.map((concept) => concept.id).join(", ")}; availability: ${search.availability.status}.`
        : `${search.resolution.status}: ${search.resolution.explanation}`;
      return result(search, summary);
    },
  );

  server.registerTool(
    "describe_official_dataset",
    {
      title: "Describe an official dataset",
      description: "Get identity, publisher, collection, provenance links, query capability, and any stable Open Economics series shortcuts for an exact dataset ID returned by search_official_data. This does not fetch observations.",
      inputSchema: z.object({ dataset_id: z.string().regex(/^(?:(?:bcb-sgs|ibge-aggregates):\d+|siconfi:(?:rreo|rgf|dca|entes)|tesouro-rtn:government-central|tesouro-dpf:debt-profile|comexstat:general|anp:fuel-prices|epe:electricity-consumption|mte:formal-employment|cvm:investment-funds)$/).describe("Exact ID returned by search_official_data, such as bcb-sgs:432, ibge-aggregates:5932, siconfi:dca, tesouro-rtn:government-central, tesouro-dpf:debt-profile, comexstat:general, anp:fuel-prices, epe:electricity-consumption, mte:formal-employment, or cvm:investment-funds.") }),
      outputSchema: datasetOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id }) => {
      const dataset = getOfficialDataset(dataset_id);
      if (!dataset) throw new Error(`Official dataset not found: ${dataset_id}`);
      return result(dataset, `${dataset.title} — ${dataset.sourceAgency}; capability: ${dataset.queryCapability}.`);
    },
  );

  server.registerTool(
    "get_bcb_series",
    {
      title: "Get observations from a BCB SGS series",
      description: "Retrieve official observations and authoritative schema metadata for an exact BCB SGS dataset ID. Use only after search_official_data identifies the series. Dates, units, periodicity, source, and raw values are preserved; generic access does not guess transformations.",
      inputSchema: z.object({
        dataset_id: z.string().regex(/^bcb-sgs:\d+$/).describe("Exact BCB dataset ID returned by search_official_data."),
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive start date; defaults to three years ago."),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive end date; defaults to today."),
        order: z.enum(["asc", "desc"]).default("asc").describe("Observation order by date."),
        limit: z.number().int().min(1).max(5000).default(5000).describe("Maximum number of observations to return."),
      }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ dataset_id, start, end, order, limit }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/observations`, { start, end, order, limit });
      return result(value, `Retrieved official BCB observations for ${dataset_id}. Preserve the provenance and date-semantics fields when answering.`);
    },
  );

  server.registerTool(
    "get_bcb_schema",
    {
      title: "Inspect BCB series meaning and units",
      description: "Fetch authoritative metadata for an exact BCB SGS series, including full name, subject hierarchy, periodicity, unit, source, coverage dates, decimals, formula, and warnings. Use when interpreting a BCB series without retrieving observations.",
      inputSchema: z.object({ dataset_id: z.string().regex(/^bcb-sgs:\d+$/).describe("Exact BCB dataset ID returned by search_official_data.") }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ dataset_id }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/schema`);
      return result(value, `Retrieved authoritative BCB meaning, unit, frequency, coverage, and source metadata for ${dataset_id}.`);
    },
  );

  server.registerTool(
    "get_ibge_schema",
    {
      title: "Inspect an IBGE aggregate's measures and dimensions",
      description: "Fetch official metadata for an IBGE aggregate selected by search_official_data. Always use this before get_ibge_data unless the official variable, locality, and classification IDs are already known. It prevents guessing a measure or dimensional slice.",
      inputSchema: z.object({ dataset_id: z.string().regex(/^ibge-aggregates:\d+$/).describe("Exact IBGE aggregate ID returned by search_official_data.") }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ dataset_id }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/schema`);
      return result(value, `Retrieved the official IBGE schema for ${dataset_id}. Select explicit variable and dimension IDs before requesting data.`);
    },
  );

  server.registerTool(
    "get_ibge_data",
    {
      title: "Query multidimensional IBGE data",
      description: "Retrieve an explicit slice of an IBGE aggregate after inspecting its schema. Returns variables containing classification selections, geographies, and observations; official suppression, missing, quality-flag, and zero states remain distinct.",
      inputSchema: z.object({
        dataset_id: z.string().regex(/^ibge-aggregates:\d+$/).describe("Exact IBGE aggregate ID returned by search_official_data."),
        variable: z.string().regex(/^\d+(?:\|\d+)*$/).describe("One or more official variable IDs separated by |."),
        periods: z.string().regex(/^(?:-\d{1,3}|\d{4,6}(?:\|\d{4,6}){0,119})$/).default("-12").describe("Recent-period shorthand such as -12, or explicit official period IDs separated by |."),
        locality: z.string().regex(/^(?:BR|N\d{1,2}\[(?:all|\d+(?:,\d+)*)\])$/).default("BR").describe("BR or an explicit IBGE geography selection such as N3[35]."),
        classification: z.string().regex(/^\d+\[(?:all|\d+(?:,\d+)*)\](?:\|\d+\[(?:all|\d+(?:,\d+)*)\])*$/).optional().describe("Explicit classification selections from the schema, such as 11255[90707]."),
      }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ dataset_id, variable, periods, locality, classification }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/observations`, { variable, periods, locality, classification });
      return result(value, `Retrieved the requested official IBGE slice for ${dataset_id}. Preserve its unit, classifications, geography, period keys, value statuses, and provenance.`);
    },
  );

  server.registerTool(
    "get_siconfi_schema",
    {
      title: "Inspect a SICONFI fiscal report",
      description: "Get the meaning and required selection fields for an exact SICONFI dataset returned by search_official_data. Use this before get_siconfi_data so entity, reporting period, report type, government branch, and annex are explicit rather than guessed.",
      inputSchema: z.object({ dataset_id: z.string().regex(/^siconfi:(?:rreo|rgf|dca|entes)$/).describe("Exact SICONFI dataset ID returned by search_official_data.") }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/schema`);
      return result(value, `Retrieved the SICONFI selection contract for ${dataset_id}. Ask for any required field that the user did not specify.`);
    },
  );

  server.registerTool(
    "get_siconfi_data",
    {
      title: "Query official SICONFI fiscal data",
      description: "Retrieve an explicit official SICONFI DCA, RREO, RGF, or entity-registry selection. First inspect the schema. This tool preserves account, column, annex, period, entity, raw value fields, and upstream provenance without aggregating or substituting concepts.",
      inputSchema: z.object({
        dataset_id: z.string().regex(/^siconfi:(?:rreo|rgf|dca|entes)$/).describe("Exact SICONFI dataset ID returned by search_official_data."),
        year: z.number().int().min(2013).max(2100).optional().describe("Calendar year of the official report."),
        entity: z.number().int().min(1).max(9_999_999).optional().describe("Official IBGE entity code."),
        period: z.number().int().min(1).max(6).optional().describe("RREO bimestre (1-6) or RGF period (1-3)."),
        periodicity: z.enum(["Q", "S"]).optional().describe("RGF only: four-month (Q) or half-year (S)."),
        report_type: z.enum(["RREO", "RREO Simplificado", "RGF", "RGF Simplificado"]).optional().describe("Official SICONFI report type for the selected dataset."),
        power: z.enum(["E", "L", "J", "M", "D"]).optional().describe("RGF government branch."),
        sphere: z.enum(["M", "E", "U", "C"]).optional().describe("Government sphere: municipal, state, federal, or consortium."),
        annex: z.string().min(1).max(100).optional().describe("Exact official annex name from the SICONFI documentation."),
      }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ dataset_id, ...parameters }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/observations`, parameters);
      return result(value, `Retrieved the requested official SICONFI selection for ${dataset_id}. Preserve the entity, reporting period, account labels, raw values, and provenance.`);
    },
  );

  server.registerTool(
    "get_comexstat_data",
    {
      title: "Query official Brazilian merchandise trade",
      description: "Retrieve a bounded, explicit MDIC Comex Stat export or import slice from 1997 onward. Use comexstat:general only after search_official_data. Select period, dimensions, metrics, and optional official filter codes; partner, product, state, transport, classification, and raw metric fields remain attached to the result.",
      inputSchema: z.object({
        dataset_id: z.literal("comexstat:general").describe("The official MDIC Comex Stat dataset identifier."),
        flow: z.enum(["export", "import"]).describe("Trade direction to retrieve."),
        from: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).describe("First month, YYYY-MM."),
        to: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).describe("Last month, YYYY-MM."),
        month_detail: z.boolean().default(true).describe("Whether to keep month-level detail in the response."),
        details: z.array(z.enum(["country", "economicBlock", "state", "via", "urf", "ncm", "subHeading", "heading", "chapter", "section", "BECLevel3", "BECLevel2", "BECLevel1", "SITCBasicHeading", "SITCSubGroup", "SITCGroup", "SITCDivision", "SITCSection", "ISICClass", "ISICGroup", "ISICDivision", "ISICSection"])).max(8).default([]).describe("Official dimensions to include, up to eight."),
        metrics: z.array(z.enum(["metricFOB", "metricKG", "metricStatistic", "metricFreight", "metricInsurance", "metricCIF"])).max(6).default(["metricFOB"]).describe("Official Comex Stat metrics to return."),
        filters: z.array(z.object({ filter: z.enum(["country", "economicBlock", "state", "via", "urf", "ncm", "subHeading", "heading", "chapter", "section", "BECLevel3", "BECLevel2", "BECLevel1", "SITCBasicHeading", "SITCSubGroup", "SITCGroup", "SITCDivision", "SITCSection", "ISICClass", "ISICGroup", "ISICDivision", "ISICSection"]).describe("Official dimension code to filter."), values: z.array(z.union([z.string().max(30), z.number()])).min(1).max(50).describe("One or more official filter values.") })).max(6).default([]).describe("Optional official dimension filters."),
        language: z.enum(["pt", "en", "es"]).default("pt").describe("Language for labels in the upstream response."),
      }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ dataset_id, flow, from, to, month_detail, details, metrics, filters, language }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/observations`, { flow, from, to, month_detail: String(month_detail), details: details.join("|"), metrics: metrics.join("|"), filters: JSON.stringify(filters), language });
      return result(value, `Retrieved the requested official MDIC trade slice. Preserve flow, period, partner/product codes, metric names, raw values, and provenance.`);
    },
  );

  server.registerTool(
    "get_anp_fuel_prices",
    {
      title: "Query official ANP fuel prices",
      description: "Retrieve auditable fuel and GLP price statistics calculated from official ANP station observations. Omit year and month for the rolling latest four weeks, or provide both for a published monthly file from 2023 onward. Results retain period, product, geography, unit, sample count, source URL, and the disclosed aggregation method while excluding station identity and addresses.",
      inputSchema: z.object({
        dataset_id: z.literal("anp:fuel-prices").describe("The official ANP fuel-prices dataset identifier."),
        fuel_group: z.enum(["gasoline-ethanol", "diesel-gnv", "glp"]).describe("ANP product group to retrieve."),
        year: z.number().int().min(2023).max(2100).optional().describe("Published source year; provide with month for a monthly file."),
        month: z.number().int().min(1).max(12).optional().describe("Published source month; provide with year for a monthly file."),
        geography: z.enum(["country", "region", "state", "municipality"]).default("country").describe("Geographic aggregation level."),
        period: z.enum(["week", "month"]).default("week").describe("Reporting period granularity."),
        state: z.string().regex(/^[A-Za-z]{2}$/).optional().describe("Two-letter Brazilian state code when geography is state or municipality."),
        municipality: z.string().min(1).max(100).optional().describe("Municipality name when geography is municipality."),
        product: z.string().min(1).max(100).optional().describe("Exact ANP product label, for example GASOLINA or ETANOL."),
        limit: z.number().int().min(1).max(5000).default(1000).describe("Maximum aggregate rows to return."),
      }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ dataset_id, fuel_group, year, month, geography, period, state, municipality, product, limit }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/observations`, { fuel_group, year, month, geography, period, state, municipality, product, limit });
      return result(value, "Retrieved official ANP fuel-price aggregates. Preserve the period, geography, product, unit, source-observation count, disclosed transformation, and provenance.");
    },
  );

  server.registerTool(
    "get_epe_electricity_consumption",
    {
      title: "Query official electricity consumption",
      description: "Retrieve monthly EPE electricity consumption and consumer counts from 2004 onward. Select a bounded period, country/region/UF geography, consumption classes, and regulated/free market. The response identifies the exact synchronized official workbook version and discloses aggregation across source system rows.",
      inputSchema: z.object({
        dataset_id: z.literal("epe:electricity-consumption").describe("The official EPE electricity-consumption dataset identifier."),
        from: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).optional().describe("Inclusive first month, YYYY-MM."),
        to: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).optional().describe("Inclusive last month, YYYY-MM."),
        geography: z.enum(["country", "region", "state"]).default("country").describe("Geographic aggregation level."),
        states: z.array(z.enum(["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"])).max(8).default([]).describe("Optional official state codes when geography is state."),
        regions: z.array(z.enum(["Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"])).max(5).default([]).describe("Optional official regions when geography is region."),
        classes: z.array(z.enum(["Comercial", "Industrial", "Outros", "Residencial", "Rural"])).max(5).default(["Comercial", "Industrial", "Outros", "Residencial", "Rural"]).describe("Consumption classes to include."),
        markets: z.array(z.enum(["Cativo", "Livre"])).max(2).default(["Cativo", "Livre"]).describe("Electricity-market segments to include."),
        limit: z.number().int().min(1).max(5000).default(1000).describe("Maximum rows to return."),
      }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id, from, to, geography, states, regions, classes, markets, limit }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/observations`, { from, to, geography, states: states.join("|"), regions: regions.join("|"), classes: classes.join("|"), markets: markets.join("|"), limit });
      return result(value, "Retrieved official EPE electricity consumption. Preserve the period, geography, class, market, MWh unit, source version, aggregation disclosure, and provenance.");
    },
  );

  server.registerTool(
    "get_mte_formal_employment_schema",
    {
      title: "Inspect Novo Caged dimensions and measures",
      description: "Inspect the official adjusted Novo Caged selection contract, source vintage, measure meanings, available industry IDs, and the constraint that geography and industry come from separate official tables. Use before an industry query.",
      inputSchema: z.object({ dataset_id: z.literal("mte:formal-employment").describe("The official MTE Novo Caged dataset identifier.") }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/schema`);
      return result(value, "Retrieved the Novo Caged measure meanings, available breakdowns and industries, source vintage, and non-combinability constraints.");
    },
  );

  server.registerTool(
    "get_mte_formal_employment",
    {
      title: "Query official formal-employment stock and flows",
      description: "Retrieve revised monthly Novo Caged stock, admissions, dismissals, balance, and relative change from 2020 onward. Select exactly one official breakdown: country, region, state, or economic activity. The response preserves the MTE workbook vintage and never synthesizes state-by-industry values.",
      inputSchema: z.object({
        dataset_id: z.literal("mte:formal-employment").describe("The official MTE Novo Caged dataset identifier."),
        from: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).optional().describe("Inclusive first month, YYYY-MM."),
        to: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).optional().describe("Inclusive last month, YYYY-MM."),
        breakdown: z.enum(["country", "region", "state", "industry"]).default("country").describe("Official breakdown for the employment result."),
        states: z.array(z.enum(["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"])).max(27).default([]).describe("Optional official state codes when breakdown is state."),
        regions: z.array(z.enum(["Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"])).max(5).default([]).describe("Optional official regions when breakdown is region."),
        industries: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(26).default([]).describe("Exact official activity IDs returned by get_mte_formal_employment_schema; empty means all activities."),
        limit: z.number().int().min(1).max(5000).default(1000).describe("Maximum rows to return."),
      }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id, from, to, breakdown, states, regions, industries, limit }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/observations`, { from, to, breakdown, states: states.join("|"), regions: regions.join("|"), industries: industries.join("|"), limit });
      return result(value, "Retrieved adjusted official Novo Caged employment data. Preserve period, breakdown, stock-versus-flow meanings, percent unit, source workbook vintage, and provenance.");
    },
  );

  server.registerTool(
    "get_cvm_investment_funds_schema",
    {
      title: "Inspect CVM investment-fund measures and dimensions",
      description: "Inspect the synchronized CVM daily-report window, official classifications, fund-search contract, measure meanings, and aggregation constraints. Use before querying a fund by name or comparing classes.",
      inputSchema: z.object({ dataset_id: z.literal("cvm:investment-funds").describe("The official CVM investment-funds dataset identifier.") }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/schema`);
      return result(value, "Retrieved CVM fund-report measures, classifications, coverage, completeness boundary, and non-additive quota constraint.");
    },
  );

  server.registerTool(
    "get_tesouro_rtn_schema",
    {
      title: "Inspect Government Central fiscal accounts",
      description: "Inspect RTN table 1.2 account IDs, hierarchy, current-value unit, coverage, source vintage, and above/below-the-line constraints. Use before selecting revenue or expenditure categories.",
      inputSchema: z.object({ dataset_id: z.literal("tesouro-rtn:government-central").describe("The official Tesouro Nacional RTN dataset identifier.") }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/schema`);
      return result(value, "Retrieved the RTN account hierarchy, units, coverage, methodology references, and source workbook vintage.");
    },
  );

  server.registerTool(
    "get_tesouro_rtn",
    {
      title: "Query Government Central revenue, expenditure, and result",
      description: "Retrieve monthly current-value RTN accounts from 1997 onward. Defaults to total revenue, transfers, net revenue, total expenditure, and the above-the-line primary result; select exact account IDs or search account labels for detail.",
      inputSchema: z.object({
        dataset_id: z.literal("tesouro-rtn:government-central").describe("The official Tesouro Nacional RTN dataset identifier."),
        from: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).optional().describe("Inclusive first month, YYYY-MM."),
        to: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).optional().describe("Inclusive last month, YYYY-MM."),
        accounts: z.array(z.string().regex(/^\d+(?:\.\d+)*$/)).max(8).default([]).describe("Exact account IDs returned by get_tesouro_rtn_schema."),
        query: z.string().min(2).max(120).optional().describe("Account-label search; omit accounts to search the full tree."),
        limit: z.number().int().min(1).max(5000).default(1000).describe("Maximum account rows to return."),
      }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id, from, to, accounts, query, limit }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/observations`, { from, to, accounts: accounts.join("|"), q: query, limit });
      return result(value, "Retrieved official monthly RTN fiscal accounts. Preserve account hierarchy, current R$ million unit, reference period, cash/effective-payment basis, source vintage, and provenance.");
    },
  );

  server.registerTool(
    "get_tesouro_dpf_schema",
    {
      title: "Inspect Federal Public Debt statistics",
      description: "Inspect the six versioned RMD annex tables, their distinct units and coverage, category IDs, holder definitions, source publication, and methodological constraints before selecting data.",
      inputSchema: z.object({ dataset_id: z.literal("tesouro-dpf:debt-profile").describe("The official Tesouro Nacional DPF debt-profile dataset identifier.") }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/schema`);
      return result(value, "Retrieved official RMD table definitions, categories, units, coverage, holder footnotes, and source vintage.");
    },
  );

  server.registerTool(
    "get_tesouro_dpf",
    {
      title: "Query Federal Public Debt statistics",
      description: "Retrieve one official monthly RMD table at a time: debt composition, DPMFi holders, average maturity, average maturity by indexer, monthly cost, or twelve-month cost. Units remain table-specific and are never combined.",
      inputSchema: z.object({
        dataset_id: z.literal("tesouro-dpf:debt-profile").describe("The official Tesouro Nacional DPF debt-profile dataset identifier."),
        table: z.enum(["composition", "holders", "average-maturity", "average-maturity-by-indexer", "monthly-cost", "twelve-month-cost"]).default("composition").describe("Versioned RMD table to retrieve."),
        from: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).optional().describe("Inclusive first month, YYYY-MM."),
        to: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).optional().describe("Inclusive last month, YYYY-MM."),
        categories: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(8).default([]).describe("Exact category IDs returned for the selected table by get_tesouro_dpf_schema."),
        query: z.string().min(2).max(120).optional().describe("Category-label search; useful when category IDs are unknown."),
        limit: z.number().int().min(1).max(5000).default(1000).describe("Maximum debt-statistics rows to return."),
      }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id, table, from, to, categories, query, limit }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/observations`, { table, from, to, categories: categories.join("|"), q: query, limit });
      return result(value, "Retrieved one official RMD debt-statistics table. Preserve the table identity, category, reference month, unit, share semantics, source vintage, and annex provenance.");
    },
  );

  server.registerTool(
    "get_cvm_investment_funds",
    {
      title: "Query official CVM investment-fund reports",
      description: "Retrieve daily CVM aggregates by official fund classification or resolve a fund/class latest report by CNPJ or name. Net assets and flows are additive; quota values stay fund-level; reported holder totals are not deduplicated people.",
      inputSchema: z.object({
        dataset_id: z.literal("cvm:investment-funds").describe("The official CVM investment-funds dataset identifier."),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive first report date, YYYY-MM-DD."),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive last report date, YYYY-MM-DD."),
        breakdown: z.enum(["classification", "fund"]).default("classification").describe("Whether to aggregate by official classification or resolve a fund."),
        classifications: z.array(z.enum(["Ações", "Cambial", "FMP-FGTS", "Multimercado", "Não classificado", "Renda Fixa"])).max(6).default([]).describe("Official fund classifications to include."),
        funds: z.array(z.string().regex(/^\d{14}$/)).max(8).default([]).describe("Unformatted 14-digit fund/class CNPJ values."),
        query: z.string().min(2).max(120).optional().describe("Fund-name search; use only with breakdown=fund."),
        limit: z.number().int().min(1).max(100).default(25).describe("Maximum fund or classification rows to return."),
      }),
      outputSchema: v2OutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ dataset_id, from, to, breakdown, classifications, funds, query, limit }) => {
      const value = await v2(`/api/v2/datasets/${encodeURIComponent(dataset_id)}/observations`, { from, to, breakdown, classifications: classifications.join("|"), funds: funds.join("|"), q: query, limit });
      return result(value, "Retrieved official CVM investment-fund data. Preserve the date, fund/class identity, BRL units, reported-holder semantics, completeness boundary, source version, and provenance.");
    },
  );

  return server;
}

const handler = createMcpHandler(buildServer, { legacy: "stateless" });

export function handleMcp(request: Request) {
  return handler.fetch(request);
}
