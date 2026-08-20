import type { Metadata } from "next";
import { DocsNav } from "@/app/components/DocsNav";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";

export const metadata: Metadata = {
  title: "API reference | Open Economics API",
  description: "Endpoints, parameters, response contracts, and CORS behavior for Open Economics API v1.",
};

const endpoints = [
  ["GET", "/api/v1", "Discover the current version and top-level links."],
  ["GET", "/api/v1/indicators", "List and search the indicator catalog."],
  ["GET", "/api/v1/indicators/:id", "Retrieve one complete indicator definition."],
  ["GET", "/api/v1/indicators/:id/observations", "Retrieve normalized observations and provenance."],
  ["GET", "/api/v1/indicators/:id/latest", "Retrieve the latest available official observation."],
  ["GET", "/api/v1/sources", "List publishers, licenses, and attribution text."],
  ["GET", "/api/v1/openapi.json", "Retrieve the OpenAPI 3.1 contract."],
  ["GET", "/api/v1/health", "Check router and catalog readiness without calling upstreams."],
];

export default function ApiReferencePage() {
  return (
    <main>
      <SiteHeader />
      <section className="docs-hero compact-docs-hero">
        <div className="shell">
          <p className="eyebrow"><span /> API reference · v1</p>
          <h1>Small surface.<br /><em>Explicit behavior.</em></h1>
          <p>Read-only endpoints with wildcard CORS and RFC-style problem responses.</p>
        </div>
      </section>
      <div className="docs-layout shell">
        <DocsNav active="reference" />
        <article className="docs-content">
          <section>
            <p className="kicker">Base path</p>
            <h2><code>/api/v1</code></h2>
            <p>
              All endpoints accept <code>GET</code> and <code>HEAD</code>. Every API path supports
              <code>OPTIONS</code>. Credentials are not used; <code>Access-Control-Allow-Origin: *</code>.
            </p>
          </section>
          <section>
            <p className="kicker">Endpoints</p>
            <h2>Available resources</h2>
            <div className="endpoint-list">
              {endpoints.map(([method, path, description]) => (
                <a href={path.replace(":id", "br-ipca-monthly")} key={path}>
                  <b>{method}</b><code>{path}</code><span>{description}</span><i>↗</i>
                </a>
              ))}
            </div>
          </section>
          <section>
            <p className="kicker">Catalog endpoint</p>
            <h2><code>GET /indicators</code></h2>
            <div className="parameter-table">
              <div><code>q</code><span>string</span><p>Name, stable ID, Portuguese alias, acronym, description, or upstream code.</p></div>
              <div><code>category</code><span>string</span><p>inflation, interest-rates, currencies, activity, labor, credit, fiscal, external, or markets.</p></div>
              <div><code>frequency</code><span>enum</span><p>daily, monthly, quarterly, or annual.</p></div>
              <div><code>source</code><span>enum</span><p>BCB or IBGE.</p></div>
              <div><code>limit</code><span>integer</span><p>1–500. Default 100.</p></div>
            </div>
            <pre><code>GET /api/v1/indicators?q=desemprego&amp;source=IBGE&amp;frequency=monthly</code></pre>
          </section>
          <section>
            <p className="kicker">Observation endpoint</p>
            <h2><code>GET /indicators/:id/observations</code></h2>
            <div className="parameter-table">
              <div><code>start</code><span>date</span><p>Inclusive ISO date. Defaults to a useful recent window.</p></div>
              <div><code>end</code><span>date</span><p>Inclusive ISO date. Defaults to today.</p></div>
              <div><code>order</code><span>enum</span><p>asc or desc. Default asc.</p></div>
              <div><code>limit</code><span>integer</span><p>1–5,000 observations. Default 5,000.</p></div>
              <div><code>format</code><span>enum</span><p>json or csv. Default json.</p></div>
            </div>
            <div className="docs-callout">
              <strong>Strict query validation</strong>
              Unknown parameters return <code>400 UNKNOWN_QUERY_PARAMETER</code>. This catches
              misspellings instead of silently ignoring them.
            </div>
          </section>
          <section>
            <p className="kicker">Response headers</p>
            <h2>Operational metadata</h2>
            <div className="schema-table">
              <div><code>X-Request-Id</code><span>Generated or sanitized caller-provided correlation ID.</span></div>
              <div><code>Cache-Control</code><span>Browser and shared-cache freshness policy.</span></div>
              <div><code>Server-Timing</code><span>Total service duration for observation calls.</span></div>
              <div><code>Warning</code><span>HTTP 110 when a last-known-good snapshot is served stale.</span></div>
            </div>
          </section>
          <section>
            <p className="kicker">Machine contract</p>
            <h2>OpenAPI 3.1</h2>
            <p>
              The reference document describes parameters, observation status values, problem responses,
              and the active deployment URL.
            </p>
            <a className="button dark" href="/api/v1/openapi.json">Open OpenAPI JSON ↗</a>
          </section>
        </article>
      </div>
      <SiteFooter />
    </main>
  );
}

