# Open Economics API

A free, open, developer-friendly API for authoritative Brazilian economic data.

Open Economics turns public time series from Brazil's official institutions into one coherent, documented interface. It preserves source identity, original values, units, reference periods, licenses, and transformations rather than hiding them behind a generic schema.

## What ships in v1

- 32 curated indicators across inflation, rates, FX, activity, labor, credit, fiscal, external-sector, and commodity themes.
- First-party adapters for IBGE Aggregates/SIDRA and Banco Central do Brasil (BCB) SGS.
- A public API with JSON, CSV, CORS, strict query validation, OpenAPI 3.1, RFC-style problem responses, and request IDs.
- A searchable catalog, individual indicator pages with real historical charts, complete source metadata, an interactive API playground, status checks, and developer documentation.
- D1-backed last-known-good response snapshots. When an upstream refresh fails, the API marks a cached response as stale instead of inventing a number.

## Quickstart

Browse the catalog:

```bash
curl --fail --silent "http://localhost:3000/api/v1/indicators?q=ipca&source=IBGE"
```

Request observations:

```bash
curl --fail --silent \
  "http://localhost:3000/api/v1/indicators/br-ipca-monthly/observations?start=2024-01-01&end=2024-12-31"
```

Download the same request as CSV:

```bash
curl --fail --silent \
  "http://localhost:3000/api/v1/indicators/br-selic-target/observations?start=2025-01-01&format=csv"
```

The interactive version is available at `/playground`.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1` | API discovery |
| `GET /api/v1/indicators` | Search the catalog |
| `GET /api/v1/indicators/:id` | Indicator metadata |
| `GET /api/v1/indicators/:id/observations` | Time-series observations |
| `GET /api/v1/indicators/:id/latest` | Latest observation |
| `GET /api/v1/sources` | Publisher and license metadata |
| `GET /api/v1/openapi.json` | OpenAPI 3.1 document |
| `GET /api/v1/health` | Router and catalog readiness |

Observation requests accept `start`, `end`, `order`, `limit`, and `format=json|csv`. Unknown query parameters are rejected. Daily BCB requests are capped at ten years, which mirrors the current official SGS constraint.

## Data provenance

The first release uses two official sources:

- **IBGE / SIDRA** for IPCA and INPC, GDP, industry, retail, services, unemployment, earnings, and informality.
- **Banco Central do Brasil** for rates, USD/BRL, IBC-Br, credit, public debt, fiscal balances, balance-of-payments data, direct investment, reserves, and the IC-Br commodity index.

Every response contains:

- a stable Open Economics indicator ID and the official Portuguese series name;
- source agency, upstream series/table identifiers, official metadata URL, and license/terms;
- original publisher value in `raw_value`, normalized `value`, reference `period`, and `source_date`;
- retrieval timestamp, normalized upstream URL, cache state, and stale flag;
- named transformations. Version 1's source series use no hidden transformations.

BCB catalog data is published under ODbL; preserve required attribution and share-alike obligations for adapted databases. IBGE data remains attributed to IBGE/SIDRA and links to its official terms. See the in-product [attribution guidance](/docs/attribution).

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm test
```

Generate a D1 migration after modifying the schema:

```bash
npm run db:generate
```

The Sites manifest declares a logical `DB` binding. The Worker creates the snapshot table defensively for local development; the generated migration in `drizzle/` is the deployment record.

## Data correctness policy

- Values are never fabricated, forward-filled, or silently transformed.
- BCB rows are sorted and deduplicated locally because upstream ordering varies.
- IBGE availability, suppression, and zero symbols retain distinct observation statuses.
- Quarterly IBGE keys are interpreted as quarters, not months.
- BCB NFSP fiscal series retain the publisher's financing-requirement sign convention.
- Historical series may be revised by publishers; snapshots are refreshed rather than treated as append-only.

## License

The Open Economics API implementation is released under the [MIT License](./LICENSE). Upstream data remains governed by the publisher's own terms and licenses.

