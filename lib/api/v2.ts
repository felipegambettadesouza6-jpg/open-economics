import { getOfficialDataset, officialCatalogSummary } from "@/lib/catalog/official-datasets";
import { indicators } from "@/lib/catalog/indicators";
import { ApiError } from "@/lib/errors";
import { parseIbgeValue } from "@/lib/providers/ibge-aggregates";
import {
  aggregateAnpFuelPrices,
  ANP_FUEL_GROUPS,
  ANP_GEOGRAPHY_SCOPES,
  ANP_PERIOD_SCOPES,
  anpFuelCsvUrl,
  parseAnpFuelCsv,
  type AnpFuelSelection,
} from "@/lib/providers/anp-fuel-prices";
import {
  EPE_ELECTRICITY_CLASSES,
  EPE_ELECTRICITY_GEOGRAPHIES,
  EPE_ELECTRICITY_MARKETS,
  epeElectricityMetadata,
  queryEpeElectricity,
  type EpeElectricitySelection,
} from "@/lib/providers/epe-electricity";
import {
  MTE_FORMAL_EMPLOYMENT_BREAKDOWNS,
  MTE_FORMAL_EMPLOYMENT_INDUSTRIES,
  MTE_FORMAL_EMPLOYMENT_REGIONS,
  mteFormalEmploymentMetadata,
  queryMteFormalEmployment,
  type MteFormalEmploymentSelection,
} from "@/lib/providers/mte-formal-employment";
import {
  CVM_FUND_BREAKDOWNS,
  CVM_FUND_CLASSIFICATIONS,
  cvmFundMetadata,
  queryCvmInvestmentFunds,
  type CvmFundSelection,
} from "@/lib/providers/cvm-investment-funds";
import {
  TESOURO_RTN_ACCOUNTS,
  TESOURO_RTN_DEFAULT_ACCOUNTS,
  tesouroRtnMetadata,
  queryTesouroRtn,
  type TesouroRtnSelection,
} from "@/lib/providers/tesouro-rtn";
import {
  TESOURO_DPF_TABLES,
  TESOURO_DPF_TABLE_METADATA,
  tesouroDpfCategories,
  tesouroDpfMetadata,
  queryTesouroDpf,
  type TesouroDpfSelection,
} from "@/lib/providers/tesouro-dpf";
import { semanticSearch, economicConcepts } from "@/lib/semantic/search";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RESPONSE_BYTES = 8_000_000;
const MAX_ANP_CSV_BYTES = 12_000_000;
const bcbMetadataCache = new Map<string, { expires: number; value: Record<string, string | number | null> }>();

export interface V2RouteResult {
  body: unknown;
  cacheControl?: string;
  headers?: HeadersInit;
}

function validDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function dateYearsAgo(years: number) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function bcbDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function isoBcbDate(value: unknown) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value));
  if (!match) throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB returned an invalid date.");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function decodeDatasetId(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new ApiError(400, "INVALID_DATASET_ID", "Dataset IDs use provider:id, for example bcb-sgs:432.");
  }
}

function datasetOrThrow(rawId: string) {
  const dataset = getOfficialDataset(decodeDatasetId(rawId));
  if (!dataset) throw new ApiError(404, "DATASET_NOT_FOUND", `Official dataset not found: ${rawId}`);
  return dataset;
}

function rejectUnknown(url: URL, allowed: string[]) {
  const allowedSet = new Set(allowed);
  for (const key of url.searchParams.keys()) {
    if (!allowedSet.has(key)) throw new ApiError(400, "UNKNOWN_QUERY_PARAMETER", `Unknown query parameter: ${key}`);
  }
}

function integerParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const raw = url.searchParams.get(name) ?? String(fallback);
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    throw new ApiError(400, `INVALID_${name.toUpperCase()}`, `${name} must be an integer from ${min} to ${max}.`);
  }
  return Number(raw);
}

function requiredIntegerParam(url: URL, name: string, min: number, max: number) {
  const raw = url.searchParams.get(name) ?? "";
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    throw new ApiError(400, `INVALID_${name.toUpperCase()}`, `${name} is required and must be an integer from ${min} to ${max}.`);
  }
  return Number(raw);
}

