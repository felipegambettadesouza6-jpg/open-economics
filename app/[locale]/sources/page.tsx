import { notFound } from "next/navigation";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { categoryLabels, indicators } from "@/lib/catalog/indicators";
import { sources } from "@/lib/catalog/sources";
import { isLocale, localized } from "@/lib/i18n";

export default async function SourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value;
  const pt = locale === "pt-br";

  return <main className="atlas-page atlas-utility">
    <SiteHeader locale={locale} />
    <section className="atlas-page-hero atlas-shell">
      <p className="atlas-kicker">{pt ? "ORIGEM E CONFIANÇA" : "PROVENANCE & TRUST"}</p>
      <div><h1>{pt ? "Saiba de onde cada valor veio." : "Know where every value came from."}</h1><p>{pt ? "Normalizamos o acesso, não a autoria. Publicador, identificador, licença e momento de recuperação permanecem visíveis." : "We normalize access, not authorship. Publisher, identifier, license, and retrieval time remain visible."}</p></div>
    </section>
    <section className="publisher-registry atlas-shell">
      <div className="publisher-registry-head"><span>{pt ? "Publicador" : "Publisher"}</span><span>{pt ? "Cobertura conectada" : "Connected coverage"}</span><span>{pt ? "Acesso oficial" : "Official access"}</span></div>
      {sources.map((source, index) => {
        const sourceIndicators = indicators.filter((indicator) => indicator.sourceAgency === source.shortName);
        const categories = [...new Set(sourceIndicators.map((indicator) => indicator.category))];
        return <article className="publisher-row" id={source.id} key={source.id}>
          <span className="publisher-index">0{index + 1}</span>
          <div className="publisher-identity">
            <p className="atlas-kicker">{source.shortName} · {pt ? "PUBLICADOR OFICIAL" : "OFFICIAL PUBLISHER"}</p>
            <h2>{source.name}</h2>
            <p>{source.description}</p>
            <div className="publisher-metrics"><span><b>{sourceIndicators.length}</b>{pt ? "séries" : "series"}</span><span><b>{categories.length}</b>{pt ? "temas" : "topics"}</span><span><b>{source.shortName}</b>ID</span></div>
          </div>
          <div className="publisher-series">
            <span>{categories.map((category) => categoryLabels[category]).join(" · ")}</span>
            {sourceIndicators.slice(0, 5).map((indicator) => <a href={localized(locale, `/indicators/${indicator.id}`)} key={indicator.id}><b>{indicator.name}</b><code>{indicator.id}</code><small>{indicator.unitSymbol}</small></a>)}
            <a className="publisher-all" href={localized(locale, `/catalog?source=${source.shortName}`)}>{pt ? `Ver todas as ${sourceIndicators.length} séries` : `View all ${sourceIndicators.length} series`}<span>→</span></a>
          </div>
          <footer><span>{source.attribution}</span><a href={source.catalogUrl} target="_blank" rel="noreferrer">{pt ? "Catálogo oficial" : "Official catalog"} ↗</a></footer>
        </article>;
      })}
    </section>
    <SiteFooter locale={locale} />
  </main>;
}
