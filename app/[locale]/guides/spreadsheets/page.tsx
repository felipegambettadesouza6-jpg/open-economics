import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/app/components/CopyButton";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale, localized } from "@/lib/i18n";
import { localizedMetadata, SITE_ORIGIN } from "@/lib/metadata";

const csv = {
  ipcaMonthly: `${SITE_ORIGIN}/api/v1/indicators/br-ipca-monthly/observations?start=2020-01-01&order=asc&format=csv`,
  ipca12m: `${SITE_ORIGIN}/api/v1/indicators/br-ipca-12m/observations?start=2020-01-01&order=asc&format=csv`,
  selicMonthly: `${SITE_ORIGIN}/api/v1/indicators/br-selic-monthly/observations?start=2020-01-01&order=asc&format=csv`,
  selicTarget: `${SITE_ORIGIN}/api/v1/indicators/br-selic-target/observations?start=2025-01-01&order=asc&format=csv`,
  usdBrl: `${SITE_ORIGIN}/api/v1/indicators/br-usd-brl/observations?start=2026-01-01&order=asc&format=csv`,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return localizedMetadata({
    locale,
    path: "/guides/spreadsheets",
    title: locale === "pt-br" ? "IPCA e Selic no Google Sheets e Excel | Open Economics" : "Brazil IPCA and Selic in Google Sheets and Excel | Open Economics",
    description: locale === "pt-br"
      ? "Importe IPCA, Selic e dólar em planilhas com CSV público, sem cadastro ou chave de API. Fórmulas e URLs prontas para copiar."
      : "Import Brazil IPCA, Selic, and exchange-rate data into spreadsheets with public CSV—no signup or API key. Copy-ready formulas and URLs.",
  });
}

