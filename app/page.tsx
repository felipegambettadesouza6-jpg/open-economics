import { LiveSeries } from "@/app/components/LiveSeries";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { categoryDescriptions, categoryLabels, indicators } from "@/lib/catalog/indicators";

const homeCategories = [
  "inflation",
  "interest-rates",
  "currencies",
  "activity",
  "labor",
  "credit",
  "fiscal",
  "external",
] as const;

const principles = [
  ["One schema", "Predictable dates, values, units, frequencies, and metadata across publishers."],
  ["Source-level provenance", "Every response identifies the official series, license, retrieval time, and transformations."],
  ["Honest failure", "Source outages are marked. Suppressed or unavailable values never become fabricated numbers."],
  ["Built for retrieval", "JSON, CSV, CORS, stable IDs, OpenAPI, and examples in the languages developers use."],
];

export default function Home() {
  const featured = indicators.filter((indicator) => indicator.featured).slice(0, 8);

  return (
    <main>
      <SiteHeader />
      <section className="hero home-hero shell">
        <div className="hero-content">
          <div className="eyebrow"><span /> Open · Brazil first</div>
          <h1>Brazilian economic data, <em>one consistent API.</em></h1>
          <p className="hero-copy">
            Authoritative time series from Brazil&apos;s public institutions,
            normalized into a predictable interface with transparent provenance.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/catalog">Explore the data <span>→</span></a>
            <a className="button secondary" href="/docs">Read the quickstart</a>
          </div>
          <div className="hero-note">
            No API key for public data
            <span>·</span>
            JSON &amp; CSV
            <span>·</span>
            Source licenses preserved
          </div>
        </div>
        <LiveSeries />
      </section>

      <section className="coverage-section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="kicker">Economic coverage</p>
              <h2>A useful map of Brazil&apos;s economy.</h2>
            </div>
            <p>
              {indicators.length} curated indicators across {homeCategories.length} core areas,
              selected for public value and reliable machine access.
            </p>
          </div>
          <div className="coverage-grid">
            {homeCategories.map((category, index) => {
              const count = indicators.filter((indicator) => indicator.category === category).length;
              return (
                <a href={`/catalog?category=${category}`} key={category}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{categoryLabels[category]}</strong>
                  <small>{categoryDescriptions[category]}</small>
                  <b>{count} series →</b>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="popular-section shell">
        <div className="section-heading">
          <div>
            <p className="kicker">Popular series</p>
            <h2>Start with the essentials.</h2>
          </div>
          <a href="/catalog">Search the complete catalog →</a>
        </div>
        <div className="indicator-table">
          <div className="table-header table-row">
            <span>Indicator</span><span>Area</span><span>Frequency</span><span>Source</span>
          </div>
          {featured.map((indicator) => (
            <a className="table-row indicator-row" href={`/indicators/${indicator.id}`} key={indicator.id}>
              <span className="indicator-name">
                <b>{indicator.name}</b><small>{indicator.id}</small>
              </span>
              <span>{categoryLabels[indicator.category]}</span>
              <span>{indicator.frequency} · {indicator.unitSymbol}</span>
              <span className="source-cell">{indicator.sourceAgency}<i>↗</i></span>
            </a>
          ))}
        </div>
      </section>

      <section className="principles-section">
        <div className="shell">
          <div className="section-heading inverse">
            <div>
              <p className="kicker light">What consistency means</p>
              <h2>Useful because it is explicit.</h2>
            </div>
            <p>Upstream differences are normalized. Meaning and provenance are not erased.</p>
          </div>
          <div className="principles-grid">
            {principles.map(([title, description], index) => (
              <div key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="quickstart-section shell">
        <div className="quickstart-copy">
          <p className="kicker">Five-minute quickstart</p>
          <h2>One request from question to data.</h2>
          <p>
            Pick a stable indicator ID, choose a date range, and receive normalized observations
            plus the complete source trail.
          </p>
          <ol>
            <li><span>1</span><div><strong>Find an indicator</strong><small>Search names, aliases, acronyms, and upstream codes.</small></div></li>
            <li><span>2</span><div><strong>Request observations</strong><small>Use ISO dates; choose JSON or CSV.</small></div></li>
            <li><span>3</span><div><strong>Keep the provenance</strong><small>Unit, source, license, and retrieval time travel with the data.</small></div></li>
          </ol>
          <a className="text-link" href="/docs">Read the complete guide →</a>
        </div>
        <div className="quickstart-code">
          <div className="code-window-head"><span>cURL</span><a href="/playground?indicator=br-selic-target">Open in playground ↗</a></div>
          <pre><code><span className="code-method">curl</span> --fail --silent \<br />
            &nbsp;&nbsp;<span className="code-string">&quot;/api/v1/indicators/br-selic-target/observations?start=2025-01-01&quot;</span></code></pre>
          <div className="response-preview">
            <span className="code-brace">&#123;</span><br />
            &nbsp;&nbsp;<span className="code-key">&quot;data&quot;</span>: [<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&#123; <span className="code-key">&quot;date&quot;</span>: <span className="code-string">&quot;…&quot;</span>, <span className="code-key">&quot;value&quot;</span>: <span className="code-number">…</span> &#125;<br />
            &nbsp;&nbsp;],<br />
            &nbsp;&nbsp;<span className="code-key">&quot;meta&quot;</span>: &#123; <span className="code-key">&quot;provenance&quot;</span>: &#123; … &#125; &#125;<br />
            <span className="code-brace">&#125;</span>
          </div>
        </div>
      </section>

      <section className="sources-band">
        <div className="shell source-band-grid">
          <div>
            <p className="kicker">Connected official sources</p>
            <h2>The publisher is always visible.</h2>
          </div>
          <a href="/sources#ibge"><strong>IBGE</strong><span>Prices · GDP · Industry · Retail · Services · Labor</span><i>View source →</i></a>
          <a href="/sources#bcb"><strong>Banco Central do Brasil</strong><span>Rates · FX · Credit · Fiscal · External sector</span><i>View source →</i></a>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

