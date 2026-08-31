import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/app/components/CopyButton";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale, localized } from "@/lib/i18n";
import { localizedMetadata, SITE_ORIGIN } from "@/lib/metadata";

const endpoints = {
  latest: `${SITE_ORIGIN}/api/v1/indicators/br-cdi-monthly/latest`,
  history: `${SITE_ORIGIN}/api/v1/indicators/br-cdi-monthly/observations?start=2020-01-01&order=asc`,
  csv: `${SITE_ORIGIN}/api/v1/indicators/br-cdi-monthly/observations?start=2020-01-01&order=asc&format=csv`,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return localizedMetadata({
    locale,
    path: "/guides/cdi-api",
    title: locale === "pt-br" ? "API do CDI mensal em JSON, Excel e Google Sheets — sem chave | Open Economics" : "Brazil CDI API for JSON, Excel, and Google Sheets | Open Economics",
    description: locale === "pt-br"
      ? "Consulte o CDI acumulado no mês em JSON ou CSV e importe no Excel e Google Sheets. Série oficial 4391 do Banco Central, sem cadastro ou chave."
      : "Fetch Brazil's monthly accumulated CDI in JSON or CSV and import it into Excel or Google Sheets. Official BCB series 4391, with no signup or API key.",
  });
}

export default async function CdiApiGuide({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value;
  const pt = locale === "pt-br";
  const sheets = `=IMPORTDATA("${endpoints.csv}")`;
  const javascript = `const response = await fetch("${endpoints.latest}");
if (!response.ok) throw new Error(\`HTTP \${response.status}\`);

const { data, meta } = await response.json();
console.log(data[0].period, data[0].value, meta.indicator.unit_symbol);`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: pt ? "API do CDI mensal oficial" : "Official Brazil monthly CDI API",
    description: pt ? "Como consultar a série 4391 do CDI acumulado no mês em JSON, CSV e planilhas." : "How to fetch official monthly accumulated CDI in JSON, CSV, and spreadsheets.",
    inLanguage: pt ? "pt-BR" : "en",
    url: `${SITE_ORIGIN}${localized(locale, "/guides/cdi-api")}`,
    publisher: { "@type": "Organization", name: "Open Economics", url: SITE_ORIGIN },
  };

  return <main className="atlas-page atlas-utility">
    <SiteHeader locale={locale} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
    <section className="atlas-docs-head"><div className="atlas-shell">
      <p className="atlas-kicker">10 / CDI API</p>
      <h1>{pt ? "CDI mensal oficial, pronto para código e planilha." : "Official monthly CDI, ready for code and spreadsheets."}</h1>
      <p>{pt ? "Use um ID legível para consultar o CDI acumulado em cada mês. A resposta normaliza a série 4391 do Banco Central e preserva valor bruto, período e link da fonte." : "Use a readable ID to fetch CDI accumulated in each month. The response normalizes Banco Central series 4391 while preserving its raw value, period, and source link."}</p>
    </div></section>
    <div className="atlas-docs-layout atlas-shell">
      <aside className="atlas-docs-nav"><strong>{pt ? "Nesta página" : "On this page"}</strong><a href="#right-series">CDI mensal</a><a href="#json">JSON</a><a href="#sheets">Google Sheets</a><a href="#excel">Excel · CSV</a><strong>{pt ? "Mais recursos" : "More resources"}</strong><a href={localized(locale, "/guides/selic-api")}>{pt ? "Selic: meta, efetiva e mensal" : "Selic: target, effective, monthly"}</a><a href={localized(locale, "/guides/spreadsheets")}>{pt ? "Todas as fórmulas de planilha" : "All spreadsheet recipes"}</a></aside>
      <article className="atlas-docs-content">
        <section id="right-series"><p className="atlas-kicker">01 / {pt ? "Série correta" : "The right series"}</p><h2>{pt ? "CDI mensal não é a meta Selic." : "Monthly CDI is not the Selic target."}</h2><p>{pt ? "Este endpoint entrega o percentual do CDI acumulado em cada mês-calendário, publicado pelo BCB como série SGS 4391. Para a meta anual do Copom ou a Selic efetiva, use o guia da Selic." : "This endpoint returns CDI accumulated in each calendar month, published by BCB as SGS series 4391. For the annual Copom target or effective Selic, use the Selic guide."}</p><div className="docs-callout"><strong>{pt ? "Sem ambiguidade" : "Unambiguous semantics"}</strong><span>{pt ? "ID estável: br-cdi-monthly · frequência mensal · unidade % a.m." : "Stable ID: br-cdi-monthly · monthly frequency · unit % per month."}</span></div></section>
        <section id="json"><p className="atlas-kicker">02 / JSON</p><h2>{pt ? "Buscar o CDI mensal mais recente." : "Fetch the latest monthly CDI."}</h2><pre><code>GET {endpoints.latest}</code></pre><CopyButton value={endpoints.latest} label={pt ? "Copiar endpoint" : "Copy endpoint"} successLabel={pt ? "Endpoint copiado" : "Endpoint copied"} activation="api_url_copy" /><h3>JavaScript</h3><pre><code>{javascript}</code></pre><CopyButton value={javascript} label={pt ? "Copiar JavaScript" : "Copy JavaScript"} successLabel={pt ? "Código copiado" : "Code copied"} activation="code_copy" /></section>
        <section id="sheets"><p className="atlas-kicker">03 / Google Sheets</p><h2>{pt ? "Cole uma fórmula em A1." : "Paste one formula into A1."}</h2><pre><code>{sheets}</code></pre><CopyButton value={sheets} label={pt ? "Copiar fórmula do Sheets" : "Copy Sheets formula"} successLabel={pt ? "Fórmula copiada" : "Formula copied"} activation="code_copy" /><p>{pt ? "A fórmula importa o histórico desde 2020 e volta a consultar a mesma URL estável quando a planilha atualiza." : "The formula imports history since 2020 and uses the same stable URL whenever the spreadsheet refreshes."}</p></section>
        <section id="excel"><p className="atlas-kicker">04 / Excel · CSV</p><h2>{pt ? "Baixe agora ou conecte com Dados → Da Web." : "Download now or connect with Data → From Web."}</h2><p>{pt ? "O CSV inclui data, período, valor, ID da série e URLs oficiais em cada linha." : "Every CSV row includes date, period, value, series ID, and official-source URLs."}</p><a className="atlas-button primary" href={endpoints.csv} download data-activation="csv_download">{pt ? "Baixar histórico do CDI" : "Download CDI history"}<span>↓</span></a> <CopyButton value={endpoints.csv} label={pt ? "Copiar URL para Excel" : "Copy URL for Excel"} successLabel={pt ? "URL copiada" : "URL copied"} activation="api_url_copy" /></section>
      </article>
    </div>
    <SiteFooter locale={locale} />
  </main>;
}
