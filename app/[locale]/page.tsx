import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignalHero } from "@/app/components/SignalHero";
import { HomeSeriesStudio } from "@/app/components/HomeSeriesStudio";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { indicators } from "@/lib/catalog/indicators";
import { isLocale, localized, ui } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const title = locale === "pt-br" ? "Open Economics — A economia, em foco" : "Open Economics — The economy, in focus";
  return { title, description: ui[locale].intro, alternates: { canonical: localized(locale), languages: { en: "/en", "pt-BR": "/pt-br" } } };
}

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value;
  return <main className="signal-page">
    <SiteHeader locale={locale} />
    <SignalHero indicators={indicators} locale={locale} />
    <section className="signal-partners"><span>{locale === "pt-br" ? "Uma camada aberta sobre dados oficiais de" : "An open layer over official data from"}</span><div><b>Banco Central do Brasil</b><i /> <b>IBGE</b><i /> <b>SIDRA</b><i /> <b>SGS</b></div></section>
    <section className="signal-manifesto"><div><p>{locale === "pt-br" ? "ECONOMIA, SEM OPACIDADE" : "ECONOMICS, WITHOUT THE OPACITY"}</p><h2>{locale === "pt-br" ? <>Os dados públicos já existem.<br />Nós fazemos com que eles<br /><em>funcionem para você.</em></> : <>Public data already exists.<br />We make it actually<br /><em>work for you.</em></>}</h2><p>{locale === "pt-br" ? "Uma interface coerente para séries de diferentes órgãos, metodologias e frequências — mantendo a origem e o significado de cada observação." : "One coherent interface across agencies, methods, and frequencies—while preserving the source and meaning of every observation."}</p></div></section>
    <section className="signal-story signal-story-analysis"><div className="signal-story-copy"><span>01</span><p className="signal-eyebrow">{locale === "pt-br" ? "PARA ENTENDER" : "FOR UNDERSTANDING"}</p><h2>{locale === "pt-br" ? "Do contexto ao código, sem trocar de ferramenta." : "From context to code, without switching tools."}</h2><p>{locale === "pt-br" ? "Cada indicador reúne o histórico, a unidade, o período de referência, a metodologia e uma requisição pronta. Análise e implementação começam no mesmo lugar." : "Every indicator brings together history, units, reference periods, methodology, and a ready-to-use request. Analysis and implementation start in the same place."}</p><a href={localized(locale, "/indicators/br-ipca-12m")}>{locale === "pt-br" ? "Conhecer a ficha do IPCA" : "See the IPCA data sheet"}<span>→</span></a></div><HomeSeriesStudio locale={locale} /></section>
    <section className="signal-story signal-story-discovery"><div className="discovery-visual"><div className="discovery-search"><span>⌕</span><b>selic</b><kbd>/</kbd></div>{indicators.filter((item) => item.id.includes("selic")).slice(0, 3).map((item) => <a href={localized(locale, `/indicators/${item.id}`)} key={item.id}><span><b>{item.name}</b><small>{item.officialName}</small></span><strong>{item.unitSymbol}</strong></a>)}</div><div className="signal-story-copy"><span>02</span><p className="signal-eyebrow">{locale === "pt-br" ? "PARA DESCOBRIR" : "FOR DISCOVERY"}</p><h2>{locale === "pt-br" ? "Encontre a série certa, mesmo sem saber o nome certo." : "Find the right series, even without the exact name."}</h2><p>{locale === "pt-br" ? "Busque em português, inglês, por sigla, tema, ID estável ou código oficial. Compare frequência e unidade antes de abrir a série." : "Search in Portuguese, English, by acronym, topic, stable ID, or official code. Compare frequency and units before opening a series."}</p><a href={localized(locale, "/catalog")}>{locale === "pt-br" ? "Explorar o catálogo" : "Explore the catalog"}<span>→</span></a></div></section>
    <section className="signal-proof"><div><p className="signal-eyebrow">{locale === "pt-br" ? "DESENHADO PARA CONFIANÇA" : "DESIGNED FOR TRUST"}</p><h2>{locale === "pt-br" ? "Legível na superfície. Rigoroso por baixo." : "Readable on the surface. Rigorous underneath."}</h2></div><div className="signal-proof-stats"><span><b>{indicators.length}</b><small>{locale === "pt-br" ? "séries conectadas" : "connected series"}</small></span><span><b>2</b><small>{locale === "pt-br" ? "fontes oficiais" : "official publishers"}</small></span><span><b>0</b><small>{locale === "pt-br" ? "valores inventados" : "invented values"}</small></span></div><div className="proof-list"><p><i>01</i><span><b>{locale === "pt-br" ? "Origem preservada" : "Provenance preserved"}</b><small>{locale === "pt-br" ? "URL, código, licença e instante de recuperação acompanham a resposta." : "Source URL, code, license, and retrieval time travel with the response."}</small></span></p><p><i>02</i><span><b>{locale === "pt-br" ? "Ausência explícita" : "Missing means missing"}</b><small>{locale === "pt-br" ? "Supressão, indisponibilidade e zero nunca viram a mesma coisa." : "Suppressed, unavailable, and numeric zero never collapse into one state."}</small></span></p><p><i>03</i><span><b>{locale === "pt-br" ? "Histórico revisável" : "Revision-aware history"}</b><small>{locale === "pt-br" ? "Séries revisadas pelo publicador são atualizadas, não congeladas." : "Publisher revisions are refreshed rather than frozen."}</small></span></p></div></section>
    <section className="signal-final"><div className="final-orbit" aria-hidden="true"><i /><i /><i /><b>OE</b></div><p className="signal-eyebrow">OPEN ECONOMICS API</p><h2>{locale === "pt-br" ? <>A economia brasileira,<br /><em>pronta para usar.</em></> : <>Brazilian economics,<br /><em>ready to use.</em></>}</h2><div><a className="signal-button light" href={localized(locale, "/catalog")}>{locale === "pt-br" ? "Explorar dados" : "Explore data"}<span>↗</span></a><a href={localized(locale, "/docs")}>{locale === "pt-br" ? "Ler a documentação" : "Read the documentation"}<span>→</span></a></div></section>
    <SiteFooter locale={locale} />
  </main>;
}
