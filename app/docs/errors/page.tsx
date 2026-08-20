import type { Metadata } from "next";
import { DocsNav } from "@/app/components/DocsNav";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";

export const metadata: Metadata = {
  title: "API errors | Open Economics API",
  description: "Typed API errors, status codes, retry guidance, and problem response format.",
};

const errors = [
  ["400", "INVALID_DATE", "Use a real ISO date in YYYY-MM-DD format."],
  ["400", "INVALID_DATE_RANGE", "Ensure start is on or before end."],
  ["400", "DATE_RANGE_TOO_LARGE", "Split daily BCB requests into intervals of ten years or less."],
  ["400", "UNKNOWN_QUERY_PARAMETER", "Remove or correct the unrecognized parameter."],
  ["400", "INVALID_LIMIT", "Use the documented numeric bounds."],
  ["404", "INDICATOR_NOT_FOUND", "Search the catalog for a current stable indicator ID."],
  ["404", "ROUTE_NOT_FOUND", "Check the v1 endpoint path."],
  ["405", "METHOD_NOT_ALLOWED", "Use GET, HEAD, or OPTIONS."],
  ["502", "UPSTREAM_ERROR", "The official publisher returned an unsuccessful response."],
  ["502", "UPSTREAM_SCHEMA_ERROR", "The source response no longer matches its verified contract."],
  ["503", "UPSTREAM_RATE_LIMITED", "Retry after the response's Retry-After interval."],
  ["504", "UPSTREAM_TIMEOUT", "Retry with backoff; do not assume a missing value."],
];

export default function ErrorsPage() {
  return (
    <main>
      <SiteHeader />
      <section className="docs-hero compact-docs-hero">
        <div className="shell">
          <p className="eyebrow"><span /> Error contract</p>
          <h1>Failures should be<br /><em>actionable.</em></h1>
          <p>Stable codes, request IDs, and honest source failure states.</p>
        </div>
      </section>
      <div className="docs-layout shell">
        <DocsNav active="errors" />
        <article className="docs-content">
          <section>
            <p className="kicker">Format</p>
            <h2>Problem details</h2>
            <p>
              Errors use <code>application/problem+json</code> and the structure below.
              Stack traces and upstream response bodies are never exposed.
            </p>
            <pre><code>{`{
  "type": "https://host/docs/errors#invalid_date",
  "title": "start and end must use the YYYY-MM-DD format.",
  "status": 400,
  "detail": "start and end must use the YYYY-MM-DD format.",
  "code": "INVALID_DATE",
  "request_id": "d6f13…"
}`}</code></pre>
          </section>
          <section>
            <p className="kicker">Reference</p>
            <h2>Error codes</h2>
            <div className="error-table">
              <div className="error-table-head"><span>HTTP</span><span>Code</span><span>Action</span></div>
              {errors.map(([status, code, action]) => (
                <div key={code}><b>{status}</b><code id={code.toLowerCase()}>{code}</code><span>{action}</span></div>
              ))}
            </div>
          </section>
          <section>
            <p className="kicker">Retry behavior</p>
            <h2>Be conservative with official services</h2>
            <ul>
              <li>Do not retry 400 or 404 responses without changing the request.</li>
              <li>Retry 429, 502, 503, or 504 with exponential backoff and jitter.</li>
              <li>Honor <code>Retry-After</code> when present.</li>
              <li>Use the same <code>X-Request-Id</code> when reporting a problem.</li>
              <li>A null observation with an explicit status is data—not an API error.</li>
            </ul>
          </section>
        </article>
      </div>
      <SiteFooter />
    </main>
  );
}

