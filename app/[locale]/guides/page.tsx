import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/app/components/CopyButton";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale, localized } from "@/lib/i18n";
import { localizedMetadata, SITE_ORIGIN } from "@/lib/metadata";

const pythonLatest = `import requests

url = "${SITE_ORIGIN}/api/v1/indicators/br-ipca-12m/latest"
response = requests.get(url, timeout=30)
response.raise_for_status()

payload = response.json()
latest = payload["data"][0]
print(f"IPCA 12 months: {latest['value']}% ({latest['period']})")`;

const javascriptLatest = `const url = "${SITE_ORIGIN}/api/v1/indicators/br-selic-target/latest";
const response = await fetch(url);
if (!response.ok) throw new Error(\`HTTP \${response.status}\`);

const { data, meta } = await response.json();
console.log({
  value: data[0].value,
  period: data[0].period,
  unit: meta.indicator.unit_symbol,
  source: meta.provenance.source_url,
});`;

const pythonCompare = `import requests
import pandas as pd

API = "${SITE_ORIGIN}/api/v1"

def series(indicator):
    response = requests.get(
        f"{API}/indicators/{indicator}/observations",
        params={"start": "2020-01-01", "order": "asc", "limit": 5000},
        timeout=30,
    )
    response.raise_for_status()
    return pd.DataFrame(response.json()["data"])

inflation = series("br-ipca-12m").assign(month=lambda x: x["date"].str[:7])
selic = series("br-selic-target").assign(month=lambda x: x["date"].str[:7])
selic_monthly = selic.groupby("month", as_index=False).last()

comparison = inflation[["month", "value"]].merge(
    selic_monthly[["month", "value"]], on="month", suffixes=("_ipca", "_selic")
)
print(comparison.tail(12).to_string(index=False))`;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return localizedMetadata({
    locale,
    path: "/guides",
    title: locale === "pt-br" ? "API de dados econômicos do Brasil: exemplos | Open Economics" : "Brazil economic data API examples | Open Economics",
    description: locale === "pt-br"
      ? "Exemplos práticos para consultar IPCA e Selic com Python, JavaScript, pandas, JSON e CSV — sem chave de API."
      : "Practical examples for fetching Brazilian IPCA inflation and Selic rates with Python, JavaScript, pandas, JSON, and CSV — no API key.",
  });
}

