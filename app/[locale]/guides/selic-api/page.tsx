import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/app/components/CopyButton";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale, localized } from "@/lib/i18n";
import { localizedMetadata, SITE_ORIGIN } from "@/lib/metadata";

const endpoints = {
  monthlyLatest: `${SITE_ORIGIN}/api/v1/indicators/br-selic-monthly/latest`,
  monthlyHistory: `${SITE_ORIGIN}/api/v1/indicators/br-selic-monthly/observations?start=2020-01-01&order=asc`,
  targetLatest: `${SITE_ORIGIN}/api/v1/indicators/br-selic-target/latest`,
  effectiveLatest: `${SITE_ORIGIN}/api/v1/indicators/br-selic-effective/latest`,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return localizedMetadata({
    locale,
    path: "/guides/selic-api",
    title: locale === "pt-br" ? "API da Selic mensal, meta e efetiva — sem chave | Open Economics" : "Brazil Selic API: monthly, target, and effective rates | Open Economics",
    description: locale === "pt-br"
      ? "Consulte a Selic acumulada no mês, a meta do Copom e a taxa efetiva em JSON ou CSV. API pública do BCB normalizada, sem cadastro ou chave."
      : "Fetch Brazil's monthly accumulated Selic, Copom target, and effective rates in JSON or CSV. A normalized public BCB API with no key.",
  });
}

export default async function SelicApiGuide({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value;
  const pt = locale === "pt-br";
  const javascript = `const response = await fetch("${endpoints.monthlyLatest}");
if (!response.ok) throw new Error(\`HTTP \${response.status}\`);

const { data, meta } = await response.json();
console.log(data[0].value, meta.indicator.unit_symbol);`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: pt ? "API da Selic mensal, meta e efetiva" : "Brazil Selic API: monthly, target, and effective rates",
    description: pt ? "Como escolher e consultar a série Selic correta em JSON ou CSV." : "How to choose and fetch the correct Selic series in JSON or CSV.",
    inLanguage: pt ? "pt-BR" : "en",
    url: `${SITE_ORIGIN}${localized(locale, "/guides/selic-api")}`,
    publisher: { "@type": "Organization", name: "Open Economics", url: SITE_ORIGIN },
  };

  return <main className="atlas-page atlas-utility">
    <SiteHeader locale={locale} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
    <section className="atlas-docs-head"><div className="atlas-shell">
      <p className="atlas-kicker">08 / SELIC API</p>
      <h1>{pt ? "A série Selic certa, em uma chamada." : "The right Selic series in one call."}</h1>
      <p>{pt ? "Meta do Copom, taxa efetiva e acumulado mensal não são o mesmo dado. Escolha a semântica correta e receba valores oficiais do BCB em JSON ou CSV." : "The Copom target, effective rate, and monthly accumulated rate are different data. Choose the correct semantics and receive official BCB values in JSON or CSV."}</p>
    </div></section>
    <div className="atlas-docs-layout atlas-shell">
      <aside className="atlas-docs-nav"><strong>{pt ? "Nesta página" : "On this page"}</strong><a href="#choose">{pt ? "Qual Selic usar" : "Choose a series"}</a><a href="#monthly">{pt ? "Selic mensal" : "Monthly Selic"}</a><a href="#javascript">JavaScript</a><a href="#csv">CSV</a><strong>{pt ? "Mais recursos" : "More resources"}</strong><a href={localized(locale, "/guides/spreadsheets")}>Excel · Google Sheets</a></aside>
      <article className="atlas-docs-content">
        <section id="choose"><p className="atlas-kicker">01 / {pt ? "Escolha sem ambiguidade" : "Choose without ambiguity"}</p><h2>{pt ? "Três séries, três usos." : "Three series, three uses."}</h2>
          <dl>
            <div><dt>{pt ? "Selic acumulada no mês" : "Selic accumulated in month"}</dt><dd><p>{pt ? "Use para obter o percentual efetivo acumulado em cada mês-calendário. ID estável: br-selic-monthly." : "Use for the effective percentage accumulated in each calendar month. Stable ID: br-selic-monthly."}</p><a href={localized(locale, "/indicators/br-selic-monthly")}>{pt ? "Ver série mensal" : "View monthly series"} ↗</a></dd></div>
            <div><dt>{pt ? "Meta Selic do Copom" : "Copom Selic target"}</dt><dd><p>{pt ? "Use para a meta anual vigente definida pelo Copom. ID: br-selic-target." : "Use for the current annual target set by Copom. ID: br-selic-target."}</p><a href={localized(locale, "/indicators/br-selic-target")}>{pt ? "Ver meta Selic" : "View target series"} ↗</a></dd></div>
            <div><dt>{pt ? "Selic efetiva anualizada" : "Annualized effective Selic"}</dt><dd><p>{pt ? "Use para a taxa overnight anualizada em base de 252 dias úteis. ID: br-selic-effective." : "Use for the overnight effective rate annualized on a 252-business-day basis. ID: br-selic-effective."}</p><a href={localized(locale, "/indicators/br-selic-effective")}>{pt ? "Ver taxa efetiva" : "View effective series"} ↗</a></dd></div>
          </dl>
        </section>
        <section id="monthly"><p className="atlas-kicker">02 / JSON</p><h2>{pt ? "Buscar a Selic acumulada no mês mais recente." : "Fetch the latest accumulated monthly Selic."}</h2><pre><code>GET {endpoints.monthlyLatest}</code></pre><CopyButton value={endpoints.monthlyLatest} label={pt ? "Copiar endpoint" : "Copy endpoint"} successLabel={pt ? "Endpoint copiado" : "Endpoint copied"} activation="api_url_copy" /><div className="docs-callout"><strong>{pt ? "Sem código numérico" : "No numeric code required"}</strong><span>{pt ? "O ID descreve a semântica da série; a resposta ainda preserva o código oficial e o link do BCB para auditoria." : "The ID describes the series semantics; the response still preserves the official BCB code and source link for auditability."}</span></div></section>
        <section id="javascript"><p className="atlas-kicker">03 / JavaScript</p><h2>{pt ? "Usar direto no navegador ou Node.js." : "Use it directly in a browser or Node.js."}</h2><pre><code>{javascript}</code></pre><CopyButton value={javascript} label={pt ? "Copiar JavaScript" : "Copy JavaScript"} successLabel={pt ? "Código copiado" : "Code copied"} activation="code_copy" /></section>
        <section id="csv"><p className="atlas-kicker">04 / CSV</p><h2>{pt ? "Levar o histórico para planilha, BI ou R." : "Take the history to a spreadsheet, BI tool, or R."}</h2><p>{pt ? "Adicione format=csv ao endpoint de observações. Cada linha mantém indicator_id, source_id, source_url e upstream_url." : "Add format=csv to the observations endpoint. Every row keeps indicator_id, source_id, source_url, and upstream_url."}</p><pre><code>{endpoints.monthlyHistory}&amp;format=csv</code></pre><a className="atlas-button primary" href={`${endpoints.monthlyHistory}&format=csv`} download data-activation="csv_download">{pt ? "Baixar histórico da Selic mensal" : "Download monthly Selic history"}<span>↓</span></a></section>
      </article>
    </div>
    <SiteFooter locale={locale} />
  </main>;
}
