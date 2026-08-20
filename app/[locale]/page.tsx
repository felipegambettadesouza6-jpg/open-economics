import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AtlasSearch } from "@/app/components/AtlasSearch";
import { EconomicPulse } from "@/app/components/EconomicPulse";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { indicators } from "@/lib/catalog/indicators";
import { isLocale, localized, ui } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const title = locale === "pt-br" ? "Open Economics — A economia do Brasil, agora legível" : "Open Economics — Brazil’s economy, made readable";
  return { title, description: ui[locale].intro, alternates: { canonical: localized(locale), languages: { en: "/en", "pt-BR": "/pt-br" } } };
}

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value; const copy = ui[locale];
  return <main className="atlas-page">
    <SiteHeader locale={locale} />
    <section className="atlas-hero atlas-shell">
      <div className="atlas-hero-copy"><p className="atlas-kicker"><span>OPEN DATA / BR</span><code>2026—</code></p><h1>{copy.headline}</h1><p>{copy.intro}</p><div className="atlas-hero-actions"><a className="atlas-button primary" href={localized(locale, "/catalog")}>{copy.explore}<span>↗</span></a><a className="atlas-button" href={localized(locale, "/docs")}>{copy.build}</a></div></div>
      <AtlasSearch indicators={indicators} locale={locale} />
      <div className="hero-axis" aria-hidden="true"><span>TIME →</span><i /><small>OPEN ECONOMICS / INDEX 001</small></div>
    </section>
    <section className="atlas-pulse-section"><div className="atlas-shell"><div className="atlas-section-head"><div><p className="atlas-kicker">{copy.pulse}</p><h2>{copy.pulseTitle}</h2></div><p>{copy.pulseCopy}</p></div><EconomicPulse locale={locale} /></div></section>
    <section className="atlas-dual atlas-shell"><div className="atlas-section-head"><div><p className="atlas-kicker">01 / Chart → request</p><h2>{copy.useTitle}</h2></div><p>{copy.useCopy}</p></div><div className="dual-workspace"><div className="dual-chart"><div className="dual-meta"><span>{copy.analyst}</span><b>IPCA · 12 months</b><small>Índice Nacional de Preços ao Consumidor Amplo</small></div><div className="demo-chart" aria-label="Illustrative chart area; live chart available on the indicator page"><span>12M</span><svg viewBox="0 0 800 250" preserveAspectRatio="none" aria-hidden="true"><path className="demo-grid" d="M0 20H800M0 95H800M0 170H800M0 245H800"/><path className="demo-path" d="M0 202 C85 180 115 192 180 146 S280 90 350 118 S470 182 540 140 S650 45 800 64"/></svg><small>2024</small><small>2026</small></div></div><div className="dual-code"><span>{copy.developer}</span><code><b>GET</b> /api/v1/indicators/<em>br-ipca-12m</em>/observations</code><pre>curl --fail --silent<br />&nbsp;&nbsp;&quot;/api/v1/indicators/br-ipca-12m/observations?start=2024-01-01&quot;</pre><a href={localized(locale, "/playground?indicator=br-ipca-12m")}>Open in playground ↗</a></div></div></section>
    <section className="atlas-provenance"><div className="atlas-shell"><div><p className="atlas-kicker">{copy.provenance}</p><h2>{copy.provenanceTitle}</h2></div><div className="source-trail"><span>Open Economics<small>normalized schema</small></span><i>→</i><span>IBGE / SIDRA<small>table 1737 · variable 2265</small></span><i>→</i><span>Official observation<small>raw value + status preserved</small></span></div></div></section>
    <SiteFooter locale={locale} />
  </main>;
}
