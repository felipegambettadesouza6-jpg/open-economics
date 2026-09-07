export function createOpenApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Open Economics API",
      version: "1.0.0",
      summary: "A consistent interface for authoritative Brazilian economic data.",
      description:
        "Free, read-only economic time series with a shared catalog, normalized time fields, explicit units, and source-level provenance. Data remains attributable to each official publisher.",
      license: {
        name: "API code: MIT. Data: upstream licenses apply.",
      },
      contact: {
        name: "Open Economics maintainers",
        url: "https://github.com/felipegambettadesouza6-jpg/open-economics/issues",
      },
    },
    externalDocs: {
      description: "Documentation, source code, and reliability policy",
      url: "https://github.com/felipegambettadesouza6-jpg/open-economics",
    },
    servers: [{ url: `${origin}/api/v1`, description: "Current deployment" }],
    tags: [
      { name: "Catalog", description: "Discover indicators and their metadata." },
      { name: "Series", description: "Retrieve normalized observations." },
      { name: "Sources", description: "Review publisher provenance and licenses." },
      { name: "System", description: "API discovery and health." },
    ],
    paths: {
      "/": {
        get: {
          tags: ["System"],
          summary: "API discovery",
          responses: { "200": { description: "API links and version." } },
        },
      },
      "/indicators": {
        get: {
          tags: ["Catalog"],
          summary: "List and search indicators",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, description: "Name, alias, ID, acronym, or upstream code." },
            { name: "category", in: "query", schema: { type: "string" }, description: "Canonical category ID. The response lists supported filters." },
            { name: "frequency", in: "query", schema: { enum: ["daily", "monthly", "quarterly", "annual"] } },
            { name: "source", in: "query", schema: { enum: ["bcb", "ibge"] } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } },
          ],
          responses: {
            "200": {
              description: "Indicator catalog.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/CatalogResponse" } } },
            },
            "400": { $ref: "#/components/responses/Problem" },
          },
        },
      },
      "/indicators/{id}": {
        get: {
          tags: ["Catalog"],
          summary: "Get indicator metadata",
          parameters: [{ $ref: "#/components/parameters/IndicatorId" }],
          responses: {
            "200": { description: "Indicator metadata." },
            "404": { $ref: "#/components/responses/Problem" },
          },
        },
      },
      "/indicators/{id}/observations": {
        get: {
          tags: ["Series"],
          summary: "Get normalized observations",
          parameters: [
            { $ref: "#/components/parameters/IndicatorId" },
            { name: "start", in: "query", schema: { type: "string", format: "date" } },
            { name: "end", in: "query", schema: { type: "string", format: "date" } },
            { name: "order", in: "query", schema: { enum: ["asc", "desc"], default: "asc" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 5000, default: 5000 } },
            { name: "format", in: "query", schema: { enum: ["json", "csv"], default: "json" } },
          ],
          responses: {
            "200": {
              description: "Observations and complete provenance metadata. `date` is the normalized start date of the reference period; `period` is the frequency-aware canonical period identifier.",
              headers: {
                "X-Request-Id": { schema: { type: "string" } },
                Warning: { schema: { type: "string" }, description: "Present when a stale snapshot is served." },
              },
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/SeriesResponse" } },
                "text/csv": { schema: { type: "string" } },
              },
            },
            "400": { $ref: "#/components/responses/Problem" },
            "404": { $ref: "#/components/responses/Problem" },
            "502": { $ref: "#/components/responses/Problem" },
            "503": { $ref: "#/components/responses/Problem" },
          },
        },
      },
      "/indicators/{id}/latest": {
        get: {
          tags: ["Series"],
          summary: "Get the latest available observation",
          parameters: [{ $ref: "#/components/parameters/IndicatorId" }],
          responses: {
            "200": { description: "Latest observation with provenance." },
            "404": { $ref: "#/components/responses/Problem" },
          },
        },
      },
      "/sources": {
        get: {
          tags: ["Sources"],
          summary: "List upstream publishers",
          responses: { "200": { description: "Source and license metadata." } },
        },
      },
      "/openapi.json": {
        get: {
          tags: ["System"],
          summary: "OpenAPI 3.1 document",
          responses: { "200": { description: "This API description." } },
        },
      },
      "/health": {
        get: {
          tags: ["System"],
          summary: "Check API and catalog readiness",
          responses: { "200": { description: "Readiness state without upstream calls." } },
        },
      },
    },
    components: {
      parameters: {
        IndicatorId: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", pattern: "^br-[a-z0-9-]+$" },
        },
      },
      responses: {
        Problem: {
          description: "RFC 9457 problem detail.",
          content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } },
        },
      },
      schemas: {
        Observation: {
          type: "object",
          required: ["date", "period", "source_date", "value", "status"],
          properties: {
            date: { type: "string", format: "date" },
            period: { type: "string", examples: ["2026-08-20", "2026-07", "2026-Q1"] },
            source_date: { type: "string", description: "Original period/date identifier exactly as returned by the official source." },
            value: { type: ["number", "null"] },
            raw_value: { type: "string" },
            status: {
              enum: ["observed", "absolute-zero", "rounded-zero", "suppressed", "not-applicable", "unavailable", "quality-flag", "missing"],
            },
          },
        },
        Indicator: {
          type: "object",
          required: ["id", "name", "country", "frequency", "unit", "source_agency"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            official_name: { type: "string" },
            description: { type: "string" },
            country: { const: "BR" },
            category: { type: "string" },
            frequency: { enum: ["daily", "monthly", "quarterly", "annual"] },
            unit: { type: "string" },
            source_agency: { enum: ["BCB", "IBGE"] },
          },
        },
        CatalogResponse: {
          type: "object",
          required: ["data", "meta", "links"],
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Indicator" } },
            meta: { type: "object" },
            links: { type: "object" },
          },
        },
        SeriesResponse: {
          type: "object",
          required: ["data", "meta", "links"],
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Observation" } },
            meta: { type: "object" },
            links: { type: "object" },
          },
        },
        Problem: {
          type: "object",
          required: ["type", "title", "status", "code", "request_id"],
          properties: {
            type: { type: "string", format: "uri" },
            title: { type: "string" },
            status: { type: "integer" },
            detail: { type: "string" },
            code: { type: "string" },
            request_id: { type: "string" },
          },
        },
      },
    },
  };
}