async function officialJson(url: URL, source: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", "User-Agent": "OpenEconomicsAPI/2.0", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError(504, "UPSTREAM_TIMEOUT", `${source} did not respond in time.`);
    }
    throw new ApiError(502, "UPSTREAM_CONNECTION_ERROR", `${source} is temporarily unavailable.`);
  }
  if (!response.ok) {
    throw new ApiError(response.status === 429 ? 503 : 502, response.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_ERROR", `${source} is temporarily unavailable.`, `${source} responded with HTTP ${response.status}.`, response.status === 429 ? 60 : undefined);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new ApiError(502, "UPSTREAM_RESPONSE_TOO_LARGE", `${source} returned too much data.`);
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new ApiError(502, "UPSTREAM_RESPONSE_TOO_LARGE", `${source} returned too much data.`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", `${source} returned invalid JSON.`);
  }
}

async function officialText(url: URL, source: string, maxBytes: number) {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "text/csv", "User-Agent": "OpenEconomicsAPI/2.0" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new ApiError(504, "UPSTREAM_TIMEOUT", `${source} did not respond in time.`);
    throw new ApiError(502, "UPSTREAM_CONNECTION_ERROR", `${source} is temporarily unavailable.`);
  }
  if (!response.ok) {
    throw new ApiError(response.status === 429 ? 503 : 502, response.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_ERROR", `${source} is temporarily unavailable.`, `${source} responded with HTTP ${response.status}.`, response.status === 429 ? 60 : undefined);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw new ApiError(502, "UPSTREAM_RESPONSE_TOO_LARGE", `${source} returned too much data.`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new ApiError(502, "UPSTREAM_RESPONSE_TOO_LARGE", `${source} returned too much data.`);
  return new TextDecoder("utf-8").decode(bytes);
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, " / ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function bcbMetadataField(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<b>\\s*${escaped}\\s*</b>[\\s\\S]*?</td>\\s*<td[^>]*>[\\s\\S]*?<span[^>]*>([\\s\\S]*?)</span>`, "i").exec(html);
  return match ? stripHtml(match[1]) || null : null;
}

async function fetchBcbMetadata(dataset: NonNullable<ReturnType<typeof getOfficialDataset>>) {
  const cached = bcbMetadataCache.get(dataset.upstreamId);
  if (cached && cached.expires > Date.now()) return cached.value;
  let landing: Response;
  try {
    landing = await fetch(dataset.metadataUrl, {
      headers: { Accept: "text/html", "User-Agent": "OpenEconomicsAPI/2.0" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(502, "UPSTREAM_CONNECTION_ERROR", "Banco Central do Brasil metadata is temporarily unavailable.");
  }
  if (!landing.ok) throw new ApiError(502, "UPSTREAM_ERROR", "Banco Central do Brasil metadata is temporarily unavailable.");
  const cookie = landing.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB did not establish a metadata session.");
  const detailsUrl = new URL("https://www3.bcb.gov.br/sgspub/JSP/consultarmetadados/cmiDadosBasicos.jsp");
  const details = await fetch(detailsUrl, {
    headers: { Accept: "text/html", Cookie: cookie, "User-Agent": "OpenEconomicsAPI/2.0" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!details.ok) throw new ApiError(502, "UPSTREAM_ERROR", "Banco Central do Brasil metadata is temporarily unavailable.");
  const html = await details.text();
  if (html.length > 1_000_000) throw new ApiError(502, "UPSTREAM_RESPONSE_TOO_LARGE", "BCB returned too much metadata.");
  const value = {
    series_code: Number(dataset.upstreamId),
    full_name: bcbMetadataField(html, "Full name"),
    short_name: bcbMetadataField(html, "Short name"),
    subject_chain: bcbMetadataField(html, "Subject chain"),
    periodicity: bcbMetadataField(html, "Periodicity"),
    unit: bcbMetadataField(html, "Unit"),
    source: bcbMetadataField(html, "Source"),
    start_date: bcbMetadataField(html, "Start date"),
    end_date: bcbMetadataField(html, "End date"),
    series_type: bcbMetadataField(html, "Series type"),
    decimal_digits: Number(bcbMetadataField(html, "Amount of spreading decimal digits")) || null,
    formula: bcbMetadataField(html, "Formula"),
    warning: bcbMetadataField(html, "Warning message"),
  };
  bcbMetadataCache.set(dataset.upstreamId, { expires: Date.now() + 86_400_000, value });
  return value;
}

function searchRoute(url: URL): V2RouteResult {
  rejectUnknown(url, ["q", "limit"]);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length < 2 || query.length > 300) throw new ApiError(400, "INVALID_SEARCH_QUERY", "q must contain 2 to 300 characters.");
  const limit = integerParam(url, "limit", 10, 1, 25);
  const result = semanticSearch(query, limit);
  return {
    body: {
      data: result,
      meta: {
        architecture: "concept routing → official dataset resolution → explicit measure/dimension selection",
        catalog: officialCatalogSummary,
        no_substitution: true,
      },
      links: { self: url.toString() },
    },
  };
}

async function bcbObservations(url: URL, dataset: NonNullable<ReturnType<typeof getOfficialDataset>>): Promise<V2RouteResult> {
  rejectUnknown(url, ["start", "end", "order", "limit"]);
  const end = url.searchParams.get("end") ?? new Date().toISOString().slice(0, 10);
  const start = url.searchParams.get("start") ?? dateYearsAgo(3);
  if (!validDate(start) || !validDate(end) || start > end) throw new ApiError(400, "INVALID_DATE_RANGE", "start and end must be valid YYYY-MM-DD dates with start on or before end.");
  if ((new Date(`${end}T00:00:00Z`).valueOf() - new Date(`${start}T00:00:00Z`).valueOf()) / 86_400_000 > 3660) {
    throw new ApiError(400, "DATE_RANGE_TOO_LARGE", "BCB SGS requests are limited to ten years.");
  }
  const order = url.searchParams.get("order") ?? "asc";
  if (order !== "asc" && order !== "desc") throw new ApiError(400, "INVALID_ORDER", "order must be asc or desc.");
  const limit = integerParam(url, "limit", 5000, 1, 5000);
  const upstream = new URL(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${dataset.upstreamId}/dados`);
  upstream.searchParams.set("formato", "json");
  upstream.searchParams.set("dataInicial", bcbDate(start));
  upstream.searchParams.set("dataFinal", bcbDate(end));
  const [payload, schema] = await Promise.all([officialJson(upstream, "Banco Central do Brasil"), fetchBcbMetadata(dataset)]);
  if (!Array.isArray(payload)) throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB returned an unexpected response shape.");
  let rows = payload.map((row) => {
    if (!row || typeof row !== "object") throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB returned an invalid observation.");
    const sourceDate = String((row as { data?: unknown }).data ?? "");
    const rawValue = String((row as { valor?: unknown }).valor ?? "");
    const value = Number(rawValue.replace(",", "."));
    if (!Number.isFinite(value)) throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB returned a non-numeric value.");
    const date = isoBcbDate(sourceDate);
    return { date, period: date, source_date: sourceDate, value, raw_value: rawValue, status: "observed" };
  }).sort((left, right) => left.date.localeCompare(right.date));
  if (order === "desc") rows.reverse();
  const available = rows.length;
  rows = rows.slice(0, limit);
  return {
    body: {
      data: rows,
      meta: {
        dataset,
        provenance: { source: "BCB", upstream_url: upstream.toString(), source_url: dataset.sourceUrl, retrieved_at: new Date().toISOString() },
        schema,
        date_semantics: "The source date is preserved exactly; interpret its period using the official periodicity field.",
        returned: rows.length,
        available,
        truncated: available > rows.length,
      },
      links: { self: url.toString(), dataset: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}` },
    },
    cacheControl: "public, max-age=60, s-maxage=3600, stale-if-error=86400",
  };
}

type IbgeSeries = {
  localidade?: { id?: unknown; nome?: unknown; nivel?: { id?: unknown; nome?: unknown } };
  serie?: Record<string, unknown>;
};

function normalizeIbgePayload(payload: unknown) {
  if (!Array.isArray(payload)) throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "IBGE returned an unexpected response shape.");
  return payload.map((variable) => {
    if (!variable || typeof variable !== "object") throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "IBGE returned an invalid variable.");
    const item = variable as { id?: unknown; variavel?: unknown; unidade?: unknown; resultados?: Array<{ classificacoes?: unknown; series?: IbgeSeries[] }> };
    return {
      id: String(item.id ?? ""),
      name: String(item.variavel ?? ""),
      unit: String(item.unidade ?? ""),
      results: (item.resultados ?? []).map((result) => ({
        classifications: result.classificacoes ?? [],
        series: (result.series ?? []).map((series) => ({
          geography: {
            id: String(series.localidade?.id ?? ""),
            name: String(series.localidade?.nome ?? ""),
            level_id: String(series.localidade?.nivel?.id ?? ""),
            level_name: String(series.localidade?.nivel?.nome ?? ""),
          },
          observations: Object.entries(series.serie ?? {}).map(([period, raw]) => ({ period, raw_value: String(raw), ...parseIbgeValue(String(raw)) })),
        })),
      })),
    };
  });
}

async function ibgeObservations(url: URL, dataset: NonNullable<ReturnType<typeof getOfficialDataset>>): Promise<V2RouteResult> {
  rejectUnknown(url, ["variable", "periods", "locality", "classification"]);
  const variable = (url.searchParams.get("variable") ?? "").trim();
  const periods = (url.searchParams.get("periods") ?? "-12").trim();
  const locality = (url.searchParams.get("locality") ?? "BR").trim();
  const classification = url.searchParams.get("classification")?.trim() ?? "";
  if (!/^\d+(?:\|\d+)*$/.test(variable)) throw new ApiError(400, "VARIABLE_REQUIRED", "variable must contain one or more official numeric variable IDs separated by |.");
  if (!/^(?:-\d{1,3}|\d{4,6}(?:\|\d{4,6}){0,119})$/.test(periods)) throw new ApiError(400, "INVALID_PERIODS", "periods must be -N or up to 120 official period IDs separated by |.");
  if (!/^(?:BR|N\d{1,2}\[(?:all|\d+(?:,\d+)*)\])$/.test(locality)) throw new ApiError(400, "INVALID_LOCALITY", "locality must be BR or an explicit IBGE selection such as N3[35].");
  if (classification && !/^\d+\[(?:all|\d+(?:,\d+)*)\](?:\|\d+\[(?:all|\d+(?:,\d+)*)\])*$/.test(classification)) {
    throw new ApiError(400, "INVALID_CLASSIFICATION", "classification must use explicit IBGE IDs, for example 11255[90707].");
  }
  const upstream = new URL(`https://servicodados.ibge.gov.br/api/v3/agregados/${dataset.upstreamId}/periodos/${periods}/variaveis/${variable}`);
  upstream.searchParams.set("localidades", locality);
  if (classification) upstream.searchParams.set("classificacao", classification);
  const payload = await officialJson(upstream, "IBGE");
  return {
    body: {
      data: normalizeIbgePayload(payload),
      meta: {
        dataset,
        selection: { variables: variable.split("|"), periods, locality, classification: classification || null },
        provenance: { source: "IBGE", upstream_url: upstream.toString(), source_url: dataset.sourceUrl, metadata_url: dataset.metadataUrl, retrieved_at: new Date().toISOString() },
        value_semantics: "Official missing, suppressed, zero, and quality-flag values remain distinct.",
      },
      links: { self: url.toString(), dataset: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}`, schema: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema` },
    },
    cacheControl: "public, max-age=60, s-maxage=3600, stale-if-error=86400",
  };
}

const SICONFI_SCHEMAS = {
  entes: {
    title: "Cadastro de entes da Federação",
    description: "Current SICONFI registry of federal, state, municipal, and consortium entities.",
    parameters: [],
  },
  dca: {
    title: "Declaração das Contas Anuais (DCA)",
    description: "Annual accounting statement for one government entity.",
    parameters: ["year (required)", "entity (required IBGE code)", "annex (optional official DCA annex name)"],
  },
  rreo: {
    title: "Relatório Resumido da Execução Orçamentária (RREO)",
    description: "Bimonthly budget-execution report for one government entity.",
    parameters: ["year (required)", "period (required, 1-6)", "report_type (required: RREO or RREO Simplificado)", "entity (required IBGE code)", "sphere (optional: M, E, U, C)", "annex (optional official RREO annex name)"],
  },
  rgf: {
    title: "Relatório de Gestão Fiscal (RGF)",
    description: "Four-month or half-year fiscal-management report for one government entity and branch.",
    parameters: ["year (required)", "periodicity (required: Q or S)", "period (required, 1-3)", "report_type (required: RGF or RGF Simplificado)", "power (required: E, L, J, M, D)", "entity (required IBGE code)", "sphere (optional: M, E, U, C)", "annex (optional official RGF annex name)"],
  },
} as const;

const COMEXSTAT_FILTERS = ["country", "economicBlock", "state", "via", "urf", "ncm", "subHeading", "heading", "chapter", "section", "BECLevel3", "BECLevel2", "BECLevel1", "SITCBasicHeading", "SITCSubGroup", "SITCGroup", "SITCDivision", "SITCSection", "ISICClass", "ISICGroup", "ISICDivision", "ISICSection"] as const;
const COMEXSTAT_DETAILS = COMEXSTAT_FILTERS;
const COMEXSTAT_METRICS = ["metricFOB", "metricKG", "metricStatistic", "metricFreight", "metricInsurance", "metricCIF"] as const;
const COMEXSTAT_SCHEMA = {
  title: "Comex Stat — general exports and imports",
  description: "Official MDIC monthly merchandise-trade cube from 1997 through the latest complete month.",
  required: ["flow", "from", "to"],
  parameters: {
    flow: ["export", "import"],
    from: "YYYY-MM",
    to: "YYYY-MM",
    month_detail: "true or false; defaults to true",
    details: COMEXSTAT_DETAILS,
    metrics: COMEXSTAT_METRICS,
    filters: "JSON array of {filter, values}; names come from filters and values use the official auxiliary-table codes",
    language: ["pt", "en", "es"],
  },
  constraints: ["Freight, insurance, and CIF metrics are import-only.", "Statistical quantity requires NCM detail.", "Use the official bulk CSVs for very large extracts."],
  official_endpoints: { documentation: "https://api-comexstat.mdic.gov.br/docs#/", filters: "https://api-comexstat.mdic.gov.br/general/filters", metrics: "https://api-comexstat.mdic.gov.br/general/metrics" },
} as const;

const ANP_FUEL_SCHEMA = {
  title: "ANP fuel and GLP prices",
  description: "Weekly station observations published as official ANP open data, returned as privacy-minimized statistical aggregates.",
  required: ["fuel_group"],
  parameters: {
    fuel_group: ANP_FUEL_GROUPS,
    year: "Optional monthly archive year from 2023 onward; year and month must be provided together. Omit both for the rolling latest four weeks.",
    month: "Optional monthly archive month, 1-12.",
    geography: ANP_GEOGRAPHY_SCOPES,
    period: ANP_PERIOD_SCOPES,
    state: "Optional two-letter UF filter.",
    municipality: "Optional municipality-name filter; accents and case are ignored.",
    product: "Optional exact ANP product label; accents and case are ignored.",
    limit: "Maximum aggregate rows, 1-5000.",
  },
  measures: ["average_sale_price", "sample_standard_deviation", "minimum_sale_price", "maximum_sale_price", "source_observation_count", "average_purchase_price where reported"],
  transformation: "Open Economics groups public station observations by requested period, geography, product, and unit. Station identity, address, and CNPJ are intentionally excluded.",
  temporal_coverage: "Rolling latest four weeks or monthly files from 2023 onward. Earlier semester archives remain available from the official source page.",
  official_metadata: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/metadados-serie-historica-precos-combustiveis-1.pdf",
} as const;

const EPE_ELECTRICITY_SCHEMA = {
  title: "EPE monthly electricity consumption",
  description: "Official monthly electricity consumption and consumer counts by UF, geographic region, consumption class, and regulated/free market.",
  required: [],
  parameters: {
    from: "YYYY-MM; defaults to the last twelve available months.",
    to: "YYYY-MM; defaults to the latest synchronized official period.",
    geography: EPE_ELECTRICITY_GEOGRAPHIES,
    states: "Optional pipe-separated UF codes when geography=state.",
    regions: "Optional pipe-separated official region names when geography=region or state.",
    classes: EPE_ELECTRICITY_CLASSES,
    markets: EPE_ELECTRICITY_MARKETS,
    limit: "Maximum result rows, 1-5000.",
  },
  measures: { consumption_mwh: "Monthly electricity consumption in MWh.", consumers: "Number of consumer units reported by EPE." },
  source_snapshot: epeElectricityMetadata,
  aggregation: "Open Economics sums official UF/system rows only within identical period, requested geography, class, and market keys; classes and markets remain separate.",
} as const;

const MTE_FORMAL_EMPLOYMENT_SCHEMA = {
  title: "MTE Novo Caged formal employment",
  description: "Official adjusted monthly formal-employment stock and flows from the latest synchronized Novo Caged historical workbook.",
  required: [],
  parameters: {
    from: "YYYY-MM; defaults to the last twelve available months.",
    to: "YYYY-MM; defaults to the latest synchronized official period.",
    breakdown: MTE_FORMAL_EMPLOYMENT_BREAKDOWNS,
    states: "Optional pipe-separated UF codes when breakdown=state.",
    regions: "Optional pipe-separated official region names when breakdown=region.",
    industries: "Optional pipe-separated industry IDs when breakdown=industry.",
    limit: "Maximum result rows, 1-5000.",
  },
  measures: {
    stock: "Adjusted formal-employment stock at the end of the reference month.",
    admissions: "Adjusted admissions during the reference month.",
    dismissals: "Adjusted dismissals during the reference month.",
    balance: "Adjusted admissions minus dismissals.",
    relative_change_pct: "Official monthly relative stock change, in percent; unavailable for the first series month.",
  },
  industries: MTE_FORMAL_EMPLOYMENT_INDUSTRIES,
  source_snapshot: mteFormalEmploymentMetadata,
  constraints: ["Country, region/state, and industry are separate official tables; this route does not invent combined state-by-industry observations.", "The snapshot contains adjusted historical series. It does not expose person- or establishment-level microdata."],
} as const;

const CVM_INVESTMENT_FUNDS_SCHEMA = {
  title: "CVM investment-fund daily reports",
  description: "Official fund/class reports with daily portfolio value, net assets, quota value, subscriptions, redemptions, and reported holders.",
  required: [],
  parameters: {
    from: "YYYY-MM-DD inside the synchronized rolling window.",
    to: "YYYY-MM-DD; classification queries default to the latest substantially complete source date.",
    breakdown: CVM_FUND_BREAKDOWNS,
    classifications: "Optional pipe-separated official CVM classifications when breakdown=classification.",
    funds: "One to eight CNPJ values when breakdown=fund.",
    q: "Fund-name text search when breakdown=fund; at least q or funds is required.",
    limit: "Maximum result rows: 1-5000 for classification, 1-100 for fund.",
  },
  classifications: CVM_FUND_CLASSIFICATIONS,
  measures: {
    portfolio_value_brl: "Reported total portfolio value in BRL; additive in classification aggregates.",
    net_assets_brl: "Reported net assets (patrimônio líquido) in BRL; additive in classification aggregates.",
    quota_value_brl: "Reported per-fund quota value in BRL; intentionally unavailable for aggregates because quota prices are not additive.",
    subscriptions_brl: "Reported subscriptions during the day, in BRL.",
    redemptions_brl: "Reported redemptions paid during the day, in BRL.",
    reported_holder_accounts: "Sum of reported holders across funds/classes; not deduplicated people.",
  },
  source_snapshot: cvmFundMetadata,
  constraints: ["breakdown=classification returns a daily aggregate series; breakdown=fund searches each fund/class's latest report in the rolling source window.", "The source's newest date can be incomplete while filings arrive. Defaults use latest_complete_date; source_end_date remains visible in provenance.", "Quota values are never summed or averaged across funds."],
} as const;

const TESOURO_RTN_SCHEMA = {
  title: "Resultado do Tesouro Nacional — Government Central monthly fiscal series",
  description: "Official detailed current-value revenue, expenditure, transfer, and result accounts from RTN table 1.2.",
  required: [],
  parameters: {
    from: "YYYY-MM; defaults to the last twelve available months.",
    to: "YYYY-MM; defaults to the latest synchronized RTN period.",
    accounts: "Up to eight exact hierarchical account IDs separated by |; defaults to total revenue, transfers, net revenue, total expenditure, and above-the-line primary result.",
    q: "Optional 2-120 character account-label search. When supplied without accounts, searches the full account tree.",
    limit: "Maximum result rows, 1-5000.",
  },
  measures: { value_millions_brl: "Monthly current nominal value in R$ millions, preserving the official above-the-line cash/effective-payment conventions." },
  default_accounts: TESOURO_RTN_DEFAULT_ACCOUNTS,
  accounts: TESOURO_RTN_ACCOUNTS,
  source_snapshot: tesouroRtnMetadata,
  constraints: ["Table 1.2 current values are exposed without mixing in constant-price, twelve-month, investment-function, or debt tables.", "Above-the-line and below-the-line accounts remain distinct. Missing and explicitly unavailable cells remain non-values rather than zeros."],
} as const;

const TESOURO_DPF_SCHEMA = {
  title: "Relatório Mensal da Dívida Pública Federal",
  description: "Official monthly RMD annex statistics for DPF composition, DPMFi holders, average maturity, and cost.",
  required: [],
  parameters: {
    table: TESOURO_DPF_TABLES,
    from: "YYYY-MM inside the selected table's coverage; defaults to its latest twelve months.",
    to: "YYYY-MM; defaults to the latest synchronized RMD publication.",
    categories: "Up to eight exact category IDs separated by |; available IDs differ by table.",
    q: "Optional 2-120 character category-label search.",
    limit: "Maximum result rows, 1-5000.",
  },
  tables: TESOURO_DPF_TABLE_METADATA,
  source_snapshot: tesouroDpfMetadata,
  constraints: ["Each request selects exactly one official annex table so BRL billions, years, and annualized percentages are never combined as a single measure.", "Holder categories describe DPMFi securities and retain the official table footnotes and revision notes. Negative cost observations remain valid reported values, distinct from missing cells."],
} as const;

function enumParam(url: URL, name: string, values: readonly string[], required = true) {
  const value = url.searchParams.get(name) ?? "";
  if ((!value && required) || (value && !values.includes(value))) {
    throw new ApiError(400, `INVALID_${name.toUpperCase()}`, `${name}${required ? " is required and" : ""} must be one of: ${values.join(", ")}.`);
  }
  return value;
}

function annexParam(url: URL) {
  const value = (url.searchParams.get("annex") ?? "").trim();
  if (value && (!/^[\p{L}\p{N} .()/_-]+$/u.test(value) || value.length > 100)) {
    throw new ApiError(400, "INVALID_ANNEX", "annex must be an official SICONFI annex name of at most 100 characters.");
  }
  return value;
}

async function siconfiObservations(url: URL, dataset: NonNullable<ReturnType<typeof getOfficialDataset>>): Promise<V2RouteResult> {
  const report = dataset.upstreamId as keyof typeof SICONFI_SCHEMAS;
  const upstream = new URL(`https://apidatalake.tesouro.gov.br/ords/cdwhprd/siconfi/tt/${report}`);
  const selection: Record<string, string | number | null> = {};

  if (report === "entes") {
    rejectUnknown(url, []);
  } else if (report === "dca") {
    rejectUnknown(url, ["year", "entity", "annex"]);
    selection.year = requiredIntegerParam(url, "year", 2013, 2100);
    selection.entity = requiredIntegerParam(url, "entity", 1, 9_999_999);
    selection.annex = annexParam(url) || null;
    upstream.searchParams.set("an_exercicio", String(selection.year));
    upstream.searchParams.set("id_ente", String(selection.entity));
    if (selection.annex) upstream.searchParams.set("no_anexo", String(selection.annex));
  } else if (report === "rreo") {
    rejectUnknown(url, ["year", "period", "report_type", "entity", "sphere", "annex"]);
    selection.year = requiredIntegerParam(url, "year", 2015, 2100);
    selection.period = requiredIntegerParam(url, "period", 1, 6);
    selection.report_type = enumParam(url, "report_type", ["RREO", "RREO Simplificado"]);
    selection.entity = requiredIntegerParam(url, "entity", 1, 9_999_999);
    selection.sphere = enumParam(url, "sphere", ["M", "E", "U", "C"], false) || null;
    selection.annex = annexParam(url) || null;
    upstream.searchParams.set("an_exercicio", String(selection.year));
    upstream.searchParams.set("nr_periodo", String(selection.period));
    upstream.searchParams.set("co_tipo_demonstrativo", String(selection.report_type));
    upstream.searchParams.set("id_ente", String(selection.entity));
    if (selection.sphere) upstream.searchParams.set("co_esfera", String(selection.sphere));
    if (selection.annex) upstream.searchParams.set("no_anexo", String(selection.annex));
  } else {
    rejectUnknown(url, ["year", "periodicity", "period", "report_type", "power", "entity", "sphere", "annex"]);
    selection.year = requiredIntegerParam(url, "year", 2015, 2100);
    selection.periodicity = enumParam(url, "periodicity", ["Q", "S"]);
    selection.period = requiredIntegerParam(url, "period", 1, 3);
    selection.report_type = enumParam(url, "report_type", ["RGF", "RGF Simplificado"]);
    selection.power = enumParam(url, "power", ["E", "L", "J", "M", "D"]);
    selection.entity = requiredIntegerParam(url, "entity", 1, 9_999_999);
    selection.sphere = enumParam(url, "sphere", ["M", "E", "U", "C"], false) || null;
    selection.annex = annexParam(url) || null;
    upstream.searchParams.set("an_exercicio", String(selection.year));
    upstream.searchParams.set("in_periodicidade", String(selection.periodicity));
    upstream.searchParams.set("nr_periodo", String(selection.period));
    upstream.searchParams.set("co_tipo_demonstrativo", String(selection.report_type));
    upstream.searchParams.set("co_poder", String(selection.power));
    upstream.searchParams.set("id_ente", String(selection.entity));
    if (selection.sphere) upstream.searchParams.set("co_esfera", String(selection.sphere));
    if (selection.annex) upstream.searchParams.set("no_anexo", String(selection.annex));
  }

  const payload = await officialJson(upstream, "Tesouro Nacional SICONFI");
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { items?: unknown }).items)) {
    throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "SICONFI returned an unexpected response shape.");
  }
  const envelope = payload as { items: unknown[]; hasMore?: unknown; limit?: unknown; offset?: unknown; count?: unknown };
  return {
    body: {
      data: envelope.items,
      meta: {
        dataset,
        selection,
        upstream_page: { count: envelope.count ?? envelope.items.length, limit: envelope.limit ?? null, offset: envelope.offset ?? null, has_more: envelope.hasMore ?? false },
        provenance: { source: "Tesouro Nacional — SICONFI", upstream_url: upstream.toString(), source_url: dataset.sourceUrl, documentation_url: dataset.metadataUrl, retrieved_at: new Date().toISOString() },
        value_semantics: "Official account, column, annex, period, entity, and value fields are preserved without aggregation or substitution.",
      },
      links: { self: url.toString(), dataset: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}`, schema: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema` },
    },
    cacheControl: "public, max-age=60, s-maxage=3600, stale-if-error=86400",
  };
}

