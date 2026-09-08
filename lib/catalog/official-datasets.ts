import catalog from "@/lib/catalog/generated/official-datasets.generated.json";

export type OfficialDatasetProvider = "bcb-sgs" | "ibge-aggregates" | "siconfi" | "tesouro-rtn" | "tesouro-dpf" | "comexstat" | "anp" | "epe" | "mte" | "cvm";

export interface OfficialDataset {
  id: string;
  provider: OfficialDatasetProvider;
  sourceAgency: "BCB" | "IBGE" | "Tesouro Nacional" | "MDIC" | "ANP" | "EPE" | "MTE" | "CVM";
  upstreamId: string;
  title: string;
  collection: string | null;
  collectionName: string | null;
  sourceUrl: string;
  metadataUrl: string;
  queryCapability: "series" | "multidimensional" | "fiscal-report" | "fiscal-series" | "debt-statistics" | "registry" | "trade-cube" | "price-observations" | "energy-cube" | "labor-cube" | "fund-reports";
  temporalCoverage?: string;
  limitations?: string[];
}

type CompactCatalog = {
  schema_version: number;
  synced_at: string;
  provenance: { bcb: string; ibge: string };
  counts: { bcb_sgs: number; ibge_aggregates: number; total: number };
  ibge_surveys: Record<string, string>;
  bcb_sgs: [string, string, string][];
  ibge_aggregates: [string, string, string][];
};

const data = catalog as CompactCatalog;

export const bcbDatasetRows = data.bcb_sgs;
export const ibgeDatasetRows = data.ibge_aggregates;

export const siconfiDatasets: OfficialDataset[] = [
  { id: "siconfi:rreo", provider: "siconfi", sourceAgency: "Tesouro Nacional", upstreamId: "rreo", title: "Relatório Resumido da Execução Orçamentária (RREO)", collection: "SICONFI", collectionName: "Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro", sourceUrl: "https://siconfi.tesouro.gov.br/", metadataUrl: "https://apidatalake.tesouro.gov.br/docs/siconfi/", queryCapability: "fiscal-report" },
  { id: "siconfi:rgf", provider: "siconfi", sourceAgency: "Tesouro Nacional", upstreamId: "rgf", title: "Relatório de Gestão Fiscal (RGF), limites, pessoal e dívida", collection: "SICONFI", collectionName: "Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro", sourceUrl: "https://siconfi.tesouro.gov.br/", metadataUrl: "https://apidatalake.tesouro.gov.br/docs/siconfi/", queryCapability: "fiscal-report" },
  { id: "siconfi:dca", provider: "siconfi", sourceAgency: "Tesouro Nacional", upstreamId: "dca", title: "Declaração das Contas Anuais (DCA) de estados e municípios", collection: "SICONFI", collectionName: "Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro", sourceUrl: "https://siconfi.tesouro.gov.br/", metadataUrl: "https://apidatalake.tesouro.gov.br/docs/siconfi/", queryCapability: "fiscal-report" },
  { id: "siconfi:entes", provider: "siconfi", sourceAgency: "Tesouro Nacional", upstreamId: "entes", title: "Cadastro de entes da Federação", collection: "SICONFI", collectionName: "Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro", sourceUrl: "https://siconfi.tesouro.gov.br/", metadataUrl: "https://apidatalake.tesouro.gov.br/docs/siconfi/", queryCapability: "registry" },
];

