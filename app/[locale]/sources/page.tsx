import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { categoryLabels, indicators } from "@/lib/catalog/indicators";
import {
  anpDatasets,
  comexstatDatasets,
  cvmDatasets,
  epeDatasets,
  mteDatasets,
  siconfiDatasets,
  tesouroDpfDatasets,
  tesouroRtnDatasets,
  type OfficialDataset,
} from "@/lib/catalog/official-datasets";
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

const v2SourceGroups: Array<{
  id: string;
  name: string;
  shortName: string;
  description: { en: string; pt: string };
  attribution: { en: string; pt: string };
  catalogUrl: string;
  datasets: OfficialDataset[];
}> = [
  {
    id: "tesouro",
    name: "Tesouro Nacional",
    shortName: "Tesouro",
    description: { en: "Official national and subnational fiscal accounts, Government Central results, and Federal Public Debt statistics with each accounting structure preserved.", pt: "Contas fiscais nacionais e subnacionais, resultado do Governo Central e estatísticas da Dívida Pública Federal, preservando cada estrutura contábil." },
    attribution: { en: "Source: Tesouro Nacional. Preserve the report, account or table, period, unit, notes, and publication vintage.", pt: "Fonte: Tesouro Nacional. Preserve relatório, conta ou tabela, período, unidade, notas e versão da publicação." },
    catalogUrl: "https://www.tesourotransparente.gov.br/",
    datasets: [...siconfiDatasets, ...tesouroRtnDatasets, ...tesouroDpfDatasets],
  },
  {
    id: "mdic",
    name: "Ministério do Desenvolvimento, Indústria, Comércio e Serviços",
    shortName: "MDIC",
    description: { en: "Official foreign-trade data by flow, product, partner, state, transport, customs office, and international classification.", pt: "Dados oficiais de comércio exterior por fluxo, produto, parceiro, UF, transporte, unidade aduaneira e classificação internacional." },
    attribution: { en: "Source: MDIC — Comex Stat. Preserve flow, period, codes, dimensions, and metrics.", pt: "Fonte: MDIC — Comex Stat. Preserve fluxo, período, códigos, dimensões e métricas." },
    catalogUrl: "https://comexstat.mdic.gov.br/pt/home",
    datasets: comexstatDatasets,
  },
  {
    id: "anp",
    name: "Agência Nacional do Petróleo, Gás Natural e Biocombustíveis",
    shortName: "ANP",
    description: { en: "Official fuel and LPG price observations, exposed as auditable privacy-minimized aggregates.", pt: "Observações oficiais de preços de combustíveis e GLP, expostas como agregados auditáveis com minimização de dados." },
    attribution: { en: "Source: ANP. Preserve product, geography, sample size, unit, and disclosed aggregation.", pt: "Fonte: ANP. Preserve produto, geografia, tamanho da amostra, unidade e agregação declarada." },
    catalogUrl: anpDatasets[0].sourceUrl,
    datasets: anpDatasets,
  },
  {
    id: "epe",
    name: "Empresa de Pesquisa Energética",
    shortName: "EPE",
    description: { en: "Official monthly electricity consumption and consumer counts by state, class, and regulated or free market.", pt: "Consumo mensal oficial de eletricidade e número de consumidores por UF, classe e mercado cativo ou livre." },
    attribution: { en: "Source: EPE. Preserve period, state, class, market, measure, and workbook version.", pt: "Fonte: EPE. Preserve período, UF, classe, mercado, medida e versão da planilha." },
    catalogUrl: epeDatasets[0].sourceUrl,
    datasets: epeDatasets,
  },
  {
    id: "mte",
    name: "Ministério do Trabalho e Emprego",
    shortName: "MTE",
    description: { en: "Official adjusted Novo Caged employment stock and flows, with incompatible breakdown tables kept separate.", pt: "Estoque e fluxos ajustados oficiais do Novo Caged, mantendo separadas as tabelas com recortes incompatíveis." },
    attribution: { en: "Source: MTE — Novo Caged. Preserve stock-versus-flow meaning, breakdown, adjustment, period, and vintage.", pt: "Fonte: MTE — Novo Caged. Preserve sentido de estoque ou fluxo, recorte, ajuste, período e versão." },
    catalogUrl: mteDatasets[0].sourceUrl,
    datasets: mteDatasets,
  },
  {
    id: "cvm",
    name: "Comissão de Valores Mobiliários",
    shortName: "CVM",
    description: { en: "Official daily investment-fund reports by fund, class, and classification, with non-additive measures protected.", pt: "Informes diários oficiais de fundos por fundo, classe e classificação, protegendo medidas não aditivas." },
    attribution: { en: "Source: CVM. Preserve fund/class identity, date, measure, completeness state, and source version.", pt: "Fonte: CVM. Preserve identidade do fundo/classe, data, medida, completude e versão da fonte." },
    catalogUrl: cvmDatasets[0].sourceUrl,
    datasets: cvmDatasets,
  },
];

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
      {v2SourceGroups.map((source, index) => <article className="publisher-row" id={source.id} key={source.id}>
        <span className="publisher-index">{String(index + sources.length + 1).padStart(2, "0")}</span>
        <div className="publisher-identity">
          <p className="atlas-kicker">{source.shortName} · {pt ? "PUBLICADOR OFICIAL" : "OFFICIAL PUBLISHER"}</p>
          <h2>{source.name}</h2>
          <p>{pt ? source.description.pt : source.description.en}</p>
          <div className="publisher-metrics"><span><b>{source.datasets.length}</b>{pt ? "conjuntos" : "datasets"}</span><span><b>v2</b>REST</span><span><b>MCP</b>{pt ? "agentes" : "agents"}</span></div>
        </div>
        <div className="publisher-series">
          <span>{pt ? "Conjuntos conectados e estruturas preservadas" : "Connected datasets with preserved structures"}</span>
          {source.datasets.map((dataset) => <a href={`/api/v2/datasets/${encodeURIComponent(dataset.id)}/schema`} key={dataset.id}><b>{dataset.title}</b><code>{dataset.id}</code><small>{dataset.collection}</small></a>)}
        </div>
        <footer><span>{pt ? source.attribution.pt : source.attribution.en}</span><div><a href={source.catalogUrl} target="_blank" rel="noreferrer">{pt ? "Fonte oficial" : "Official source"} ↗</a></div></footer>
      </article>)}
    </section>
    <SiteFooter locale={locale} />
  </main>;
}