function pipeSelection(url: URL, name: string, allowed: readonly string[], fallback: string[] = []) {
  const raw = (url.searchParams.get(name) ?? "").trim();
  if (!raw) return fallback;
  const values = [...new Set(raw.split("|").map((value) => value.trim()).filter(Boolean))];
  if (!values.length || values.length > 8 || values.some((value) => !allowed.includes(value))) {
    throw new ApiError(400, `INVALID_${name.toUpperCase()}`, `${name} must contain up to 8 official values separated by |.`);
  }
  return values;
}

function comexstatFilters(url: URL) {
  const raw = (url.searchParams.get("filters") ?? "").trim();
  if (!raw) return [] as Array<{ filter: string; values: Array<string | number> }>;
  if (raw.length > 4_000) throw new ApiError(400, "INVALID_FILTERS", "filters is too long.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "INVALID_FILTERS", "filters must be a JSON array of {filter, values} objects.");
  }
  if (!Array.isArray(parsed) || parsed.length > 6) throw new ApiError(400, "INVALID_FILTERS", "filters must contain at most 6 filters.");
  return parsed.map((item) => {
    if (!item || typeof item !== "object") throw new ApiError(400, "INVALID_FILTERS", "Each filter must be an object.");
    const candidate = item as { filter?: unknown; values?: unknown };
    if (typeof candidate.filter !== "string" || !COMEXSTAT_FILTERS.includes(candidate.filter as (typeof COMEXSTAT_FILTERS)[number])) {
      throw new ApiError(400, "INVALID_FILTERS", `Unknown Comex Stat filter: ${String(candidate.filter ?? "")}.`);
    }
    if (!Array.isArray(candidate.values) || !candidate.values.length || candidate.values.length > 50 || candidate.values.some((value) => !["string", "number"].includes(typeof value) || String(value).length > 30)) {
      throw new ApiError(400, "INVALID_FILTERS", "Each filter requires 1 to 50 short official code values.");
    }
    return { filter: candidate.filter, values: candidate.values as Array<string | number> };
  });
}