export const tesouroRtnDatasets: OfficialDataset[] = [
  {
    id: "tesouro-rtn:government-central",
    provider: "tesouro-rtn",
    sourceAgency: "Tesouro Nacional",
    upstreamId: "government-central",
    title: "Resultado do Tesouro Nacional — receitas, despesas e resultado do Governo Central",
    collection: "RTN",
    collectionName: "Resultado do Tesouro Nacional — Série Histórica",
    sourceUrl: "https://www.tesourotransparente.gov.br/ckan/dataset/resultado-do-tesouro-nacional",
    metadataUrl: "https://www.tesourotransparente.gov.br/ckan/dataset/ab56485b-9c40-4efb-8563-9ce3e1973c4b/resource/aaf7f695-9370-46ae-9d7c-1d5cb28b1db4/download/metadados-serie-rtn.pdf",
    queryCapability: "fiscal-series",
    temporalCoverage: "Monthly current-value Government Central fiscal series from January 1997 through the latest synchronized RTN workbook.",
    limitations: ["This route exposes current nominal values from official table 1.2 in R$ millions. Constant-price, twelve-month, investment-function, and debt tables remain linked in the source workbook but are not combined into these observations.", "Above-the-line and below-the-line results are distinct official accounts and are never substituted for one another."],
  },
];

export const tesouroDpfDatasets: OfficialDataset[] = [
  {
    id: "tesouro-dpf:debt-profile",
    provider: "tesouro-dpf",
    sourceAgency: "Tesouro Nacional",
    upstreamId: "debt-profile",
    title: "Dívida Pública Federal — composição, detentores, prazo médio e custo",
    collection: "RMD",
    collectionName: "Relatório Mensal da Dívida Pública Federal",
    sourceUrl: "https://www.tesourotransparente.gov.br/publicacoes/relatorio-mensal-da-divida-rmd",
    metadataUrl: "https://www.tesourotransparente.gov.br/temas/divida-publica-federal/estatisticas-e-relatorios-da-divida-publica-federal",
    queryCapability: "debt-statistics",
    temporalCoverage: "Monthly RMD annex series from the earliest available selected table through the latest synchronized publication.",
    limitations: ["Composition, holder, average-maturity, and cost statistics are separate official RMD tables with different units and coverage; callers must choose one table.", "Holder categories apply to DPMFi securities and include the official methodological definitions and revisions. Negative monthly cost observations can be valid and are not treated as missing values."],
  },
];

export const comexstatDatasets: OfficialDataset[] = [
  { id: "comexstat:general", provider: "comexstat", sourceAgency: "MDIC", upstreamId: "general", title: "Comex Stat — exportações e importações brasileiras por produto, parceiro, UF e transporte", collection: "Comex Stat", collectionName: "Estatísticas oficiais do comércio exterior brasileiro de bens", sourceUrl: "https://comexstat.mdic.gov.br/pt/home", metadataUrl: "https://api-comexstat.mdic.gov.br/docs#/", queryCapability: "trade-cube" },
];

export const anpDatasets: OfficialDataset[] = [
  {
    id: "anp:fuel-prices",
    provider: "anp",
    sourceAgency: "ANP",
    upstreamId: "fuel-prices",
    title: "Preços de combustíveis e GLP por produto e geografia",
    collection: "Levantamento de Preços de Combustíveis",
    collectionName: "Pesquisa semanal de preços em postos revendedores",
    sourceUrl: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/serie-historica-de-precos-de-combustiveis",
    metadataUrl: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/metadados-serie-historica-precos-combustiveis-1.pdf",
    queryCapability: "price-observations",
    temporalCoverage: "Latest four weeks, plus monthly station observations from 2023 onward through published complete months.",
    limitations: ["Open Economics returns auditable aggregates calculated from ANP station observations; it does not expose station names, addresses, or CNPJ.", "The 2004–2022 semester archives remain linked in source metadata but are not yet queryable through this route."],
  },
];

export const epeDatasets: OfficialDataset[] = [
  {
    id: "epe:electricity-consumption",
    provider: "epe",
    sourceAgency: "EPE",
    upstreamId: "electricity-consumption",
    title: "Consumo mensal de energia elétrica por UF, classe e mercado",
    collection: "Consumo Mensal de Energia Elétrica",
    collectionName: "Dados abertos do consumo mensal de energia elétrica",
    sourceUrl: "https://www.epe.gov.br/pt/publicacoes-dados-abertos/dados-abertos/dados-do-consumo-mensal-de-energia-eletrica",
    metadataUrl: "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/dados-abertos/Documents/Consumo-Mensal-Dicionario-de-Dados.pdf",
    queryCapability: "energy-cube",
    temporalCoverage: "Monthly from January 2004 through the latest synchronized official EPE workbook.",
  },
];

