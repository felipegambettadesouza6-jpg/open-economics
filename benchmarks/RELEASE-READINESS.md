# Open Economics 2.0 release readiness

Assessment date: 2026-09-07

## Decision

**Release candidate: GO after production deployment and post-deploy smoke tests.**

The current product fulfills the 2.0 promise across a broad, useful portion of
Brazilian economic-data demand. The remaining gaps are visible and safely
abstained from; none warrants delaying release for another source integration.

## Demand coverage

The independent benchmark contains 696 realistic tasks over 96 economic
concepts. Query-ready means that the correct concept is ranked first and the
response exposes a verified retrieval contract, not merely publisher metadata.

- Demand-weighted query-ready coverage: **81.71%**
- Raw query-ready tasks: **533 / 696 (76.58%)**
- Concepts query-ready across every benchmark workflow: **53 / 96**
- Concepts with an integrated authoritative source: **87 / 96**
- Demand-weighted unserved share: **18.29%**

The stricter concept score prevents one successful phrasing from making a
partially implemented concept look complete.

## Discovery and dataset selection

- Full benchmark top-1 concept accuracy: **99.56%**
- Full benchmark top-3 concept accuracy: **100%**
- Independently written holdout top-1: **97.74%**
- Holdout top-3: **100%**
- Verified last-mile dataset selection: **35 / 35 top-1**
- Unsupported-demand safe non-substitution: **100%**

The v1 reference covered 23 of 96 concepts with 28.83% weighted concept
coverage. Its strongest local lexical experiment reached 25.39% overall top-1.
The v2 result therefore reflects a product-level capability change rather than
catalog growth alone.

## Unsupported demand

Nine concepts have no integrated authoritative source. Together they represent
5.48% of demand weight:

- terms of trade;
- listed-company financial statements;
- public offerings;
- capital-market investor participation;
- electricity generation;
- oil and natural-gas production;
- the national energy balance;
- deforestation;
- greenhouse-gas emissions.

Additional unserved tasks concern last-mile validation or selection inside an
already connected generic catalog. They remain `source-not-integrated` or
`unresolved`; the router does not substitute a nearby series.

## Federal Public Debt integration

The Tesouro Nacional RMD integration is complete and query-ready:

- six official annex tables remain separate: composition, DPMFi holders,
  average maturity, maturity by indexer, monthly cost, and twelve-month cost;
- 22,286 monthly observations cover the selected tables from 1999-12 through
  2026-07;
- BRL billions, years, and annualized percentages are never mixed;
- holder definitions, methodological notes, revisions, source workbook,
  publication URL, annex URL, and version are preserved;
- a live official sync completes cleanly on Windows;
- REST and MCP return the verified July 2026 total DPF value of
  9,288.7802713778 BRL billion from the official annex.

## Interfaces and correctness

- REST v2 exposes search, concepts, dataset identity, schema, and observations;
  v1 keeps all 32 stable series IDs compatible.
- MCP exposes 19 focused read-only tools backed by the same semantic and data
  routes as REST. The test suite performs an actual RMD tool call in addition
  to tool discovery.
- The public source registry covers BCB, IBGE, Tesouro, MDIC, ANP, EPE, MTE,
  and CVM with source-specific attribution guidance.
- OpenAPI 3.1 documents the RTN account, RMD table, and CVM aggregation
  boundaries as well as their different date-selection formats.

## Reliability and release gate

- Production build: pass
- Lint: pass
- Automated tests: **28 / 28**
- Production dependency audit: **0 known vulnerabilities**
- Python synchronization scripts: syntax validated
- DPF live acquisition: pass
- Large CVM and DPF observation payloads: lazy-loaded outside the base worker
- Explicit upstream errors, retries, stale snapshots, cache bypass, RFC 9457
  problem details, CORS, HEAD, and OPTIONS behavior: covered by tests

Known operating limits are intentional and documented: the service is
best-effort without an uptime SLA, generic live publishers can be unavailable,
the newest CVM filing date can be incomplete, and unsupported demand remains
explicit.

## Remaining blocker

Deploy the exact validated build to the existing Sites project and run a
production smoke test for v2 identity, semantic search, RMD schema and values,
MCP tool listing/call, v1 compatibility, and localized source documentation.