export default async function GuidesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value;
  const pt = locale === "pt-br";
  const csvUrl = `${SITE_ORIGIN}/api/v1/indicators/br-ipca-monthly/observations?start=2024-01-01&format=csv`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: pt ? "Como usar dados de IPCA e Selic em Python, JavaScript e CSV" : "How to use Brazilian IPCA and Selic data in Python, JavaScript, and CSV",
    description: pt ? "Receitas executáveis para a API pública da Open Economics." : "Runnable recipes for the public Open Economics API.",
    inLanguage: pt ? "pt-BR" : "en",
    url: `${SITE_ORIGIN}${localized(locale, "/guides")}`,
    publisher: { "@type": "Organization", name: "Open Economics", url: SITE_ORIGIN },
  };

  return <main className="atlas-page atlas-utility">
    <SiteHeader locale={locale} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <section className="atlas-docs-head"><div className="atlas-shell">
      <p className="atlas-kicker">06 / {pt ? "Receitas práticas" : "Practical recipes"}</p>
      <h1>{pt ? "Dados econômicos do Brasil, do endpoint à resposta." : "Brazilian economic data, from endpoint to answer."}</h1>
      <p>{pt ? "Exemplos completos e copiáveis para buscar IPCA e Selic em minutos. Sem cadastro, chave ou SDK." : "Complete, copyable examples for fetching IPCA and Selic in minutes. No signup, key, or SDK."}</p>
    </div></section>
    <div className="atlas-docs-layout atlas-shell">
      <aside className="atlas-docs-nav"><strong>{pt ? "Exemplos" : "Examples"}</strong><a href="#python-ipca">Python · IPCA</a><a href="#javascript-selic">JavaScript · Selic</a><a href="#csv">CSV</a><a href="#compare">IPCA × Selic</a><strong>{pt ? "Guias por tarefa" : "Task guides"}</strong><a href={localized(locale, "/guides/ipca-api")}>{pt ? "API do IPCA" : "IPCA API"}</a><a href={localized(locale, "/guides/selic-api")}>{pt ? "API da Selic" : "Selic API"}</a><a href={localized(locale, "/guides/spreadsheets")}>Excel · Google Sheets</a><strong>{pt ? "Próximo passo" : "Next step"}</strong><a href={localized(locale, "/playground")}>Playground</a><a href={localized(locale, "/docs/api-reference")}>{pt ? "Referência da API" : "API reference"}</a></aside>
      <article className="atlas-docs-content">
        <section id="python-ipca"><p className="atlas-kicker">01 / Python</p><h2>{pt ? "Buscar a inflação brasileira mais recente" : "Fetch the latest Brazilian inflation rate"}</h2><p>{pt ? "Este exemplo usa a variação do IPCA acumulada em 12 meses. A resposta mantém período, unidade e links da fonte oficial." : "This example uses the 12-month IPCA change. The response preserves the period, unit, and official-source links."}</p><pre><code>{pythonLatest}</code></pre><CopyButton value={pythonLatest} label={pt ? "Copiar Python" : "Copy Python"} successLabel={pt ? "Copiado" : "Copied"} activation="code_copy" /><p><small>pip install requests</small></p></section>
        <section id="javascript-selic"><p className="atlas-kicker">02 / JavaScript</p><h2>{pt ? "Consultar a meta Selic atual" : "Get the current Selic target"}</h2><p>{pt ? "Funciona em Node.js moderno e no navegador. CORS está habilitado em todos os endpoints públicos." : "Works in modern Node.js and in the browser. CORS is enabled on every public endpoint."}</p><pre><code>{javascriptLatest}</code></pre><CopyButton value={javascriptLatest} label={pt ? "Copiar JavaScript" : "Copy JavaScript"} successLabel={pt ? "Copiado" : "Copied"} activation="code_copy" /></section>
        <section id="csv"><p className="atlas-kicker">03 / CSV</p><h2>{pt ? "Baixar IPCA para Excel, Sheets ou R" : "Download IPCA for Excel, Sheets, or R"}</h2><p>{pt ? "Adicione format=csv a uma consulta de observações. O arquivo repete IDs e URLs de origem em cada linha, preservando a proveniência fora do JSON." : "Add format=csv to an observations request. Every row repeats source IDs and URLs, preserving provenance outside JSON."}</p><pre><code>{csvUrl}</code></pre><a className="atlas-button primary" href={csvUrl} download data-activation="csv_download">{pt ? "Baixar CSV de exemplo" : "Download example CSV"}<span>↓</span></a></section>
        <section id="compare"><p className="atlas-kicker">04 / pandas</p><h2>{pt ? "Comparar Selic e inflação por mês" : "Compare Selic and inflation by month"}</h2><p>{pt ? "A Selic é diária e o IPCA em 12 meses é mensal. O exemplo escolhe a última meta Selic de cada mês antes de combinar as séries — uma decisão explícita, não uma transformação escondida." : "Selic is daily while 12-month IPCA is monthly. This example selects the final Selic target in each month before joining the series—an explicit choice, not a hidden transformation."}</p><pre><code>{pythonCompare}</code></pre><CopyButton value={pythonCompare} label={pt ? "Copiar comparação" : "Copy comparison"} successLabel={pt ? "Copiado" : "Copied"} activation="code_copy" /><p><small>pip install requests pandas</small></p></section>
        <section><div className="docs-callout"><strong>{pt ? "Precisa de outra série?" : "Need another series?"}</strong><span>{pt ? "Pesquise o catálogo por conceito, fonte ou código oficial e substitua o ID estável no exemplo." : "Search the catalog by concept, source, or official code, then replace the stable ID in any example."}</span></div><a className="atlas-button primary" href={localized(locale, "/catalog")}>{pt ? "Pesquisar indicadores" : "Search indicators"}<span>→</span></a></section>
      </article>
    </div>
    <SiteFooter locale={locale} />
  </main>;
}
