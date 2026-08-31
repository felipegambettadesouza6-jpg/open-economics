import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { categoryLabels, indicators } from "@/lib/catalog/indicators";
import { sources } from "@/lib/catalog/sources";
import { isLocale, localized } from "@/lib/i18n";
import { localizedMetadata } from "@/lib/metadata";

const categoryLabelsPt: Record<string, string> = { inflation: "Inflação", "interest-rates": "Taxas de juros", currencies: "Câmbio", activity: "Atividade econômica", labor: "Trabalho", credit: "Crédito", fiscal: "Fiscal", external: "Setor externo", markets: "Mercados" };
const sourceCopyPt: Record<string, { description: string; attribution: string }> = {
  bcb: {
    description: "O banco central do Brasil publica séries monetárias, de crédito, fiscais, do setor externo e financeiras por meio de seus serviços de dados abertos.",
    attribution: "Fonte: Banco Central do Brasil (BCB).",
  },
  ibge: {
    description: "O instituto oficial de estatística do Brasil publica contas nacionais, preços, indústria, comércio, serviços e dados do mercado de trabalho.",
    attribution: "Fonte: IBGE. Preserve o nome oficial da série e o período de referência.",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return localizedMetadata({
    locale,
    path: "/sources",
    title: locale === "pt-br" ? "Fontes e proveniência | Open Economics" : "Sources and provenance | Open Economics",
    description: locale === "pt-br" ? "Consulte publicadores, licenças, atribuição e cobertura das séries oficiais." : "Review publishers, licenses, attribution, and coverage for every official series.",
  });
}

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
            <p>{pt ? sourceCopyPt[source.id]?.description ?? source.description : source.description}</p>
            <div className="publisher-metrics"><span><b>{sourceIndicators.length}</b>{pt ? "séries" : "series"}</span><span><b>{categories.length}</b>{pt ? "temas" : "topics"}</span><span><b>{source.shortName}</b>ID</span></div>
          </div>
          <div className="publisher-series">
            <span>{categories.map((category) => pt ? categoryLabelsPt[category] ?? categoryLabels[category] : categoryLabels[category]).join(" · ")}</span>
            {sourceIndicators.slice(0, 5).map((indicator) => <a href={localized(locale, `/indicators/${indicator.id}`)} key={indicator.id}><b>{pt ? indicator.officialName : indicator.name}</b><code>{indicator.id}</code><small>{indicator.unitSymbol}</small></a>)}
            <a className="publisher-all" href={localized(locale, `/catalog?source=${source.shortName}`)}>{pt ? `Ver todas as ${sourceIndicators.length} séries` : `View all ${sourceIndicators.length} series`}<span>→</span></a>
          </div>
          <footer><span>{pt ? sourceCopyPt[source.id]?.attribution ?? source.attribution : source.attribution}</span><div><a href={source.licenseUrl} target="_blank" rel="noreferrer">{pt ? "Licença" : "License"} ↗</a><a href={source.catalogUrl} target="_blank" rel="noreferrer">{pt ? "Catálogo oficial" : "Official catalog"} ↗</a></div></footer>
        </article>;
      })}
    </section>
    <SiteFooter locale={locale} />
  </main>;
}