export function createV2OpenApiDocument(origin: string) {
  const datasetId = {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string", pattern: "^(?:(?:bcb-sgs|ibge-aggregates):[0-9]+|siconfi:(?:rreo|rgf|dca|entes)|tesouro-rtn:government-central|tesouro-dpf:debt-profile|comexstat:general|anp:fuel-prices|epe:electricity-consumption|mte:formal-employment|cvm:investment-funds)$" },
    description: "Stable provider-qualified official dataset ID returned by semantic search.",
  };
  const problem = { description: "RFC 9457 problem detail.", content: { "application/problem+json": { schema: { type: "object" } } } };
  return {
    openapi: "3.1.0",
    info: {
      title: "Open Economics Semantic API",
      version: "2.0.0",
      summary: "Resolve real Brazilian economic-information needs to official data without losing meaning or provenance.",
      description: "Demand-first concept routing over official catalogs. A resolved concept is kept separate from data availability, scalar BCB series remain direct, IBGE measures and dimensions are selected explicitly, SICONFI fiscal reports retain their accounting structure, RTN retains Government Central account hierarchy, RMD keeps Federal Public Debt tables and units distinct, Comex Stat retains trade flows and classifications, ANP fuel prices retain source counts and aggregation provenance, EPE electricity data retains period, geography, class, market, measure, and source version, MTE Novo Caged data retains adjusted stock/flow meaning, breakdown, and source vintage, and CVM fund reports retain fund/class identity and non-additive quota semantics.",
      license: { name: "API code: MIT. Data: upstream licenses apply." },
    },
    servers: [{ url: `${origin}/api/v2`, description: "Current deployment" }],
    tags: [
      { name: "Discovery", description: "Resolve needs before selecting datasets." },
      { name: "Datasets", description: "Inspect official identity and schema." },
      { name: "Data", description: "Query direct or multidimensional official data." },
      { name: "System", description: "API discovery and machine-readable contract." },
    ],
    paths: {
      "/": { get: { tags: ["System"], summary: "Discover the v2 API", responses: { "200": { description: "Version, guarantees, catalog counts, and links." } } } },
      "/search": { get: { tags: ["Discovery"], summary: "Resolve an economic-information need", description: "Returns concepts, confidence, ranked official datasets, availability, missing source integrations, and explicit abstention. It never substitutes a nearby dataset for an unresolved need.", parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 300 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 25, default: 10 } }], responses: { "200": { description: "Semantic resolution and official dataset candidates." }, "400": problem } } },
      "/concepts": { get: { tags: ["Discovery"], summary: "List the catalog-independent economic concept taxonomy", responses: { "200": { description: "Economic concepts, sources, frequencies, and expected dimensions." } } } },
      "/datasets/{id}": { get: { tags: ["Datasets"], summary: "Describe an official dataset", parameters: [datasetId], responses: { "200": { description: "Identity, publisher, collection, provenance links, capability, and stable-series shortcuts." }, "404": problem } } },
      "/datasets/{id}/schema": { get: { tags: ["Datasets"], summary: "Get authoritative source schema and semantics", parameters: [datasetId], responses: { "200": { description: "BCB unit/frequency/coverage metadata, IBGE measures/dimensions metadata, SICONFI fiscal-report selections, RTN accounts, RMD debt tables, Comex Stat trade dimensions, ANP fuel-price transformations, EPE electricity dimensions, MTE employment measures, or CVM fund-report constraints." }, "404": problem, "502": problem } } },
      "/datasets/{id}/observations": { get: { tags: ["Data"], summary: "Query official observations", description: "Provider-specific selection contract; inspect /schema first. RTN requires account selections, RMD requires one table, and CVM separates classification aggregates from fund-level latest reports. Responses preserve raw fields or explicitly disclose transformations and provenance.", parameters: [datasetId, { name: "start", in: "query", schema: { type: "string", format: "date" } }, { name: "end", in: "query", schema: { type: "string", format: "date" } }, { name: "variable", in: "query", schema: { type: "string" } }, { name: "periods", in: "query", schema: { type: "string", default: "-12" } }, { name: "locality", in: "query", schema: { type: "string", default: "BR" } }, { name: "classification", in: "query", schema: { type: "string" } }, { name: "year", in: "query", schema: { type: "integer" }, description: "SICONFI reporting year, or ANP monthly archive year (with month)." }, { name: "entity", in: "query", schema: { type: "integer" }, description: "SICONFI IBGE entity code." }, { name: "period", in: "query", schema: { oneOf: [{ type: "integer" }, { enum: ["week", "month"] }] }, description: "SICONFI report period, or ANP aggregation period." }, { name: "periodicity", in: "query", schema: { enum: ["Q", "S"] }, description: "RGF periodicity." }, { name: "report_type", in: "query", schema: { type: "string" } }, { name: "power", in: "query", schema: { enum: ["E", "L", "J", "M", "D"] } }, { name: "sphere", in: "query", schema: { enum: ["M", "E", "U", "C"] } }, { name: "annex", in: "query", schema: { type: "string", maxLength: 100 } }, { name: "flow", in: "query", schema: { enum: ["export", "import"] }, description: "Comex Stat trade flow." }, { name: "from", in: "query", schema: { oneOf: [{ type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" }, { type: "string", format: "date" }] } }, { name: "to", in: "query", schema: { oneOf: [{ type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" }, { type: "string", format: "date" }] } }, { name: "table", in: "query", schema: { enum: ["composition", "holders", "average-maturity", "average-maturity-by-indexer", "monthly-cost", "twelve-month-cost"] }, description: "Required semantic table boundary for RMD debt statistics." }, { name: "accounts", in: "query", schema: { type: "string" }, description: "RTN account IDs separated by |." }, { name: "categories", in: "query", schema: { type: "string" }, description: "RMD category IDs separated by |." }, { name: "q", in: "query", schema: { type: "string", minLength: 2, maxLength: 120 }, description: "RTN account, RMD category, or CVM fund-name search." }, { name: "funds", in: "query", schema: { type: "string" }, description: "CVM fund CNPJ values separated by |." }, { name: "classifications", in: "query", schema: { type: "string" }, description: "CVM classifications separated by |." }, { name: "month_detail", in: "query", schema: { type: "boolean", default: true } }, { name: "details", in: "query", schema: { type: "string" }, description: "Comex Stat detail fields separated by |." }, { name: "metrics", in: "query", schema: { type: "string", default: "metricFOB" }, description: "Comex Stat metric IDs separated by |." }, { name: "filters", in: "query", schema: { type: "string" }, description: "URL-encoded JSON array of official Comex Stat filter objects." }, { name: "language", in: "query", schema: { enum: ["pt", "en", "es"], default: "pt" } }, { name: "fuel_group", in: "query", schema: { enum: ["gasoline-ethanol", "diesel-gnv", "glp"] }, description: "Required ANP source family." }, { name: "month", in: "query", schema: { type: "integer", minimum: 1, maximum: 12 }, description: "ANP monthly archive month (with year); omit both for latest four weeks." }, { name: "geography", in: "query", schema: { enum: ["country", "region", "state", "municipality"], default: "country" } }, { name: "breakdown", in: "query", schema: { enum: ["country", "region", "state", "industry", "classification", "fund"] }, description: "MTE or CVM result breakdown; inspect /schema for valid values." }, { name: "state", in: "query", schema: { type: "string", pattern: "^[A-Za-z]{2}$" } }, { name: "states", in: "query", schema: { type: "string" }, description: "EPE or MTE UF codes separated by |." }, { name: "regions", in: "query", schema: { type: "string" }, description: "EPE or MTE region names separated by |." }, { name: "industries", in: "query", schema: { type: "string" }, description: "MTE official activity IDs separated by |; inspect the dataset schema first." }, { name: "classes", in: "query", schema: { type: "string" }, description: "EPE consumption classes separated by |." }, { name: "markets", in: "query", schema: { type: "string" }, description: "EPE market environments separated by |." }, { name: "municipality", in: "query", schema: { type: "string", maxLength: 100 } }, { name: "product", in: "query", schema: { type: "string", maxLength: 100 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 5000 } }], responses: { "200": { description: "Official data with meaning and provenance." }, "400": problem, "404": problem, "502": problem, "503": problem } } },
      "/openapi.json": { get: { tags: ["System"], summary: "OpenAPI 3.1 document", responses: { "200": { description: "This API description." } } } },
    },
  };
}
