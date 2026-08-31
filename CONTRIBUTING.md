# Contributing

Open Economics welcomes bug reports, data-contract corrections, documentation
improvements, and focused code contributions.

## Before proposing a new indicator

The catalog is intentionally curated. Open an issue describing the real product,
analysis, or integration that needs the series before implementing it. Include
the official publisher, stable source identifier, unit, frequency, date
semantics, license, and why an existing indicator does not solve the use case.
Indicators are added for demonstrated use, not catalog size.

## Local development

Node.js 22.13 or newer is required.

```bash
npm install
npm test
npm run lint
```

`npm test` builds the complete application before running the API, rendering,
cache, source-normalization, telemetry, OpenAPI, and discovery tests.

## Pull requests

- Keep each change focused and explain the user problem it solves.
- Preserve official source IDs, URLs, raw values, units, and date semantics.
- Add or update tests for response-contract and normalization changes.
- Do not commit credentials, local data, telemetry exports, build output, or
  generated caches.
- Do not add tracking that collects personal data. The existing telemetry is
  aggregate and privacy-safe by design.

For security-sensitive reports, follow [SECURITY.md](./SECURITY.md) instead of
opening a public issue.