export const mteDatasets: OfficialDataset[] = [
  {
    id: "mte:formal-employment",
    provider: "mte",
    sourceAgency: "MTE",
    upstreamId: "formal-employment",
    title: "Novo Caged — estoque, admissões, desligamentos e saldo do emprego formal",
    collection: "Novo Caged",
    collectionName: "Estatísticas Mensais do Emprego Formal",
    sourceUrl: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/novo-caged",
    metadataUrl: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/o-pdet/o-que-e-o-novo-caged",
    queryCapability: "labor-cube",
    temporalCoverage: "Adjusted monthly series from January 2020 through the latest synchronized official Novo Caged workbook.",
    limitations: ["Country, region/state, and economic-activity breakdowns are separate official tables and cannot be combined into a synthetic state-by-industry result.", "Municipality, occupation, and worker-characteristic microdata remain available from MTE but are not included in this aggregate route."],
  },
];

export const cvmDatasets: OfficialDataset[] = [
  {
    id: "cvm:investment-funds",
    provider: "cvm",
    sourceAgency: "CVM",
    upstreamId: "investment-funds",
    title: "Fundos de investimento — patrimônio, cotas, captações, resgates e cotistas",
    collection: "Informe Diário de Fundos de Investimento",
    collectionName: "Documentos Periódicos e Eventuais de Regulados",
    sourceUrl: "https://dados.cvm.gov.br/dataset/fi-doc-inf_diario",
    metadataUrl: "https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/META/meta_inf_diario_fi.txt",
    queryCapability: "fund-reports",
    temporalCoverage: "Daily classification aggregates for the latest rolling CVM package window, plus each fund/class's latest report in that window.",
    limitations: ["Fund-level observations are a latest-state index, not a complete fund-level time series. Classification aggregates retain the official daily frequency for the synchronized rolling window.", "Reported holder counts are summed accounts across funds/classes, not deduplicated people. Quota values are never aggregated across funds."],
  },
];