async function comexstatObservations(url: URL, dataset: NonNullable<ReturnType<typeof getOfficialDataset>>): Promise<V2RouteResult> {
  rejectUnknown(url, ["flow", "from", "to", "month_detail", "details", "metrics", "filters", "language"]);
  const flow = enumParam(url, "flow", ["export", "import"]);
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(to) || from < "1997-01" || from > to) {
    throw new ApiError(400, "INVALID_PERIOD", "from and to are required YYYY-MM values from 1997-01 onward, with from on or before to.");
  }
  const monthDetailRaw = url.searchParams.get("month_detail") ?? "true";
  if (!["true", "false"].includes(monthDetailRaw)) throw new ApiError(400, "INVALID_MONTH_DETAIL", "month_detail must be true or false.");
  const details = pipeSelection(url, "details", COMEXSTAT_DETAILS);
  const metrics = pipeSelection(url, "metrics", COMEXSTAT_METRICS, ["metricFOB"]);
  if (flow === "export" && metrics.some((metric) => ["metricFreight", "metricInsurance", "metricCIF"].includes(metric))) {
    throw new ApiError(400, "INVALID_METRICS", "Freight, insurance, and CIF metrics are available only for imports.");
  }
  if (metrics.includes("metricStatistic") && !details.includes("ncm")) {
    throw new ApiError(400, "INVALID_METRICS", "metricStatistic requires ncm in details.");
  }
  const filters = comexstatFilters(url);
  const language = enumParam(url, "language", ["pt", "en", "es"], false) || "pt";
  const fromMonth = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7));
  const toMonth = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7));
  if (details.length && toMonth - fromMonth > 60) throw new ApiError(400, "PERIOD_TOO_LARGE", "Detailed Comex Stat requests are limited to 60 months; split larger extracts or use MDIC bulk files.");

  const selection = { flow, monthDetail: monthDetailRaw === "true", period: { from, to }, filters, details, metrics };
  const upstream = new URL("https://api-comexstat.mdic.gov.br/general");
  upstream.searchParams.set("language", language);
  const payload = await officialJson(upstream, "MDIC Comex Stat", { method: "POST", body: JSON.stringify(selection) });
  const envelope = payload as { success?: unknown; data?: { list?: unknown }; message?: unknown; language?: unknown };
  if (!envelope || envelope.success !== true || !Array.isArray(envelope.data?.list)) {
    throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "Comex Stat returned an unexpected response shape.");
  }
  return {
    body: {
      data: envelope.data.list,
      meta: {
        dataset,
        selection,
        language: envelope.language ?? language,
        provenance: { source: "MDIC — Comex Stat", upstream_url: upstream.toString(), source_url: dataset.sourceUrl, documentation_url: dataset.metadataUrl, retrieved_at: new Date().toISOString() },
        value_semantics: "Flow, period, filter codes, detail fields, metric names, and official raw result values are preserved. Monetary trade values are in US dollars as named by each metric.",
      },
      links: { self: url.toString(), dataset: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}`, schema: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema` },
    },
    cacheControl: "public, max-age=60, s-maxage=3600, stale-if-error=86400",
  };
}

