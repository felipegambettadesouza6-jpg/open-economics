import type { Metadata } from "next";
import { DocsNav } from "@/app/components/DocsNav";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";

export const metadata: Metadata = {
  title: "Developer documentation | Open Economics API",
  description: "Quickstart, data model, date semantics, revisions, caching, and examples for the Open Economics API.",
};

export default function DocsPage() {
  return (
    <main>
      <SiteHeader />
      <section className="docs-hero">
        <div className="shell">
          <p className="eyebrow"><span /> Developer documentation</p>
          <h1>Clear data starts with<br /><em>clear contracts.</em></h1>
          <p>Everything needed to retrieve official Brazilian economic series without losing their meaning.</p>
        </div>
      </section>
      <div className="docs-layout shell">
        <DocsNav active="guide" />
        <article className="docs-content">
          <section id="quickstart">
            <p className="kicker">Start here</p>
            <h2>Five-minute quickstart</h2>
            <p>
              The API is anonymous, read-only, and available over HTTPS. Start with the catalog,
              choose a stable indicator ID, then request observations.
            </p>
            <h3>1. Find an indicator</h3>
            <pre><code>curl --fail --silent \<br />  &quot;/api/v1/indicators?q=ipca&amp;source=IBGE&quot;</code></pre>
            <h3>2. Request a date range</h3>
            <pre><code>curl --fail --silent \<br />  &quot;/api/v1/indicators/br-ipca-monthly/observations?start=2024-01-01&amp;end=2024-12-31&quot;</code></pre>
            <h3>3. Use the response</h3>
            <div className="language-examples">
              <div>
                <span>Python</span>
                <pre><code>{`import requests

url = "https://your-host/api/v1/indicators/br-ipca-monthly/observations"
response = requests.get(url, params={"start": "2024-01-01"}, timeout=30)
response.raise_for_status()
payload = response.json()

for row in payload["data"]:
    print(row["period"], row["value"])`}</code></pre>
              </div>
              <div>
                <span>JavaScript</span>
                <pre><code>{`const url = new URL("/api/v1/indicators/br-ipca-monthly/observations", location.origin);
url.searchParams.set("start", "2024-01-01");

const response = await fetch(url);
if (!response.ok) throw await response.json();
const { data, meta } = await response.json();

console.log(data, meta.provenance);`}</code></pre>
              </div>
            </div>
            <div className="docs-callout">
              <strong>Need CSV?</strong>
              Add <code>format=csv</code>. The same date, ordering, and limit validation applies.
            </div>
          </section>

          <section id="model">
            <p className="kicker">Core concept</p>
            <h2>Series and observation model</h2>
            <p>
              An <strong>indicator</strong> is a stable, curated definition. An <strong>observation</strong>
              is the official value for one reference period. The API keeps upstream identifiers in metadata
              while giving the series a semantic ID that does not leak provider-specific vocabulary.
            </p>
            <div className="schema-table">
              <div><code>date</code><span>Normalized ISO date used for sorting and filtering.</span></div>
              <div><code>period</code><span>Human reference period, such as <code>2026-07</code> or <code>2026-Q1</code>.</span></div>
              <div><code>source_date</code><span>The publisher&apos;s original date or period key.</span></div>
              <div><code>value</code><span>Number or null. Never an invented estimate.</span></div>
              <div><code>raw_value</code><span>Exact upstream value before numeric parsing.</span></div>
              <div><code>status</code><span>Observed, zero semantics, suppressed, unavailable, or another explicit state.</span></div>
            </div>
            <p>
              Response <code>meta</code> includes the complete indicator definition, source, upstream URL,
              retrieval timestamp, license, cache state, transformation list, and stale flag.
            </p>
          </section>

          <section id="dates">
            <p className="kicker">Semantics matter</p>
            <h2>Dates, periods, units, and null values</h2>
            <ul>
              <li>Request dates always use <code>YYYY-MM-DD</code> and are inclusive.</li>
              <li>BCB monthly series use day 01 as a reference-month marker; stock/flow meaning remains in metadata.</li>
              <li>IBGE six-digit keys are parsed by frequency. For quarterly GDP, <code>202601</code> means Q1 2026—not January.</li>
              <li>PNAD labor observations describe overlapping moving quarters; the period is labeled by the final month.</li>
              <li>Units are never guessed. Each indicator exposes the published unit and display symbol.</li>
              <li>IBGE symbols such as <code>X</code>, <code>..</code>, and <code>...</code> remain distinguishable statuses with a null numeric value.</li>
            </ul>
          </section>

          <section id="querying">
            <p className="kicker">Retrieval controls</p>
            <h2>Filtering, ordering, and limits</h2>
            <p>
              Observation endpoints accept <code>start</code>, <code>end</code>, <code>order</code>,
              <code>limit</code>, and <code>format</code>. Unknown parameters return a 400 error so misspellings
              cannot silently change a request.
            </p>
            <p>
              Limits range from 1 to 5,000 observations. Daily BCB ranges are capped at ten years per request,
              mirroring the official SGS upstream rule. Monthly and quarterly ranges can be longer.
            </p>
          </section>

          <section id="transformations">
            <p className="kicker">No hidden math</p>
            <h2>Transformations and aggregation</h2>
            <p>
              Version 1 exposes curated source series in their official units. It does not silently annualize,
              resample, forward-fill, seasonally adjust, or invert signs. The <code>transformations</code> array
              is empty for raw series and will list every named operation when derived series are introduced.
            </p>
          </section>

          <section id="revisions">
            <p className="kicker">Revision policy</p>
            <h2>Official history can change</h2>
            <p>
              GDP, seasonal adjustments, and other official series may be revised. Open Economics refreshes
              rolling history rather than treating observations as append-only. Each response separates:
            </p>
            <ol>
              <li><strong>Reference period</strong> — when the observation applies.</li>
              <li><strong>Source update</strong> — when the publisher reports one.</li>
              <li><strong>Retrieved at</strong> — when Open Economics fetched the response.</li>
            </ol>
            <p>
              If a refresh fails and a prior database snapshot exists, the API can serve it with
              <code>meta.stale: true</code> and an HTTP <code>Warning: 110</code> header. It never presents
              stale data as freshly retrieved.
            </p>
          </section>

          <section id="caching">
            <p className="kicker">Reliability</p>
            <h2>Caching and practical limits</h2>
            <p>
              Official sources publish no general per-second quota for these services. The API uses conservative
              edge caching, bounded queries, upstream timeouts, and last-known-good snapshots. Daily series are
              typically refreshed hourly; monthly and quarterly series use longer freshness windows.
            </p>
            <p>
              Public responses include cache headers and a request ID. A source rate limit or outage produces
              a typed 503/502 problem response unless a transparently marked snapshot is available.
            </p>
          </section>

          <section id="versioning">
            <p className="kicker">Stability</p>
            <h2>Versioning and change policy</h2>
            <p>
              The major version is part of every path: <code>/api/v1</code>. Additive metadata fields and new
              indicators may ship within v1. Removing fields, changing their meaning, or altering a stable
              indicator&apos;s semantics requires a new major API version.
            </p>
            <p>The OpenAPI 3.1 document is always available at <a href="/api/v1/openapi.json">/api/v1/openapi.json ↗</a>.</p>
          </section>
        </article>
      </div>
      <SiteFooter />
    </main>
  );
}

