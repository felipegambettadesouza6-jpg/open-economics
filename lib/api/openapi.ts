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