function boundedLabel(url: URL, name: string, maxLength = 100) {
  const value = (url.searchParams.get(name) ?? "").trim();
  if (value && (value.length > maxLength || !/^[\p{L}\p{N} .,'()/_-]+$/u.test(value))) {
    throw new ApiError(400, `INVALID_${name.toUpperCase()}`, `${name} must contain at most ${maxLength} letters, numbers, spaces, or basic punctuation characters.`);
  }
  return value;
}

async function anpFuelObservations(url: URL, dataset: NonNullable<ReturnType<typeof getOfficialDataset>>): Promise<V2RouteResult> {
  rejectUnknown(url, ["fuel_group", "year", "month", "geography", "period", "state", "municipality", "product", "limit"]);
  const fuelGroup = enumParam(url, "fuel_group", ANP_FUEL_GROUPS) as AnpFuelSelection["fuelGroup"];
  const yearRaw = url.searchParams.get("year");
  const monthRaw = url.searchParams.get("month");
  if (Boolean(yearRaw) !== Boolean(monthRaw)) throw new ApiError(400, "INCOMPLETE_PERIOD", "year and month must be provided together, or both omitted for the rolling latest four weeks.");
  const year = yearRaw ? requiredIntegerParam(url, "year", 2023, new Date().getUTCFullYear()) : null;
  const month = monthRaw ? requiredIntegerParam(url, "month", 1, 12) : null;
  if (year !== null && month !== null) {
    const requested = year * 12 + month;
    const now = new Date();
    if (requested > now.getUTCFullYear() * 12 + now.getUTCMonth() + 1) throw new ApiError(400, "PERIOD_IN_FUTURE", "The requested ANP month is in the future.");
  }
  const geography = (enumParam(url, "geography", ANP_GEOGRAPHY_SCOPES, false) || "country") as AnpFuelSelection["geography"];
  const period = (enumParam(url, "period", ANP_PERIOD_SCOPES, false) || "week") as AnpFuelSelection["period"];
  const stateRaw = (url.searchParams.get("state") ?? "").trim();
  if (stateRaw && !/^[A-Za-z]{2}$/.test(stateRaw)) throw new ApiError(400, "INVALID_STATE", "state must be a two-letter Brazilian UF code.");
  const state = stateRaw ? stateRaw.toUpperCase() : null;
  const municipality = boundedLabel(url, "municipality") || null;
  const product = boundedLabel(url, "product") || null;
  if (municipality && geography !== "municipality") throw new ApiError(400, "INVALID_GEOGRAPHY", "municipality filtering requires geography=municipality so the result keeps its geographic meaning.");
  if (state && geography === "country") throw new ApiError(400, "INVALID_GEOGRAPHY", "state filtering requires geography=state or geography=municipality.");
  const limit = integerParam(url, "limit", 1000, 1, 5000);
  const selection: AnpFuelSelection = { fuelGroup, year, month, geography, period, state, municipality, product };
  const upstream = new URL(anpFuelCsvUrl(selection));
  const csv = await officialText(upstream, "ANP fuel-price open data", MAX_ANP_CSV_BYTES);
  let observations;
  try {
    observations = parseAnpFuelCsv(csv);
  } catch {
    throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "ANP fuel-price columns changed unexpectedly.");
  }
  if (!observations.length) throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "ANP returned no valid fuel-price observations.");
  const aggregates = aggregateAnpFuelPrices(observations, selection);
  const rows = aggregates.slice(0, limit);
  return {
    body: {
      data: rows,
      meta: {
        dataset,
        selection: { fuel_group: fuelGroup, source_window: year === null ? "latest-4-weeks" : `${year}-${String(month).padStart(2, "0")}`, geography, period, state, municipality, product },
        provenance: { source: "ANP — Levantamento de Preços de Combustíveis", upstream_url: upstream.toString(), source_url: dataset.sourceUrl, metadata_url: dataset.metadataUrl, retrieved_at: new Date().toISOString() },
        transformation: { performed_by: "Open Economics", method: "Arithmetic mean, minimum, maximum, and sample standard deviation of ANP station observations grouped by requested period, geography, product, and official unit.", excluded_source_fields: ["station name", "CNPJ", "street address", "brand"] },
        returned: rows.length,
        available: aggregates.length,
        truncated: aggregates.length > rows.length,
      },
      links: { self: url.toString(), dataset: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}`, schema: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema` },
    },
    cacheControl: "public, max-age=300, s-maxage=21600, stale-if-error=86400",
  };
}

