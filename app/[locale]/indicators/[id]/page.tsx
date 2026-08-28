import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/app/components/CopyButton";
import { SeriesExplorer } from "@/app/components/SeriesExplorer";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { categoryLabels, getIndicator, indicators } from "@/lib/catalog/indicators";
import { getSource } from "@/lib/catalog/sources";
import { isLocale, localized } from "@/lib/i18n";

const categoryLabelsPt: Record<string, string> = {
  inflation: "Inflação", "interest-rates": "Taxas de juros", currencies: "Câmbio",
  activity: "Atividade econômica", labor: "Trabalho", credit: "Crédito", fiscal: "Fiscal",
  external: "Setor externo", markets: "Mercados",
};
const frequencyLabelsPt: Record<string, string> = { daily: "Diária", monthly: "Mensal", quarterly: "Trimestral", annual: "Anual" };

function dateSemantics(indicator: NonNullable<ReturnType<typeof getIndicator>>, pt: boolean) {
  if (!pt) return indicator.dateSemantics;
  if (indicator.dateSemantics.startsWith("Final month")) return "Mês final do trimestre móvel oficial de referência.";
  if (indicator.frequency === "daily") return `Data oficial da observação publicada pelo ${indicator.sourceAgency}.`;
  return `Data normalizada para o primeiro dia do período oficial de referência; source_date preserva o rótulo original publicado pelo ${indicator.sourceAgency}.`;
}

export function generateStaticParams() { return ["en", "pt-br"].flatMap((locale) => indicators.map((indicator) => ({ locale, id: indicator.id }))); }
export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params; const indicator = getIndicator(id); if (!indicator || !isLocale(locale)) return { title: "Indicator not found | Open Economics" };
  const title = `${locale === "pt-br" ? indicator.officialName : indicator.name} | Open Economics`; const description = locale === "pt-br" ? `${indicator.officialName}. Série oficial publicada por ${indicator.sourceAgency}.` : `${indicator.description} ${indicator.officialName}.`;
  return { title, description, alternates: { canonical: localized(locale, `/indicators/${id}`), languages: { en: `/en/indicators/${id}`, "pt-BR": `/pt-br/indicators/${id}` } }, openGraph: { title, description, images: [] }, twitter: { card: "summary", title, description, images: [] } };
}

