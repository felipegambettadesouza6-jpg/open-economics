import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/app/components/CopyButton";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale, localized } from "@/lib/i18n";
import { localizedMetadata, SITE_ORIGIN } from "@/lib/metadata";

const endpoints = {
  monthlyLatest: `${SITE_ORIGIN}/api/v1/indicators/br-ipca-monthly/latest`,
  monthlyHistory: `${SITE_ORIGIN}/api/v1/indicators/br-ipca-monthly/observations?start=2020-01-01&order=asc`,
  annualLatest: `${SITE_ORIGIN}/api/v1/indicators/br-ipca-12m/latest`,
  annualHistory: `${SITE_ORIGIN}/api/v1/indicators/br-ipca-12m/observations?start=2020-01-01&order=asc`,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return localizedMetadata({
    locale,
    path: "/guides/ipca-api",
    title: locale === "pt-br" ? "API do IPCA mensal e acumulado em 12 meses — sem chave | Open Economics" : "Brazil IPCA API: monthly and 12-month inflation | Open Economics",
    description: locale === "pt-br"
      ? "Consulte o IPCA mensal ou acumulado em 12 meses em JSON e CSV. Dados oficiais do IBGE, sem cadastro ou chave de API."
      : "Fetch Brazil's monthly IPCA or trailing 12-month inflation in JSON and CSV. Official IBGE data with no signup or API key.",
  });
}

export default async function IpcaApiGuide({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value;
  const pt = locale === "pt-br";
  const python = `import json
from urllib.request import urlopen

with urlopen("${endpoints.annualLatest}", timeout=30) as response:
    payload = json.load(response)

latest = payload["data"][0]
print(latest["period"], latest["value"])
print(payload["meta"]["provenance"]["source_url"])`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: pt ? "API do IPCA mensal e acumulado em 12 meses" : "Brazil IPCA API: monthly and 12-month inflation",
    description: pt ? "Como consultar a série correta do IPCA em JSON ou CSV." : "How to fetch the correct IPCA series in JSON or CSV.",
    inLanguage: pt ? "pt-BR" : "en",
    url: `${SITE_ORIGIN}${localized(locale, "/guides/ipca-api")}`,
    publisher: { "@type": "Organization", name: "Open Economics", url: SITE_ORIGIN },
  };

  return <main className="atlas-page atlas-utility">
    <SiteHeader locale={locale} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
    <section className="atlas-docs-head"><div className="atlas-shell">
      <p className="atlas-kicker">09 / IPCA API</p>
      <h1>{pt ? "IPCA mensal ou em 12 meses, sem códigos obscuros." : "Monthly or 12-month IPCA without obscure codes."}</h1>
      <p>{pt ? "Use um ID legível, receba a série oficial do IBGE e preserve período, unidade, valor bruto e proveniência em toda resposta." : "Use a readable ID, receive the official IBGE series, and preserve period, unit, raw value, and provenance in every response."}</p>
    </div></section>
    <div className="atlas-docs-layout atlas-shell">
      <aside className="atlas-docs-nav"><strong>{pt ? "Nesta página" : "On this page"}</strong><a href="#choose">{pt ? "Qual IPCA usar" : "Choose a series"}</a><a href="#latest">{pt ? "Último IPCA" : "Latest IPCA"}</a><a href="#python">Python</a><a href="#csv">CSV</a><strong>{pt ? "Mais recursos" : "More resources"}</strong><a href={localized(locale, "/guides/spreadsheets")}>Excel · Google Sheets</a></aside>
      <article className="atlas-docs-content">
        <section id="choose"><p className="atlas-kicker">01 / {pt ? "Escolha a medida" : "Choose the measure"}</p><h2>{pt ? "Variação do mês e inflação em 12 meses são séries diferentes." : "Monthly change and 12-month inflation are different series."}</h2>
          <dl>
            <div><dt>{pt ? "IPCA — variação mensal" : "IPCA — monthly change"}</dt><dd><p>{pt ? "Quanto o índice variou em cada mês. ID estável: br-ipca-monthly." : "How much the index changed in each month. Stable ID: br-ipca-monthly."}</p><a href={localized(locale, "/indicators/br-ipca-monthly")}>{pt ? "Ver IPCA mensal" : "View monthly IPCA"} ↗</a></dd></div>
            <div><dt>{pt ? "IPCA — acumulado em 12 meses" : "IPCA — trailing 12 months"}</dt><dd><p>{pt ? "Inflação acumulada nos doze meses terminados no período. ID: br-ipca-12m." : "Inflation accumulated over the twelve months ending in the period. ID: br-ipca-12m."}</p><a href={localized(locale, "/indicators/br-ipca-12m")}>{pt ? "Ver IPCA em 12 meses" : "View 12-month IPCA"} ↗</a></dd></div>
          </dl>
        </section>
        <section id="latest"><p className="atlas-kicker">02 / JSON</p><h2>{pt ? "Buscar a inflação em 12 meses mais recente." : "Fetch the latest trailing 12-month inflation."}</h2><pre><code>GET {endpoints.annualLatest}</code></pre><CopyButton value={endpoints.annualLatest} label={pt ? "Copiar endpoint" : "Copy endpoint"} successLabel={pt ? "Endpoint copiado" : "Endpoint copied"} activation="api_url_copy" /><div className="docs-callout"><strong>{pt ? "Dados oficiais verificáveis" : "Verifiable official data"}</strong><span>{pt ? "A resposta inclui o agregado e a variável do IBGE, o link da fonte, data de coleta, licença e valor publicado sem alteração." : "The response includes the IBGE aggregate and variable, source link, retrieval time, license, and unchanged published value."}</span></div></section>
        <section id="python"><p className="atlas-kicker">03 / Python</p><h2>{pt ? "Sem dependências externas." : "No external dependencies."}</h2><pre><code>{python}</code></pre><CopyButton value={python} label={pt ? "Copiar Python" : "Copy Python"} successLabel={pt ? "Código copiado" : "Code copied"} activation="code_copy" /></section>
        <section id="csv"><p className="atlas-kicker">04 / CSV</p><h2>{pt ? "Baixar um histórico pronto para análise." : "Download analysis-ready history."}</h2><p>{pt ? "O CSV mantém IDs, datas, valores brutos e URLs oficiais em cada linha." : "The CSV keeps IDs, dates, raw values, and official URLs in every row."}</p><div><a className="atlas-button primary" href={`${endpoints.monthlyHistory}&format=csv`} download data-activation="csv_download">{pt ? "Baixar IPCA mensal" : "Download monthly IPCA"}<span>↓</span></a> <a className="atlas-button primary" href={`${endpoints.annualHistory}&format=csv`} download data-activation="csv_download">{pt ? "Baixar IPCA em 12 meses" : "Download 12-month IPCA"}<span>↓</span></a></div></section>
      </article>
    </div>
    <SiteFooter locale={locale} />
  </main>;
}
