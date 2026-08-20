import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/app/components/CopyButton";
import { SeriesExplorer } from "@/app/components/SeriesExplorer";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { categoryLabels, getIndicator, indicators } from "@/lib/catalog/indicators";
import { getSource } from "@/lib/catalog/sources";

export function generateStaticParams() {
  return indicators.map((indicator) => ({ id: indicator.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const indicator = getIndicator(id);
  if (!indicator) return { title: "Indicator not found | Open Economics API" };
  const title = `${indicator.name} | Open Economics API`;
  const description = `${indicator.description} Official ${indicator.sourceAgency} data with normalized observations and transparent provenance.`;
  return {
    title,
    description,
    openGraph: { title, description, images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}

export default async function IndicatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const indicator = getIndicator(id);
  if (!indicator) notFound();
  const source = getSource(indicator.sourceAgency.toLowerCase());
  const related = indicators
    .filter((item) => item.category === indicator.category && item.id !== indicator.id)
    .slice(0, 4);

  return (
    <main>
      <SiteHeader />
      <section className="indicator-hero shell">
        <div className="breadcrumb">
          <a href="/catalog">Catalog</a><span>/</span>
          <a href={`/catalog?category=${indicator.category}`}>{categoryLabels[indicator.category]}</a>
        </div>
        <div className="indicator-title-row">
          <div>
            <div className="indicator-status-line">
              <span className="source-badge">{indicator.sourceAgency}</span>
              <span className="active-status"><i /> Active series</span>
              {indicator.seasonalAdjustment && <span>Seasonally adjusted</span>}
            </div>
            <h1>{indicator.name}</h1>
            <p className="official-name">{indicator.officialName}</p>
            <p className="indicator-description">{indicator.description}</p>
          </div>
          <div className="id-box">
            <span>Stable indicator ID</span>
            <code>{indicator.id}</code>
            <CopyButton value={indicator.id} />
          </div>
        </div>
        <div className="indicator-facts">
          <div><span>Frequency</span><strong>{indicator.frequency}</strong></div>
          <div><span>Unit</span><strong>{indicator.unitSymbol}</strong></div>
          <div><span>Geography</span><strong>{indicator.geography}</strong></div>
          <div><span>Coverage starts</span><strong>{indicator.startDate.slice(0, 7)}</strong></div>
          <div><span>Seasonality</span><strong>{indicator.seasonalAdjustment ? "Adjusted" : "Not adjusted"}</strong></div>
        </div>
      </section>

      <section className="indicator-body shell">
        <SeriesExplorer
          indicatorId={indicator.id}
          unit={indicator.unitSymbol}
          decimals={indicator.decimals}
          frequency={indicator.frequency}
          startDate={indicator.startDate}
        />

        <div className="provenance-grid">
          <div className="provenance-main">
            <p className="kicker">Methodology &amp; provenance</p>
            <h2>What this series means.</h2>
            <dl>
              <div><dt>Date semantics</dt><dd>{indicator.dateSemantics}</dd></div>
              <div><dt>Transformations</dt><dd>{indicator.transformations.length ? indicator.transformations.join(", ") : "None. Values are exposed in their published unit."}</dd></div>
              <div><dt>Missing values</dt><dd>Official availability and suppression symbols are preserved with explicit observation status.</dd></div>
              <div><dt>Revision policy</dt><dd>Official history is periodically refreshed because publishers may revise historical or seasonally adjusted values.</dd></div>
              {indicator.notes && <div><dt>Series note</dt><dd>{indicator.notes}</dd></div>}
            </dl>
          </div>
          <aside className="source-card">
            <span>Official publisher</span>
            <strong>{source?.name ?? indicator.sourceAgency}</strong>
            <p>{source?.attribution}</p>
            <div>
              <span>Upstream identifier</span>
              <code>
                {indicator.provider === "bcb-sgs"
                  ? `SGS ${indicator.upstream.seriesCode}`
                  : `Table ${indicator.upstream.aggregate} · variable ${indicator.upstream.variable}`}
              </code>
            </div>
            <div>
              <span>License / usage</span>
              <a href={indicator.licenseUrl} target="_blank" rel="noreferrer">{indicator.license} ↗</a>
            </div>
            <a className="button dark" href={indicator.sourceUrl} target="_blank" rel="noreferrer">Open official metadata ↗</a>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="related-series">
            <div className="section-heading compact-heading">
              <div><p className="kicker">Continue exploring</p><h2>Related series</h2></div>
              <a href={`/catalog?category=${indicator.category}`}>All {categoryLabels[indicator.category].toLowerCase()} →</a>
            </div>
            <div className="related-list">
              {related.map((item) => (
                <a href={`/indicators/${item.id}`} key={item.id}>
                  <span>{item.sourceAgency}</span>
                  <strong>{item.name}</strong>
                  <small>{item.frequency} · {item.unitSymbol}</small>
                  <i>→</i>
                </a>
              ))}
            </div>
          </section>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}

