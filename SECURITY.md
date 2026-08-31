# Security policy

## Supported surface

Security fixes target the current `main` branch and the deployed `/api/v1`
surface. Open Economics is a read-only, no-authentication API and should never
receive application secrets or personal data.

## Reporting a vulnerability

Use GitHub's private vulnerability-reporting flow under **Security → Report a
vulnerability** in the public repository. Include the affected URL or component,
impact, reproduction steps, and a safe proof of concept. Do not include real
credentials, personal information, or data belonging to another person.

Please do not open a public issue for an unpatched vulnerability. Availability,
freshness, source-correction, and documentation problems that are not security
issues can use the public issue tracker.

The official BCB and IBGE systems are outside this project's security scope;
report vulnerabilities in those systems to the respective publisher.

Open Economics is maintained on a best-effort basis and does not promise a
response-time SLA, but reports will be acknowledged and handled as promptly as
practical.
