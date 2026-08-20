import type { Metadata } from "next";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { categoryLabels, indicators } from "@/lib/catalog/indicators";
import { sources } from "@/lib/catalog/sources";

export const metadata: Metadata = {
  title: "Official data sources | Open Economics API",
  description: "Publishers, coverage, attribution, licenses, and methodology boundaries for every connected official source.",
};

export default function SourcesPage() {
  return (
    <main>
      <SiteHeader />
      <section className="page-hero sources-hero shell">
        <div>
          <p className="eyebrow"><span /> Source transparency</p>
          <h1>Know exactly where<br /><em>the data came from.</em></h1>
        </div>
        <p>
          Open Economics normalizes access, not authorship. Publisher, upstream identifier,
          usage terms, source URL, and retrieval time remain attached to every response.
        </p>
      </section>
      <section className="sources-page shell">
        {sources.map((source) => {
          const sourceIndicators = indicators.filter((indicator) => indicator.sourceAgency === source.shortName);
          const categories = [...new Set(sourceIndicators.map((indicator) => indicator.category))];
          return (
            <article className="source-detail" id={source.id} key={source.id}>
              <div className="source-detail-head">
                <span className="source-monogram">{source.shortName}</span>
                <div>
                  <p className="kicker">Official publisher</p>
                  <h2>{source.name}</h2>
                  <p>{source.description}</p>
                </div>
                <a className="button secondary" href={source.homepage} target="_blank" rel="noreferrer">Official site ↗</a>
              </div>
              <div className="source-metadata">
                <div><span>Connected indicators</span><strong>{sourceIndicators.length}</strong></div>
                <div><span>Coverage areas</span><strong>{categories.length}</strong></div>
                <div><span>License / usage</span><a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.license} ↗</a></div>
                <div><span>Recommended attribution</span><strong>{source.attribution}</strong></div>
              </div>
              <div className="source-coverage">
                <div>
                  <span>Areas represented</span>
                  <p>{categories.map((category) => categoryLabels[category]).join(" · ")}</p>
                </div>
                <div className="source-series-list">
                  {sourceIndicators.slice(0, 8).map((indicator) => (
                    <a href={`/indicators/${indicator.id}`} key={indicator.id}>
                      <strong>{indicator.name}</strong>
                      <span>{indicator.frequency} · {indicator.unitSymbol}</span>
                    </a>
                  ))}
                  {sourceIndicators.length > 8 && (
                    <a className="all-source-series" href={`/catalog?source=${source.shortName}`}>
                      View all {sourceIndicators.length} {source.shortName} indicators →
                    </a>
                  )}
                </div>
              </div>
              <div className="source-links">
                <a href={source.catalogUrl} target="_blank" rel="noreferrer">Open official data catalog ↗</a>
                <a href="/docs/attribution">Read attribution guidance →</a>
              </div>
            </article>
          );
        })}
        <section className="source-boundary">
          <p className="kicker">Deliberate scope</p>
          <h2>What is not connected yet</h2>
          <p>
            Detailed Treasury bulk files and customs microdata are valuable but require scheduled ingestion,
            schema-specific validation, and heavier aggregation. This release uses BCB fiscal and balance-of-payments
            headlines instead of pretending those bulk systems are suitable live proxies.
          </p>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}