const BRAZILIAN_STATES = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"] as const;
const BRAZILIAN_REGIONS = ["Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"] as const;

function monthOffset(period: string, offset: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function epeElectricityObservations(url: URL, dataset: NonNullable<ReturnType<typeof getOfficialDataset>>): Promise<V2RouteResult> {
  rejectUnknown(url, ["from", "to", "geography", "states", "regions", "classes", "markets", "limit"]);
  const latest = `${epeElectricityMetadata.endPeriod?.slice(0, 4)}-${epeElectricityMetadata.endPeriod?.slice(4)}`;
  const earliest = `${epeElectricityMetadata.startPeriod?.slice(0, 4)}-${epeElectricityMetadata.startPeriod?.slice(4)}`;
  const to = (url.searchParams.get("to") ?? latest).trim();
  const from = (url.searchParams.get("from") ?? monthOffset(to, -11)).trim();
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(to) || from < earliest || from > to || to > latest) {
    throw new ApiError(400, "INVALID_PERIOD", `from and to must be YYYY-MM values inside the synchronized EPE coverage (${earliest} through ${latest}), with from on or before to.`);
  }
  const geography = (enumParam(url, "geography", EPE_ELECTRICITY_GEOGRAPHIES, false) || "country") as EpeElectricitySelection["geography"];
  const states = pipeSelection(url, "states", BRAZILIAN_STATES);
  const regions = pipeSelection(url, "regions", BRAZILIAN_REGIONS);
  const classes = pipeSelection(url, "classes", EPE_ELECTRICITY_CLASSES, [...EPE_ELECTRICITY_CLASSES]) as EpeElectricitySelection["classes"];
  const markets = pipeSelection(url, "markets", EPE_ELECTRICITY_MARKETS, [...EPE_ELECTRICITY_MARKETS]) as EpeElectricitySelection["markets"];
  if (states.length && geography !== "state") throw new ApiError(400, "INVALID_GEOGRAPHY", "states filtering requires geography=state so result geography remains explicit.");
  if (regions.length && geography === "country") throw new ApiError(400, "INVALID_GEOGRAPHY", "regions filtering requires geography=region or geography=state.");
  const limit = integerParam(url, "limit", 1000, 1, 5000);
  const selection: EpeElectricitySelection = { from, to, geography, states, regions, classes, markets };
  const values = queryEpeElectricity(selection);
  const rows = values.slice(0, limit);
  return {
    body: {
      data: rows,
      meta: {
        dataset,
        selection,
        source_snapshot: epeElectricityMetadata,
        provenance: { source: "EPE — Dados do Consumo Mensal de Energia Elétrica", upstream_url: epeElectricityMetadata.sourceUrl, source_url: dataset.sourceUrl, metadata_url: dataset.metadataUrl, source_version: epeElectricityMetadata.sourceVersion, synchronized_at: epeElectricityMetadata.syncedAt },
        transformation: "Official UF/system values are summed only within identical period, requested geography, class, and market keys. No interpolation, seasonal adjustment, or class/market substitution is applied.",
        returned: rows.length,
        available: values.length,
        truncated: values.length > rows.length,
      },
      links: { self: url.toString(), dataset: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}`, schema: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema` },
    },
    cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
  };
}

async function mteFormalEmploymentObservations(url: URL, dataset: NonNullable<ReturnType<typeof getOfficialDataset>>): Promise<V2RouteResult> {
  rejectUnknown(url, ["from", "to", "breakdown", "states", "regions", "industries", "limit"]);
  const latest = `${mteFormalEmploymentMetadata.endPeriod?.slice(0, 4)}-${mteFormalEmploymentMetadata.endPeriod?.slice(4)}`;
  const earliest = `${mteFormalEmploymentMetadata.startPeriod?.slice(0, 4)}-${mteFormalEmploymentMetadata.startPeriod?.slice(4)}`;
  const to = (url.searchParams.get("to") ?? latest).trim();
  const from = (url.searchParams.get("from") ?? monthOffset(to, -11)).trim();
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(to) || from < earliest || from > to || to > latest) {
    throw new ApiError(400, "INVALID_PERIOD", `from and to must be YYYY-MM values inside the synchronized Novo Caged coverage (${earliest} through ${latest}), with from on or before to.`);
  }
  const breakdown = (enumParam(url, "breakdown", MTE_FORMAL_EMPLOYMENT_BREAKDOWNS, false) || "country") as MteFormalEmploymentSelection["breakdown"];
  const states = pipeSelection(url, "states", BRAZILIAN_STATES);
  const regions = pipeSelection(url, "regions", MTE_FORMAL_EMPLOYMENT_REGIONS);
  const industryIds = MTE_FORMAL_EMPLOYMENT_INDUSTRIES.map((industry) => industry.id);
  const industries = pipeSelection(url, "industries", industryIds);
  if (states.length && breakdown !== "state") throw new ApiError(400, "INVALID_BREAKDOWN", "states filtering requires breakdown=state.");
  if (regions.length && breakdown !== "region") throw new ApiError(400, "INVALID_BREAKDOWN", "regions filtering requires breakdown=region.");
  if (industries.length && breakdown !== "industry") throw new ApiError(400, "INVALID_BREAKDOWN", "industries filtering requires breakdown=industry.");
  const limit = integerParam(url, "limit", 1000, 1, 5000);
  const selection: MteFormalEmploymentSelection = { from, to, breakdown, states, regions, industries };
  const values = queryMteFormalEmployment(selection);
  const rows = values.slice(0, limit);
  return {
    body: {
      data: rows,
      meta: {
        dataset,
        selection,
        source_snapshot: mteFormalEmploymentMetadata,
        provenance: { source: "MTE — Novo Caged", upstream_url: mteFormalEmploymentMetadata.sourceUrl, source_url: dataset.sourceUrl, methodology_url: dataset.metadataUrl, source_version: mteFormalEmploymentMetadata.sourceVersion, source_file: mteFormalEmploymentMetadata.sourceFile, synchronized_at: mteFormalEmploymentMetadata.syncedAt },
        value_semantics: "Adjusted historical values are transcribed from the official MTE workbook without interpolation, seasonal adjustment, or cross-dimensional synthesis. Stock is a level; admissions, dismissals, and balance are monthly flows; relative_change_pct is a percent.",
        returned: rows.length,
        available: values.length,
        truncated: values.length > rows.length,
      },
      links: { self: url.toString(), dataset: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}`, schema: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema` },
    },
    cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
  };
}