export default async function SpreadsheetGuide({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value;
  const pt = locale === "pt-br";
  const sheetsFormula = `=IMPORTDATA("${csv.ipca12m}")`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: pt ? "Como importar IPCA e Selic no Google Sheets e Excel" : "How to import Brazil IPCA and Selic into Google Sheets and Excel",
    description: pt ? "Use CSV público da Open Economics em uma planilha, sem chave de API." : "Use Open Economics public CSV in a spreadsheet without an API key.",
    inLanguage: pt ? "pt-BR" : "en",
    totalTime: "PT2M",
    step: [
      { "@type": "HowToStep", name: pt ? "Escolha uma série" : "Choose a series", text: pt ? "Selecione uma URL pronta de IPCA, Selic ou dólar." : "Select a copy-ready IPCA, Selic, or exchange-rate URL." },
      { "@type": "HowToStep", name: pt ? "Importe o CSV" : "Import the CSV", text: pt ? "Use IMPORTDATA no Google Sheets ou Dados > Da Web no Excel." : "Use IMPORTDATA in Google Sheets or Data > From Web in Excel." },
      { "@type": "HowToStep", name: pt ? "Atualize os dados" : "Refresh the data", text: pt ? "A planilha consulta a mesma URL estável quando é recalculada ou atualizada." : "The spreadsheet uses the same stable URL when recalculated or refreshed." },
    ],
  };

  return <main className="atlas-page atlas-utility">
    <SiteHeader locale={locale} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
    <section className="atlas-docs-head"><div className="atlas-shell">
      <p className="atlas-kicker">07 / {pt ? "Planilhas" : "Spreadsheets"}</p>
      <h1>{pt ? "IPCA e Selic na sua planilha, em dois minutos." : "Brazil IPCA and Selic in your spreadsheet in two minutes."}</h1>
      <p>{pt ? "CSV público, direto das fontes oficiais, com URLs estáveis. Sem cadastro, chave de API, add-on ou código." : "Public CSV from official sources with stable URLs. No signup, API key, add-on, or code."}</p>
    </div></section>
    <div className="atlas-docs-layout atlas-shell">
      <aside className="atlas-docs-nav">
        <strong>{pt ? "Nesta página" : "On this page"}</strong>
        <a href="#sheets">Google Sheets</a><a href="#excel">Excel</a><a href="#series">{pt ? "URLs prontas" : "Ready-made URLs"}</a><a href="#columns">{pt ? "Colunas" : "Columns"}</a>
        <strong>{pt ? "Mais exemplos" : "More examples"}</strong><a href={localized(locale, "/guides")}>Python · JavaScript · pandas</a>
      </aside>
      <article className="atlas-docs-content">
        <section id="sheets"><p className="atlas-kicker">01 / Google Sheets</p>
          <h2>{pt ? "Cole uma fórmula em A1." : "Paste one formula into A1."}</h2>
          <p>{pt ? "Esta fórmula importa o histórico do IPCA acumulado em 12 meses desde 2020. O cabeçalho e a proveniência vêm junto com os valores." : "This formula imports Brazil's trailing 12-month IPCA history since 2020. Headers and provenance travel with the values."}</p>
          <pre><code>{sheetsFormula}</code></pre>
          <CopyButton value={sheetsFormula} label={pt ? "Copiar fórmula do Sheets" : "Copy Sheets formula"} successLabel={pt ? "Fórmula copiada" : "Formula copied"} activation="code_copy" />
          <div className="docs-callout"><strong>{pt ? "Localidade da planilha" : "Spreadsheet locale"}</strong><span>{pt ? "Se sua planilha usa ponto e vírgula em funções com vários argumentos, esta fórmula continua igual: IMPORTDATA recebe apenas uma URL." : "This formula has one argument, so it works whether your spreadsheet normally separates function arguments with commas or semicolons."}</span></div>
        </section>
        <section id="excel"><p className="atlas-kicker">02 / Microsoft Excel</p>
          <h2>{pt ? "Use Dados → Da Web." : "Use Data → From Web."}</h2>
          <ol>
            <li>{pt ? "Copie uma das URLs CSV abaixo." : "Copy one of the CSV URLs below."}</li>
            <li>{pt ? "No Excel, abra Dados → Obter Dados → Da Web." : "In Excel, open Data → Get Data → From Web."}</li>
            <li>{pt ? "Cole a URL, confirme o delimitador vírgula e carregue a tabela." : "Paste the URL, confirm comma as the delimiter, and load the table."}</li>
            <li>{pt ? "Use Atualizar Tudo sempre que quiser buscar a publicação oficial mais recente." : "Use Refresh All whenever you want the latest official release."}</li>
          </ol>
          <CopyButton value={csv.selicMonthly} label={pt ? "Copiar CSV da Selic mensal" : "Copy monthly Selic CSV"} successLabel={pt ? "URL copiada" : "URL copied"} activation="api_url_copy" />
        </section>
        <section id="series"><p className="atlas-kicker">03 / {pt ? "Séries prontas" : "Ready-made series"}</p>
          <h2>{pt ? "Escolha o dado e copie a URL." : "Choose the data and copy its URL."}</h2>
          <dl>
            <div><dt>IPCA · {pt ? "variação mensal" : "monthly change"}</dt><dd><code>{csv.ipcaMonthly}</code><CopyButton value={csv.ipcaMonthly} label={pt ? "Copiar URL" : "Copy URL"} successLabel={pt ? "Copiada" : "Copied"} activation="api_url_copy" /></dd></div>
            <div><dt>IPCA · {pt ? "acumulado em 12 meses" : "trailing 12 months"}</dt><dd><code>{csv.ipca12m}</code><CopyButton value={csv.ipca12m} label={pt ? "Copiar URL" : "Copy URL"} successLabel={pt ? "Copiada" : "Copied"} activation="api_url_copy" /></dd></div>
            <div><dt>Selic · {pt ? "acumulada no mês" : "accumulated in month"}</dt><dd><code>{csv.selicMonthly}</code><CopyButton value={csv.selicMonthly} label={pt ? "Copiar URL" : "Copy URL"} successLabel={pt ? "Copiada" : "Copied"} activation="api_url_copy" /></dd></div>
            <div><dt>Selic · {pt ? "meta do Copom" : "Copom target"}</dt><dd><code>{csv.selicTarget}</code><CopyButton value={csv.selicTarget} label={pt ? "Copiar URL" : "Copy URL"} successLabel={pt ? "Copiada" : "Copied"} activation="api_url_copy" /></dd></div>
            <div><dt>USD/BRL · {pt ? "dólar venda diário" : "daily selling rate"}</dt><dd><code>{csv.usdBrl}</code><CopyButton value={csv.usdBrl} label={pt ? "Copiar URL" : "Copy URL"} successLabel={pt ? "Copiada" : "Copied"} activation="api_url_copy" /></dd></div>
          </dl>
        </section>
        <section id="columns"><p className="atlas-kicker">04 / {pt ? "O que chega" : "What you receive"}</p>
          <h2>{pt ? "Valores que continuam verificáveis fora da API." : "Values that remain verifiable outside the API."}</h2>
          <p>{pt ? "Cada linha inclui date, period, value, raw_value, status, indicator_id, source_id, source_url e upstream_url. Assim, o dado não perde a referência oficial ao entrar na planilha." : "Every row includes date, period, value, raw_value, status, indicator_id, source_id, source_url, and upstream_url, so the official reference is preserved after the data enters your spreadsheet."}</p>
          <a className="atlas-button primary" href={csv.ipca12m} download data-activation="csv_download">{pt ? "Baixar CSV de IPCA agora" : "Download the IPCA CSV now"}<span>↓</span></a>
        </section>
      </article>
    </div>
    <SiteFooter locale={locale} />
  </main>;
}
