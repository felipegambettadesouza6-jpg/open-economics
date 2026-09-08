# Open Economics API

A free, read-only semantic routing layer for authoritative Brazilian economic data.

- **Semantic API:** https://open-economics-data.knbf982hkn.chatgpt.site/api/v2
- **Stable series API:** https://open-economics-data.knbf982hkn.chatgpt.site/api/v1
- **MCP:** https://open-economics-data.knbf982hkn.chatgpt.site/api/mcp
- **Documentation:** https://open-economics-data.knbf982hkn.chatgpt.site/en/docs
- **Runnable examples:** https://open-economics-data.knbf982hkn.chatgpt.site/en/guides
- **Source and issue tracker:** https://github.com/felipegambettadesouza6-jpg/open-economics
- **Reliability policy:** [RELIABILITY.md](./RELIABILITY.md)
- **2.0 release evidence:** [benchmarks/RELEASE-READINESS.md](./benchmarks/RELEASE-READINESS.md)
- **Contributing:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Security:** [SECURITY.md](./SECURITY.md)

**[Try the API in the browser →](https://open-economics-data.knbf982hkn.chatgpt.site/en/playground?utm_source=github&utm_medium=repository&utm_campaign=github-repo)**

Open Economics 2.0 starts with a real economic-information need, resolves its
meaning independently of current coverage, and then routes it to official data.
Its synchronized catalog currently exposes 12,875 BCB SGS series and IBGE
aggregates, plus direct SICONFI fiscal-report, MDIC Comex Stat, and ANP
fuel-price access and versioned EPE electricity-consumption, MTE Novo Caged,
CVM investment-fund, Tesouro RTN fiscal, and RMD Federal Public Debt data (12,886 official datasets in total). The 32 convenient v1
series IDs remain compatible.

Discovery, REST, the existing product, and MCP share one semantic core. A
resolved concept is kept separate from availability, so an unsupported need is
reported explicitly instead of being silently mapped to a nearby series. Units,
dimensions, reference periods, source identifiers, raw values, methodology
links, and retrieval provenance travel with the data.

## Start with the economic need

```bash
curl --fail --silent \
  "https://open-economics-data.knbf982hkn.chatgpt.site/api/v2/search?q=desemprego%20desde%202015"

curl --fail --silent \
  "https://open-economics-data.knbf982hkn.chatgpt.site/api/v2/datasets/ibge-aggregates%3A6381/schema"
```

For BCB, `/api/v2/datasets/bcb-sgs:{code}/observations` provides direct series
access with authoritative frequency, unit, source, coverage, formula, and
warning metadata. For IBGE, inspect `/schema`, then send explicit `variable`,
`periods`, `locality`, and `classification` selections to `/observations`.
SICONFI DCA, RREO, and RGF use the same dataset routes while retaining entity,
reporting period, annex, account, column, and raw value. Official
multidimensional structure is preserved instead of flattened away.
Comex Stat preserves trade-flow dimensions and metrics. ANP fuel-price queries
return period/geography/product aggregates calculated from official station
observations, with source counts and the transformation disclosed while station
identity and address fields are excluded. EPE and MTE serve compact, versioned
snapshots of official workbooks: electricity retains geography/class/market,
while adjusted Novo Caged stock and flows retain their separate national,
region/state, or economic-activity breakdowns. CVM daily fund reports retain
fund/class identity and quota values; classification aggregates sum only
additive measures and identify incomplete filing dates. RTN retains its monthly
account hierarchy and above-the-line cash/effective-payment conventions. RMD
debt statistics keep composition, holder, maturity, and cost tables separate,
with their official units, definitions, and publication vintage.

## When to use Open Economics

If you already know the exact official identifier and source contract, calling
the publisher directly remains the shortest path. Open Economics is useful when
the need starts in human language, spans publisher conventions, requires
explicit dimensions, or must retain one consistent provenance and error model.

## One contract across official sources

The same observation envelope can retrieve BCB IBC-Br (SGS 24363) and IBGE real
GDP growth (SIDRA 5932/6561), without maintaining two date and response parsers:

```bash
curl --fail --silent "https://open-economics-data.knbf982hkn.chatgpt.site/api/v1/indicators/br-ibc-br/observations?start=2024-01-01"
curl --fail --silent "https://open-economics-data.knbf982hkn.chatgpt.site/api/v1/indicators/br-gdp-real-yoy/observations?start=2024-01-01"
```

The runnable [multi-source Python example](./examples/multi_source_python.py)
uses both series and prints their official provenance and freshness state.

## Start with the catalog

```bash
curl --fail --silent "https://open-economics-data.knbf982hkn.chatgpt.site/api/v1"
curl --fail --silent "https://open-economics-data.knbf982hkn.chatgpt.site/api/v1/indicators?q=ipca&source=ibge"
curl --fail --silent "https://open-economics-data.knbf982hkn.chatgpt.site/api/v1/indicators/br-ipca-monthly"
```

`GET /api/v1/indicators` is the discovery endpoint. Its
`meta.available_filters` field lists every canonical `category`, `frequency`,
and `source` value. It accepts:

| Parameter | Meaning |
| --- | --- |
| `q` | Case-insensitive search across IDs, names, aliases, and official codes |
| `category` | A canonical category ID such as `inflation` or `interest-rates` |
| `frequency` | `daily`, `monthly`, `quarterly`, or `annual` |
| `source` | `bcb` or `ibge` |
| `limit` | 1–500, default 100 |

Invalid filters are rejected with a structured problem response; they never
silently become an empty result set.

## Retrieve a series

```bash
curl --fail --silent \
  "https://open-economics-data.knbf982hkn.chatgpt.site/api/v1/indicators/br-ipca-monthly/observations?start=2024-01-01&end=2024-12-31"

curl --fail --silent \
  "https://open-economics-data.knbf982hkn.chatgpt.site/api/v1/indicators/br-selic-target/observations?start=2025-01-01&order=desc&limit=12"

curl --fail --silent \
  "https://open-economics-data.knbf982hkn.chatgpt.site/api/v1/indicators/br-selic-target/latest"
```

Observation requests accept `start`, `end`, `order=asc|desc`, `limit=1..5000`,
and `format=json|csv`. Dates use `YYYY-MM-DD` and `end` cannot be in the
future. Daily BCB requests are limited to ten years because SGS applies the
same upstream limit.

All JSON series responses use the same envelope:

```json
{
  "data": [
    {
      "date": "2024-01-01",
      "period": "2024-01",
      "source_date": "202401",
      "value": 0.42,
      "raw_value": "0.42",
      "status": "observed"
    }
  ],
  "meta": {
    "indicator": { "id": "br-ipca-monthly", "unit_symbol": "%" },
    "provenance": { "upstream_url": "…", "retrieved_at": "…" },
    "returned": 1,
    "available": 1,
    "truncated": false
  }
}
```

`date` is the normalized start date for the reference period; `period` is the
frequency-aware identifier (`YYYY-MM-DD`, `YYYY-MM`, `YYYY-QN`, or `YYYY`).
`source_date` and `raw_value` are retained exactly from the official publisher.
Read `meta.indicator.date_semantics` before interpreting stock, flow, or
moving-quarter series.

Use `format=csv` for a flat download. CSV rows repeat `indicator_id`,
`source_id`, `source_url`, and `upstream_url`, so exported values retain their
provenance outside the JSON envelope.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1` | Machine-readable API discovery |
| `GET /api/v1/indicators` | Search and filter the indicator catalog |
| `GET /api/v1/indicators/:id` | Full indicator metadata, units, semantics, and links |
| `GET /api/v1/indicators/:id/observations` | Normalized historical values |
| `GET /api/v1/indicators/:id/latest` | Latest available observation |
| `GET /api/v1/sources` | Publisher, attribution, and license metadata |
| `GET /api/v1/openapi.json` | OpenAPI 3.1 description |
| `GET /api/v1/health` | Router and catalog readiness (does not call publishers) |

All endpoints support CORS and `GET`, `HEAD`, and `OPTIONS`. Successful and
error responses include `X-Request-Id`; browser clients can also read cache,
timing, and stale-response headers.

## Errors and freshness

Errors use `application/problem+json` with a stable `code`, HTTP `status`,
human-readable `title`, explanatory `detail`, and `request_id`. Common cases
include `INVALID_DATE`, `INVALID_CATEGORY`, `INDICATOR_NOT_FOUND`,
`UPSTREAM_CONNECTION_ERROR`, and `UPSTREAM_TIMEOUT`.

The API caches successfully normalized source responses in D1 when configured.
If a refresh fails and a previous matching snapshot exists, it is returned with
`meta.stale: true`, `meta.cache: "stale"`, and HTTP `Warning: 110`. A cache
read or write failure is treated as a cache bypass, never as a data failure.

The service is currently best-effort and has no uptime SLA. See
[RELIABILITY.md](./RELIABILITY.md) for the explicit availability, freshness,
change-management, and incident-reporting policy.

## Sources and correctness

- **IBGE Aggregates/SIDRA**: prices, GDP, industry, retail, services, labor.
  The adapter requests the exact official period IDs required for each query;
  IBGE zero, suppression, availability, and quality symbols keep distinct
  `status` values.
- **BCB SGS**: rates, FX, activity, credit, fiscal, external-sector, and
  commodity series. Rows are normalized, sorted, and de-duplicated because
  upstream ordering is not guaranteed.
- **Tesouro Nacional / SICONFI**: annual accounts, budget execution, fiscal
  limits, personnel spending, debt, and the government-entity registry.
- **Tesouro Nacional / RTN**: monthly current-value Government Central revenue,
  transfers, expenditure, and fiscal-result accounts from 1997 onward, in the
  official hierarchy and R$ million unit.
- **Tesouro Nacional / RMD**: monthly Federal Public Debt composition, DPMFi
  holders, average maturity, and cost. Each official table keeps its own unit,
  coverage, definitions, footnotes, and publication vintage.
- **MDIC / Comex Stat**: exports and imports by product, partner, state,
  transport mode, customs office, and international classifications.
- **ANP / Levantamento de Preços de Combustíveis**: rolling four-week or
  monthly fuel and GLP station observations, aggregated by explicit period,
  product, and geography with calculation provenance.
- **EPE / Consumo Mensal de Energia Elétrica**: monthly consumption and
  consumer counts from 2004 onward by UF, region, class, and captive/free
  market, with the official workbook version attached.
- **MTE / Novo Caged**: adjusted monthly employment stock, admissions,
  dismissals, balance, and relative change from 2020 onward by national total,
  region/state, or economic activity, with the exact official workbook vintage
  attached and incompatible table dimensions kept separate.
- **CVM / Informe Diário de Fundos**: daily portfolio value, net assets,
  subscriptions, redemptions, quota values, and reported holders. Queries can
  compare official classifications or resolve a latest fund/class report by
  CNPJ or name; quota values are never aggregated and holder totals are not
  represented as unique people.

There are 32 curated indicators across inflation, interest rates, currencies,
activity, labor, credit, fiscal, external, and markets. Values are never
fabricated, forward-filled, or silently sign-inverted. BCB NFSP fiscal series
retain BCB's financing-requirement sign convention.

BCB catalog data is published under ODbL; preserve its attribution and
share-alike obligations when distributing adapted databases. Attribute IBGE as
IBGE/SIDRA and retain its source links and terms. Each indicator response has
the authoritative URLs and license applicable to that series.

## Run locally

Node.js 22.13+ is required.

```bash
npm install
npm run dev
npm run lint
npm test
npm run catalog:epe-sync
npm run catalog:mte-sync
npm run catalog:cvm-sync
npm run catalog:rtn-sync
npm run catalog:dpf-sync
```

Examples are available in [examples/python.py](./examples/python.py),
[examples/multi_source_python.py](./examples/multi_source_python.py), and
[examples/javascript.mjs](./examples/javascript.mjs). The D1 migration in
`drizzle/` is the deployment record for cache snapshots.

## License

The API implementation is released under the [MIT License](./LICENSE).
Upstream data remains governed by each publisher's own terms and licenses.