async function cvmInvestmentFundObservations(url: URL, dataset: NonNullable<ReturnType<typeof getOfficialDataset>>): Promise<V2RouteResult> {
  rejectUnknown(url, ["from", "to", "breakdown", "classifications", "funds", "q", "limit"]);
  const breakdown = (enumParam(url, "breakdown", CVM_FUND_BREAKDOWNS, false) || "classification") as CvmFundSelection["breakdown"];
  const defaultTo = breakdown === "fund" ? cvmFundMetadata.sourceEndDate : cvmFundMetadata.endDate;
  const to = (url.searchParams.get("to") ?? defaultTo).trim();
  const defaultFrom = breakdown === "fund" ? cvmFundMetadata.startDate : `${monthOffset(to.slice(0, 7), -11)}-01`;
  const from = (url.searchParams.get("from") ?? defaultFrom).trim();
  const maximum = breakdown === "fund" ? cvmFundMetadata.sourceEndDate : cvmFundMetadata.endDate;
  if (!validDate(from) || !validDate(to) || from < cvmFundMetadata.startDate || from > to || to > maximum) {
    throw new ApiError(400, "INVALID_PERIOD", `from and to must be valid dates inside the synchronized CVM coverage (${cvmFundMetadata.startDate} through ${maximum}), with from on or before to.`);
  }
  const classifications = pipeSelection(url, "classifications", CVM_FUND_CLASSIFICATIONS);
  const funds = [...new Set((url.searchParams.get("funds") ?? "").split("|").map((value) => value.replace(/\D/g, "")).filter(Boolean))];
  if (funds.length > 8 || funds.some((value) => value.length !== 14)) throw new ApiError(400, "INVALID_FUNDS", "funds must contain one to eight valid CNPJ values separated by |.");
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length > 120 || (query && query.length < 2)) throw new ApiError(400, "INVALID_QUERY", "q must contain 2 to 120 characters.");
  if (classifications.length && breakdown !== "classification") throw new ApiError(400, "INVALID_BREAKDOWN", "classifications filtering requires breakdown=classification.");
  if ((funds.length || query) && breakdown !== "fund") throw new ApiError(400, "INVALID_BREAKDOWN", "funds and q filtering require breakdown=fund.");
  if (breakdown === "fund" && !funds.length && !query) throw new ApiError(400, "MISSING_FUND_SELECTION", "breakdown=fund requires funds or q so the latest-state index cannot be dumped accidentally.");
  const limit = integerParam(url, "limit", breakdown === "fund" ? 25 : 1000, 1, breakdown === "fund" ? 100 : 5000);
  const selection: CvmFundSelection = { from, to, breakdown, classifications, funds, query };
  const values = await queryCvmInvestmentFunds(selection);
  const rows = values.slice(0, limit);
  return {
    body: {
      data: rows,
      meta: {
        dataset,
        selection,
        source_snapshot: cvmFundMetadata,
        provenance: { source: "CVM — Informe Diário de Fundos de Investimento", source_url: dataset.sourceUrl, dictionary_url: dataset.metadataUrl, registry_url: cvmFundMetadata.registryPage, source_version: cvmFundMetadata.sourceVersion, synchronized_at: cvmFundMetadata.syncedAt },
        value_semantics: "Fund values are reported records. Classification values sum only additive measures over source rows sharing date and classification. Holder totals are reported accounts, not unique people; quota values remain fund-level only.",
        returned: rows.length,
        available: values.length,
        truncated: values.length > rows.length,
      },
      links: { self: url.toString(), dataset: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}`, schema: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema` },
    },
    cacheControl: "public, max-age=300, s-maxage=21600, stale-if-error=604800",
  };
}

async function tesouroRtnObservations(url: URL, dataset: NonNullable<ReturnType<typeof getOfficialDataset>>): Promise<V2RouteResult> {
  rejectUnknown(url, ["from", "to", "accounts", "q", "limit"]);
  const latest = `${tesouroRtnMetadata.endPeriod.slice(0, 4)}-${tesouroRtnMetadata.endPeriod.slice(4)}`;
  const earliest = `${tesouroRtnMetadata.startPeriod.slice(0, 4)}-${tesouroRtnMetadata.startPeriod.slice(4)}`;
  const to = (url.searchParams.get("to") ?? latest).trim();
  const from = (url.searchParams.get("from") ?? monthOffset(to, -11)).trim();
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(to) || from < earliest || from > to || to > latest) {
    throw new ApiError(400, "INVALID_PERIOD", `from and to must be YYYY-MM values inside the synchronized RTN coverage (${earliest} through ${latest}), with from on or before to.`);
  }
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length > 120 || (query && query.length < 2)) throw new ApiError(400, "INVALID_QUERY", "q must contain 2 to 120 characters.");
  const accountIds = TESOURO_RTN_ACCOUNTS.map((account) => account.id);
  const accounts = pipeSelection(url, "accounts", accountIds, query ? [] : [...TESOURO_RTN_DEFAULT_ACCOUNTS]);
  const limit = integerParam(url, "limit", 1000, 1, 5000);
  const selection: TesouroRtnSelection = { from, to, accounts, query };
  const values = queryTesouroRtn(selection);
  const rows = values.slice(0, limit);
  return {
    body: {
      data: rows,
      meta: {
        dataset,
        selection,
        source_snapshot: tesouroRtnMetadata,
        provenance: { source: "Tesouro Nacional — Resultado do Tesouro Nacional", upstream_url: tesouroRtnMetadata.sourceUrl, source_url: dataset.sourceUrl, metadata_url: tesouroRtnMetadata.metadataUrl, dictionary_url: tesouroRtnMetadata.dictionaryUrl, source_version: tesouroRtnMetadata.sourceVersion, source_file: tesouroRtnMetadata.sourceFile, table: tesouroRtnMetadata.table, synchronized_at: tesouroRtnMetadata.syncedAt },
        value_semantics: "Values are current nominal R$ millions from official RTN table 1.2. Revenue follows the cash-ingress concept; expenditure follows effective payment. Account hierarchy and above/below-the-line distinctions are preserved.",
        returned: rows.length,
        available: values.length,
        truncated: values.length > rows.length,
      },
      links: { self: url.toString(), dataset: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}`, schema: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema` },
    },
    cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
  };
}

async function tesouroDpfObservations(url: URL, dataset: NonNullable<ReturnType<typeof getOfficialDataset>>): Promise<V2RouteResult> {
  rejectUnknown(url, ["table", "from", "to", "categories", "q", "limit"]);
  const table = (enumParam(url, "table", TESOURO_DPF_TABLES, false) || "composition") as TesouroDpfSelection["table"];
  const tableMetadata = TESOURO_DPF_TABLE_METADATA[table];
  const to = (url.searchParams.get("to") ?? tableMetadata.coverage.end).trim();
  const from = (url.searchParams.get("from") ?? monthOffset(to, -11)).trim();
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(to) || from < tableMetadata.coverage.start || from > to || to > tableMetadata.coverage.end) {
    throw new ApiError(400, "INVALID_PERIOD", `from and to must be YYYY-MM values inside the selected RMD table coverage (${tableMetadata.coverage.start} through ${tableMetadata.coverage.end}), with from on or before to.`);
  }
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length > 120 || (query && query.length < 2)) throw new ApiError(400, "INVALID_QUERY", "q must contain 2 to 120 characters.");
  const categories = pipeSelection(url, "categories", tesouroDpfCategories(table).map((category) => category.id));
  const limit = integerParam(url, "limit", 1000, 1, 5000);
  const selection: TesouroDpfSelection = { table, from, to, categories, query };
  const values = await queryTesouroDpf(selection);
  const rows = values.slice(0, limit);
  return {
    body: {
      data: rows,
      meta: {
        dataset,
        selection,
        table: tableMetadata,
        source_snapshot: tesouroDpfMetadata,
        provenance: { source: "Tesouro Nacional — Relatório Mensal da Dívida Pública Federal", source_url: dataset.sourceUrl, publication_url: tesouroDpfMetadata.publicationUrl, annex_url: tesouroDpfMetadata.annexUrl, source_version: tesouroDpfMetadata.sourceVersion, source_file: tesouroDpfMetadata.sourceFile, official_sheet: tableMetadata.sheet, synchronized_at: tesouroDpfMetadata.syncedAt },
        value_semantics: "Values and units come from one selected official RMD annex table. Composition and holder tables report R$ billions plus table shares; maturity tables report years; cost tables report annualized percent rates. Missing cells are omitted, not converted to zero.",
        returned: rows.length,
        available: values.length,
        truncated: values.length > rows.length,
      },
      links: { self: url.toString(), dataset: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}`, schema: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema` },
    },
    cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
  };
}

