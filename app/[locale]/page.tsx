import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataAtlas } from "@/app/components/DataAtlas";
import { HomeDiscovery } from "@/app/components/HomeDiscovery";
import { SignalHero } from "@/app/components/SignalHero";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { indicators } from "@/lib/catalog/indicators";
import { isLocale, localized, ui } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const title = locale === "pt-br" ? "Open Economics — Dados oficiais, feitos para fluir" : "Open Economics — Official data, made to flow";
  return { title, description: ui[locale].intro, alternates: { canonical: localized(locale), languages: { en: "/en", "pt-BR": "/pt-br" } } };
}

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value;
  const pt = locale === "pt-br";

  return <main className="signal-page">
    <SiteHeader locale={locale} />
    <SignalHero indicators={indicators} locale={locale} />

    <section className="oe-sources" aria-label={pt ? "Fontes de dados" : "Data sources"}>
      <p>{pt ? "UMA INTERFACE ABERTA SOBRE" : "ONE OPEN INTERFACE OVER"}</p>
      <div><span>Banco Central do Brasil</span><i /> <span>IBGE</span><i /> <span>SIDRA</span><i /> <span>SGS</span></div>
      <small>{pt ? "Com origem, unidade e metodologia preservadas" : "With provenance, units, and methodology preserved"}</small>
    </section>

    <section className="oe-manifesto">
      <p className="oe-label">{pt ? "DADOS PÚBLICOS, SEM A FRICÇÃO" : "PUBLIC DATA, WITHOUT THE FRICTION"}</p>
      <h2>{pt ? <>A economia já fala.<br />Nós tornamos a linguagem <span>clara.</span></> : <>The economy already speaks.<br />We make its language <span>clear.</span></>}</h2>
      <div className="oe-manifesto-copy"><span>01 — 03</span><p>{pt ? "Diferentes órgãos, formatos, frequências e convenções se tornam uma experiência coerente — sem apagar o contexto de origem." : "Different agencies, formats, frequencies, and conventions become one coherent experience—without erasing their original context."}</p></div>
    </section>

    <section className="oe-confluence" data-nav-theme="dark">
      <div className="oe-confluence-copy">
        <p className="oe-label">{pt ? "UMA CAMADA CONSISTENTE" : "ONE CONSISTENT LAYER"}</p>
        <h2>{pt ? "Muitas fontes. Uma forma de trabalhar." : "Many sources. One way to work."}</h2>
        <p>{pt ? "Pesquise por conceito, compare séries e use a mesma estrutura de resposta em todos os indicadores." : "Search by concept, compare series, and work with the same response structure across every indicator."}</p>
        <a href={localized(locale, "/sources")}>{pt ? "Ver fontes e licenças" : "See sources and licenses"}<span>→</span></a>
      </div>
      <div className="oe-stream" aria-hidden="true">
        <div className="normalization-head"><span>UPSTREAM RECORDS</span><span>OPEN ECONOMICS SCHEMA</span></div>
        <div className="normalization-row row-bcb"><div><b>BCB · SGS 432</b><code>23/08/2026&nbsp;&nbsp;15.00</code><small>daily · % p.a.</small></div><i /><div><code>br-selic-target</code><b>2026-08-23&nbsp;&nbsp;15.00</b><small>BCB · observed</small></div></div>
        <div className="normalization-row row-ibge"><div><b>IBGE · SIDRA 7060</b><code>202607&nbsp;&nbsp;0.07</code><small>monthly · %</small></div><i /><div><code>br-ipca-monthly</code><b>2026-07&nbsp;&nbsp;0.07</b><small>IBGE · observed</small></div></div>
        <div className="normalization-row row-activity"><div><b>BCB · SGS 24364</b><code>202606&nbsp;&nbsp;148.70</code><small>monthly · index</small></div><i /><div><code>br-ibc-br</code><b>2026-06&nbsp;&nbsp;148.70</b><small>BCB · observed</small></div></div>
        <div className="normalization-schema"><span>date</span><span>period</span><span>value</span><span>raw_value</span><span>status</span><span>provenance</span></div>
      </div>
    </section>

    <section className="oe-data-section">
      <header><p className="oe-label">{pt ? "DADOS PARA VER E USAR" : "DATA TO SEE AND USE"}</p><h2>{pt ? "Cada série é uma história — e um endpoint." : "Every series is a story—and an endpoint."}</h2><p>{pt ? "Leia a tendência, verifique a metodologia e passe ao código sem perder o contexto." : "Read the trend, verify the methodology, and move to code without losing context."}</p></header>
      <DataAtlas locale={locale} />
    </section>

    <section className="oe-discover">
      <div className="oe-discover-head">
        <p className="oe-label">{pt ? "DESCOBERTA NATURAL" : "NATURAL DISCOVERY"}</p>
        <h2>{pt ? <>Encontre a série certa,<br />mesmo sem o nome certo.</> : <>Find the right series,<br />even without the right name.</>}</h2>
      </div>
      <HomeDiscovery items={indicators} locale={locale} />
    </section>

    <section className="oe-api" data-nav-theme="dark">
      <div className="oe-api-grid" aria-hidden="true" />
      <div className="oe-api-heading"><p className="oe-label">OPEN ECONOMICS API</p><h2>{pt ? <>Do dado oficial<br />ao seu produto,<br /><span>em uma chamada.</span></> : <>From official data<br />to your product,<br /><span>in one call.</span></>}</h2></div>
      <div className="oe-transform" aria-hidden="true"><span><i>01</i> Official observation<b>IBGE · 2026-07 · 0.07</b></span><em>→</em><span><i>02</i> Normalized series<b>br-ipca-monthly</b></span><em>→</em><span><i>03</i> Product-ready JSON<b>value · period · provenance</b></span></div>
      <div className="oe-code-window">
        <div><span>REQUEST</span><span>JSON</span></div>
        <pre><code><i>GET</i> /api/v1/indicators/br-ipca-12m/observations<br /><br /><em>{`{`}</em><br />  <b>&quot;indicator&quot;</b>: <q>br-ipca-12m</q>,<br />  <b>&quot;unit&quot;</b>: <q>percent</q>,<br />  <b>&quot;source&quot;</b>: <q>IBGE</q>,<br />  <b>&quot;data&quot;</b>: [<br />    {`{`} <b>&quot;period&quot;</b>: <q>2026-07</q>, <b>&quot;value&quot;</b>: 4.44 {`}`}<br />  ]<br /><em>{`}`}</em></code></pre>
        <footer><span>200 OK</span><span>182 ms</span><span>PROVENANCE INCLUDED</span></footer>
      </div>
      <div className="oe-code-tape" aria-hidden="true"><span>REST / JSON / OPENAPI 3.1 / NO AUTHENTICATION / STABLE IDS / SOURCE LINKS / REVISION AWARE /</span><span>REST / JSON / OPENAPI 3.1 / NO AUTHENTICATION / STABLE IDS / SOURCE LINKS / REVISION AWARE /</span></div>
      <div className="oe-api-actions"><p>{pt ? "Sem chave. Sem cadastro. Comece no navegador e leve para produção quando quiser." : "No key. No signup. Start in the browser and take it to production when you’re ready."}</p><div><a className="signal-button light" href={localized(locale, "/playground")}>{pt ? "Testar a API" : "Try the API"}<span>↗</span></a><a href={localized(locale, "/docs")}>{pt ? "Ler documentação" : "Read documentation"}<span>→</span></a></div></div>
    </section>

    <SiteFooter locale={locale} dramatic />
  </main>;
}
