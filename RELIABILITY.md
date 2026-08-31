# Reliability policy

Open Economics is an open-source, best-effort public API. It does not currently
offer a contractual uptime or freshness SLA. Applications that require a legal,
commercial, or guaranteed data service should integrate with the official
publisher or an appropriate contracted provider.

## Data integrity

- Every series is tied to an official BCB or IBGE identifier and source URL.
- Responses retain the publisher's raw value alongside the normalized value.
- Open Economics does not forecast, interpolate, forward-fill, or silently
  replace unavailable observations.
- A last-known-good response is returned only when it is clearly marked with
  `meta.stale: true`, `meta.cache: "stale"`, and HTTP `Warning: 110`.

## Availability and freshness

The API depends on BCB SGS and IBGE Aggregates/SIDRA. Those services can be slow,
rate-limited, or unavailable independently of Open Economics. The API stores
successfully normalized snapshots where supported, and BCB requests use bounded
retries for transient failures. It returns an explicit 5xx Problem Details
response when neither a current publisher response nor an eligible
last-known-good snapshot is available.

`GET /api/v1/health` reports router and catalog readiness; it does not claim
that every upstream publisher is reachable. The public status page performs
point-in-time checks and labels stale snapshots.

## Changes

- The public contract is namespaced under `/api/v1`.
- Breaking response changes require a new API version or a documented migration.
- Indicator definitions preserve stable semantic IDs; source-code or methodology
  changes are reviewed as data-contract changes.
- Releases and known incidents are documented in the public repository.

## Reporting problems

Open an issue at
https://github.com/felipegambettadesouza6-jpg/open-economics/issues with the
endpoint, timestamp, request ID, expected behavior, and observed behavior. Do
not include secrets or personal data; the API itself requires neither.