export async function routeV2Get(request: Request): Promise<V2RouteResult | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");

  if (path === "/api/v2") {
    rejectUnknown(url, []);
    return {
      body: {
        name: "Open Economics API",
        version: "v2",
        status: "stable",
        description: "Demand-first semantic routing over official Brazilian economic data.",
        guarantees: ["concepts are resolved before catalog availability", "unsupported needs are explicit", "units, dimensions, reference periods, and provenance are preserved"],
        catalog: officialCatalogSummary,
        links: { self: url.toString(), search: `${url.origin}/api/v2/search?q=inflacao`, concepts: `${url.origin}/api/v2/concepts`, openapi: `${url.origin}/api/v2/openapi.json`, mcp: `${url.origin}/api/mcp` },
      },
    };
  }

  if (path === "/api/v2/search") return searchRoute(url);

  if (path === "/api/v2/concepts") {
    rejectUnknown(url, []);
    return { body: { data: economicConcepts(), meta: { count: economicConcepts().length, catalog_independent: true }, links: { self: url.toString() } }, cacheControl: "public, max-age=300, s-maxage=86400" };
  }

  const schemaMatch = /^\/api\/v2\/datasets\/([^/]+)\/schema$/.exec(path);
  if (schemaMatch) {
    rejectUnknown(url, []);
    const dataset = datasetOrThrow(schemaMatch[1]);
    if (dataset.provider === "bcb-sgs") {
      return {
        body: { data: await fetchBcbMetadata(dataset), meta: { dataset, provenance: { upstream_url: dataset.metadataUrl, retrieved_at: new Date().toISOString() } }, links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations` } },
        cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
      };
    }
    if (dataset.provider === "siconfi") {
      return {
        body: { data: SICONFI_SCHEMAS[dataset.upstreamId as keyof typeof SICONFI_SCHEMAS], meta: { dataset, provenance: { documentation_url: dataset.metadataUrl, retrieved_at: new Date().toISOString() } }, links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations` } },
        cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
      };
    }
    if (dataset.provider === "tesouro-rtn") {
      return {
        body: { data: TESOURO_RTN_SCHEMA, meta: { dataset, provenance: { metadata_url: tesouroRtnMetadata.metadataUrl, dictionary_url: tesouroRtnMetadata.dictionaryUrl, source_url: dataset.sourceUrl, source_snapshot: tesouroRtnMetadata } }, links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations` } },
        cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
      };
    }
    if (dataset.provider === "tesouro-dpf") {
      return {
        body: { data: TESOURO_DPF_SCHEMA, meta: { dataset, provenance: { source_url: dataset.sourceUrl, publication_url: tesouroDpfMetadata.publicationUrl, annex_url: tesouroDpfMetadata.annexUrl, source_snapshot: tesouroDpfMetadata } }, links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations` } },
        cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
      };
    }
    if (dataset.provider === "comexstat") {
      return {
        body: { data: COMEXSTAT_SCHEMA, meta: { dataset, provenance: { documentation_url: dataset.metadataUrl, retrieved_at: new Date().toISOString() } }, links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations` } },
        cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
      };
    }
    if (dataset.provider === "anp") {
      return {
        body: { data: ANP_FUEL_SCHEMA, meta: { dataset, provenance: { documentation_url: dataset.metadataUrl, source_url: dataset.sourceUrl, retrieved_at: new Date().toISOString() } }, links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations` } },
        cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
      };
    }
    if (dataset.provider === "epe") {
      return {
        body: { data: EPE_ELECTRICITY_SCHEMA, meta: { dataset, provenance: { documentation_url: dataset.metadataUrl, source_url: dataset.sourceUrl, source_snapshot: epeElectricityMetadata } }, links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations` } },
        cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
      };
    }
    if (dataset.provider === "mte") {
      return {
        body: { data: MTE_FORMAL_EMPLOYMENT_SCHEMA, meta: { dataset, provenance: { methodology_url: dataset.metadataUrl, source_url: dataset.sourceUrl, source_snapshot: mteFormalEmploymentMetadata } }, links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations` } },
        cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
      };
    }
    if (dataset.provider === "cvm") {
      return {
        body: { data: CVM_INVESTMENT_FUNDS_SCHEMA, meta: { dataset, provenance: { dictionary_url: dataset.metadataUrl, source_url: dataset.sourceUrl, registry_url: cvmFundMetadata.registryPage, source_snapshot: cvmFundMetadata } }, links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations` } },
        cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
      };
    }
    const upstream = new URL(dataset.metadataUrl);
    return {
      body: { data: await officialJson(upstream, "IBGE"), meta: { dataset, provenance: { upstream_url: upstream.toString(), retrieved_at: new Date().toISOString() } }, links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations` } },
      cacheControl: "public, max-age=300, s-maxage=86400, stale-if-error=604800",
    };
  }

  const observationsMatch = /^\/api\/v2\/datasets\/([^/]+)\/observations$/.exec(path);
  if (observationsMatch) {
    const dataset = datasetOrThrow(observationsMatch[1]);
    return dataset.provider === "bcb-sgs"
      ? bcbObservations(url, dataset)
      : dataset.provider === "siconfi"
        ? siconfiObservations(url, dataset)
      : dataset.provider === "tesouro-rtn"
        ? tesouroRtnObservations(url, dataset)
      : dataset.provider === "tesouro-dpf"
        ? tesouroDpfObservations(url, dataset)
        : dataset.provider === "comexstat"
          ? comexstatObservations(url, dataset)
        : dataset.provider === "anp"
          ? anpFuelObservations(url, dataset)
        : dataset.provider === "epe"
          ? epeElectricityObservations(url, dataset)
        : dataset.provider === "mte"
          ? mteFormalEmploymentObservations(url, dataset)
        : dataset.provider === "cvm"
          ? cvmInvestmentFundObservations(url, dataset)
        : ibgeObservations(url, dataset);
  }

  const datasetMatch = /^\/api\/v2\/datasets\/([^/]+)$/.exec(path);
  if (datasetMatch) {
    rejectUnknown(url, []);
    const dataset = datasetOrThrow(datasetMatch[1]);
    const stableIndicators = indicators.filter((indicator) => indicator.provider === dataset.provider && String(indicator.upstream.seriesCode ?? indicator.upstream.aggregate) === dataset.upstreamId).map((indicator) => indicator.id);
    return {
      body: {
        data: { ...dataset, stableIndicatorIds: stableIndicators },
        meta: { catalog_synced_at: officialCatalogSummary.syncedAt, provenance: { catalog_source: dataset.provider === "siconfi" ? officialCatalogSummary.provenance.siconfi : dataset.provider === "tesouro-rtn" ? officialCatalogSummary.provenance.tesouro_rtn : dataset.provider === "tesouro-dpf" ? officialCatalogSummary.provenance.tesouro_dpf : dataset.provider === "comexstat" ? officialCatalogSummary.provenance.comexstat : dataset.provider === "anp" ? officialCatalogSummary.provenance.anp : dataset.provider === "epe" ? officialCatalogSummary.provenance.epe : dataset.provider === "mte" ? officialCatalogSummary.provenance.mte : dataset.provider === "cvm" ? officialCatalogSummary.provenance.cvm : officialCatalogSummary.provenance[dataset.sourceAgency.toLowerCase() as "bcb" | "ibge"] } },
        links: { self: url.toString(), observations: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/observations`, schema: `${url.origin}/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema` },
      },
    };
  }

  return null;
}