export default async function IndicatorPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params; if (!isLocale(localeValue)) notFound(); const locale = localeValue; const pt = locale === "pt-br"; const indicator = getIndicator(id); if (!indicator) notFound();
  const source = getSource(indicator.sourceAgency.toLowerCase()); const related = indicators.filter((item) => item.category === indicator.category && item.id !== indicator.id).slice(0, 4);
  const request = `/api/v1/indicators/${indicator.id}/observations?start=2024-01-01&order=asc`;
  return <main className="atlas-page"><SiteHeader locale={locale} />
    <section className="atlas-indicator-hero atlas-shell"><div className="atlas-breadcrumb"><a href={localized(locale, "/catalog")}>{pt ? "Catálogo" : "Explore"}</a><span>→</span><a href={localized(locale, `/catalog?category=${indicator.category}`)}>{pt ? categoryLabelsPt[indicator.category] ?? categoryLabels[indicator.category] : categoryLabels[indicator.category]}</a></div><div className="indicator-atlas-title"><div><p className="atlas-kicker">{indicator.sourceAgency} / {pt ? frequencyLabelsPt[indicator.frequency] ?? indicator.frequency : indicator.frequency} / {indicator.id}</p><h1>{pt ? indicator.officialName : indicator.name}</h1><p className="official-series-name">{pt ? indicator.name : indicator.officialName}</p><p>{pt ? `Série oficial publicada por ${indicator.sourceAgency}, com frequência ${(frequencyLabelsPt[indicator.frequency] ?? indicator.frequency).toLowerCase()} e unidade ${indicator.unitSymbol}.` : indicator.description}</p></div><div className="indicator-coordinate"><span>{pt ? "ID estável da série" : "Stable series ID"}</span><code>{indicator.id}</code><CopyButton value={indicator.id} label={pt ? "Copiar ID" : "Copy ID"} successLabel={pt ? "Copiado" : "Copied"} /></div></div><div className="atlas-facts"><div><span>{pt ? "Frequência" : "Frequency"}</span><b>{pt ? frequencyLabelsPt[indicator.frequency] ?? indicator.frequency : indicator.frequency}</b></div><div><span>{pt ? "Unidade" : "Unit"}</span><b>{indicator.unitSymbol}</b></div><div><span>{pt ? "Publicador" : "Publisher"}</span><b>{indicator.sourceAgency}</b></div><div><span>{pt ? "Início" : "Coverage starts"}</span><b>{indicator.startDate.slice(0, 7)}</b></div><div><span>{pt ? "Ajuste" : "Adjustment"}</span><b>{indicator.seasonalAdjustment ? (pt ? "Sazonal" : "Seasonal") : (pt ? "Sem ajuste" : "Not adjusted")}</b></div></div></section>
    <section className="atlas-indicator-body atlas-shell">
      <SeriesExplorer indicatorId={indicator.id} unit={indicator.unitSymbol} decimals={indicator.decimals} frequency={indicator.frequency} startDate={indicator.startDate} locale={locale} />
      <div className="indicator-lower">
        <section className="atlas-methodology"><p className="atlas-kicker">03 / {pt ? "Metodologia e origem" : "Methodology & provenance"}</p><h2>{pt ? "O que esta série significa." : "What this series means."}</h2><dl><div><dt>{pt ? "Semântica da data" : "Date semantics"}</dt><dd>{dateSemantics(indicator, pt)}</dd></div><div><dt>{pt ? "Transformações" : "Transformations"}</dt><dd>{indicator.transformations.length ? indicator.transformations.join(", ") : (pt ? "Nenhuma. Valores na unidade publicada." : "None. Values remain in the published unit.")}</dd></div><div><dt>{pt ? "Valores ausentes" : "Missing values"}</dt><dd>{pt ? "Símbolos oficiais de disponibilidade e supressão são preservados com status explícito." : "Official availability and suppression symbols are preserved with explicit status."}</dd></div><div><dt>{pt ? "Revisões" : "Revisions"}</dt><dd>{pt ? "O histórico é atualizado porque o publicador pode revisar valores passados." : "History is refreshed because publishers may revise past values."}</dd></div></dl><div className="publisher-strip"><span>{source?.name ?? indicator.sourceAgency}<small>{source?.attribution}</small></span><a href={indicator.sourceUrl} target="_blank" rel="noreferrer">{pt ? "Metadados oficiais" : "Official metadata"} ↗</a></div></section>
        <aside className="use-series-panel"><p className="atlas-kicker">{pt ? "Use esta série" : "Use this series"}</p><h2>{pt ? "Do gráfico ao código." : "From chart to code."}</h2><div className="format-toggle"><span>JSON</span><a href={`${request}&format=csv`}>CSV</a></div><code>{request}</code><CopyButton value={request} label={pt ? "Copiar URL da API" : "Copy API URL"} successLabel={pt ? "Copiado" : "Copied"} /><pre><b>curl</b> --fail --silent<br />&nbsp;&nbsp;&quot;{request}&quot;</pre><a className="atlas-button primary" href={localized(locale, `/playground?indicator=${indicator.id}`)}>{pt ? "Abrir no playground" : "Open in playground"}<span>↗</span></a><a href={`${request}&format=csv`} download>{pt ? "Baixar CSV" : "Download CSV"} ↓</a><div className="use-note"><span>{pt ? "Origem" : "Source"}</span><b>{indicator.sourceAgency}</b><small>{indicator.license}</small></div></aside>
      </div>
    </section>
    {related.length > 0 && <section className="atlas-related atlas-shell"><p className="atlas-kicker">04 / {pt ? "Séries relacionadas" : "Related series"}</p>{related.map((item) => <a href={localized(locale, `/indicators/${item.id}`)} key={item.id}><span>{item.sourceAgency}</span><b>{pt ? item.officialName : item.name}</b><small>{pt ? item.name : item.officialName}</small><i>↗</i></a>)}</section>}
    <SiteFooter locale={locale} />
  </main>;
}