export const officialCatalogSummary = {
  schemaVersion: data.schema_version,
  syncedAt: data.synced_at,
  counts: { ...data.counts, siconfi: siconfiDatasets.length, tesouro_rtn: tesouroRtnDatasets.length, tesouro_dpf: tesouroDpfDatasets.length, comexstat: comexstatDatasets.length, anp: anpDatasets.length, epe: epeDatasets.length, mte: mteDatasets.length, cvm: cvmDatasets.length, total: data.counts.total + siconfiDatasets.length + tesouroRtnDatasets.length + tesouroDpfDatasets.length + comexstatDatasets.length + anpDatasets.length + epeDatasets.length + mteDatasets.length + cvmDatasets.length },
  provenance: { ...data.provenance, siconfi: "https://apidatalake.tesouro.gov.br/docs/siconfi/", tesouro_rtn: "https://www.tesourotransparente.gov.br/ckan/dataset/resultado-do-tesouro-nacional", tesouro_dpf: "https://www.tesourotransparente.gov.br/publicacoes/relatorio-mensal-da-divida-rmd", comexstat: "https://api-comexstat.mdic.gov.br/docs#/", anp: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/serie-historica-de-precos-de-combustiveis", epe: "https://www.epe.gov.br/pt/publicacoes-dados-abertos/dados-abertos/dados-do-consumo-mensal-de-energia-eletrica", mte: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/novo-caged", cvm: "https://dados.cvm.gov.br/dataset/fi-doc-inf_diario" },
};

export function parseOfficialDatasetId(rawId: string) {
  const match = /^(bcb-sgs|ibge-aggregates):(\d+)$|^(siconfi):(rreo|rgf|dca|entes)$|^(tesouro-rtn):(government-central)$|^(tesouro-dpf):(debt-profile)$|^(comexstat):(general)$|^(anp):(fuel-prices)$|^(epe):(electricity-consumption)$|^(mte):(formal-employment)$|^(cvm):(investment-funds)$/.exec(rawId);
  if (!match) return null;
  return { provider: (match[1] ?? match[3] ?? match[5] ?? match[7] ?? match[9] ?? match[11] ?? match[13] ?? match[15] ?? match[17]) as OfficialDatasetProvider, upstreamId: match[2] ?? match[4] ?? match[6] ?? match[8] ?? match[10] ?? match[12] ?? match[14] ?? match[16] ?? match[18] };
}

export function getOfficialDataset(rawId: string): OfficialDataset | null {
  const parsed = parseOfficialDatasetId(rawId);
  if (!parsed) return null;

  if (parsed.provider === "bcb-sgs") {
    const row = data.bcb_sgs.find(([code]) => code === parsed.upstreamId);
    if (!row) return null;
    const [code, title, slug] = row;
    return {
      id: `bcb-sgs:${code}`,
      provider: "bcb-sgs",
      sourceAgency: "BCB",
      upstreamId: code,
      title,
      collection: "SGS",
      collectionName: "Sistema Gerenciador de Séries Temporais",
      sourceUrl: `https://dadosabertos.bcb.gov.br/dataset/${slug}`,
      metadataUrl: `https://www3.bcb.gov.br/sgspub/consultarmetadados/consultarMetadadosSeries.do?method=consultarMetadadosSeriesInternet&hdOidSerieSelecionada=${code}`,
      queryCapability: "series",
    };
  }

  if (parsed.provider === "siconfi") {
    return siconfiDatasets.find((dataset) => dataset.upstreamId === parsed.upstreamId) ?? null;
  }

  if (parsed.provider === "tesouro-rtn") {
    return tesouroRtnDatasets.find((dataset) => dataset.upstreamId === parsed.upstreamId) ?? null;
  }

  if (parsed.provider === "tesouro-dpf") {
    return tesouroDpfDatasets.find((dataset) => dataset.upstreamId === parsed.upstreamId) ?? null;
  }

  if (parsed.provider === "comexstat") {
    return comexstatDatasets.find((dataset) => dataset.upstreamId === parsed.upstreamId) ?? null;
  }

  if (parsed.provider === "anp") {
    return anpDatasets.find((dataset) => dataset.upstreamId === parsed.upstreamId) ?? null;
  }

  if (parsed.provider === "epe") {
    return epeDatasets.find((dataset) => dataset.upstreamId === parsed.upstreamId) ?? null;
  }

  if (parsed.provider === "mte") {
    return mteDatasets.find((dataset) => dataset.upstreamId === parsed.upstreamId) ?? null;
  }

  if (parsed.provider === "cvm") {
    return cvmDatasets.find((dataset) => dataset.upstreamId === parsed.upstreamId) ?? null;
  }

  const row = data.ibge_aggregates.find(([aggregate]) => aggregate === parsed.upstreamId);
  if (!row) return null;
  const [aggregate, title, survey] = row;
  return {
    id: `ibge-aggregates:${aggregate}`,
    provider: "ibge-aggregates",
    sourceAgency: "IBGE",
    upstreamId: aggregate,
    title,
    collection: survey,
    collectionName: data.ibge_surveys[survey] ?? null,
    sourceUrl: `https://sidra.ibge.gov.br/tabela/${aggregate}`,
    metadataUrl: `https://servicodados.ibge.gov.br/api/v3/agregados/${aggregate}/metadados`,
    queryCapability: "multidimensional",
  };
}
