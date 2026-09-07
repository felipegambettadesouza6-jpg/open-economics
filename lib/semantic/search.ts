import conceptData from "@/lib/semantic/generated/economic-concepts.generated.json";
import { indicators } from "@/lib/catalog/indicators";
import {
  anpDatasets,
  bcbDatasetRows,
  comexstatDatasets,
  cvmDatasets,
  epeDatasets,
  getOfficialDataset,
  ibgeDatasetRows,
  mteDatasets,
  siconfiDatasets,
  tesouroDpfDatasets,
  tesouroRtnDatasets,
} from "@/lib/catalog/official-datasets";
import { jaccard, normalizeText, tokenMatches, tokenize, trigrams } from "@/lib/semantic/normalize";
import type { ConceptMatch, DatasetMatch, EconomicConcept, SemanticSearchResult } from "@/lib/semantic/types";

const concepts = (conceptData as { concepts: EconomicConcept[] }).concepts;
// BCB SGS and IBGE aggregate catalogs are generic provider integrations. Other
// publishers are integrated only for the explicit concepts mapped below; an
// agency-level flag must never imply coverage of every dataset it publishes.
const GENERICALLY_INTEGRATED_SOURCES = new Set(["BCB", "IBGE"]);

// Preferred datasets are an auditable last-mile routing layer between an
// economic concept and publisher catalog identifiers. They complement (and do
// not replace) open-ended catalog search. Prefer current, broad official tables;
// older stable v1 series remain available as compatibility shortcuts.
const PREFERRED_DATASETS: Record<string, string[]> = {
  "ipca-headline": ["ibge-aggregates:7060", "ibge-aggregates:1737"],
  "ipca-components": ["ibge-aggregates:7060"],
  "ipca-regional": ["ibge-aggregates:7060"],
  inpc: ["ibge-aggregates:7063", "ibge-aggregates:1736"],
  ipca15: ["ibge-aggregates:7062", "ibge-aggregates:3065"],
  "selic-target": ["bcb-sgs:432"],
  "selic-effective": ["bcb-sgs:1178", "bcb-sgs:11"],
  "exchange-rates": ["bcb-sgs:1"],
  "ibc-br": ["bcb-sgs:24363", "bcb-sgs:24364"],
  "gdp-growth": ["ibge-aggregates:5932"],
  "gdp-level": ["ibge-aggregates:1846", "ibge-aggregates:1620", "bcb-sgs:1207"],
  "gdp-expenditure": ["ibge-aggregates:1846", "ibge-aggregates:1620"],
  "gdp-industry": ["ibge-aggregates:1846", "ibge-aggregates:5932"],
  "state-gdp": ["ibge-aggregates:5938"],
  "municipal-gdp": ["ibge-aggregates:5938"],
  "industrial-production": ["ibge-aggregates:8888", "ibge-aggregates:8887", "ibge-aggregates:8885"],
  "retail-sales": ["ibge-aggregates:8880"],
  "services-volume": ["ibge-aggregates:5906"],
  unemployment: ["ibge-aggregates:6381", "ibge-aggregates:6468"],
  "employment-level": ["ibge-aggregates:6379"],
  underutilization: ["ibge-aggregates:6441", "ibge-aggregates:6438"],
  "real-earnings": ["ibge-aggregates:6390"],
  "earnings-mass": ["ibge-aggregates:6392", "ibge-aggregates:6393"],
  informality: ["ibge-aggregates:8513", "ibge-aggregates:10361"],
  population: ["ibge-aggregates:6579"],
  "housing-stock": ["ibge-aggregates:9866"],
  "inflation-diffusion": ["bcb-sgs:21379"],
  "credit-to-gdp": ["bcb-sgs:20622"],
  "credit-interest": ["bcb-sgs:20714"],
  "credit-delinquency": ["bcb-sgs:21082", "bcb-sgs:21084", "bcb-sgs:21083"],
  "household-debt-service": ["bcb-sgs:29034", "bcb-sgs:29265", "bcb-sgs:29037", "bcb-sgs:29038"],
  "credit-concessions": ["bcb-sgs:20633", "bcb-sgs:24441"],
  "credit-spreads": ["bcb-sgs:20785"],
  "monetary-aggregates": ["bcb-sgs:27791", "bcb-sgs:27841"],
  "rural-credit": ["bcb-sgs:28172", "bcb-sgs:20689", "bcb-sgs:20701"],
  "net-public-debt": ["bcb-sgs:4513"],
  "gross-public-debt": ["bcb-sgs:13762"],
  "public-primary-balance": ["bcb-sgs:5793", "bcb-sgs:5727"],
  "current-account": ["bcb-sgs:22701"],
  "trade-balance": ["bcb-sgs:22707", "comexstat:general"],
  exports: ["comexstat:general"],
  imports: ["comexstat:general"],
  "foreign-direct-investment": ["bcb-sgs:22885"],
  "international-reserves": ["bcb-sgs:13982"],
  "external-debt": ["bcb-sgs:28192", "bcb-sgs:28193", "bcb-sgs:28194"],
  "subnational-revenue": ["siconfi:dca", "siconfi:rreo"],
  "subnational-expenditure": ["siconfi:dca", "siconfi:rreo"],
  "subnational-debt": ["siconfi:rgf", "siconfi:dca"],
  "personnel-spending": ["siconfi:rgf"],
  "health-education-spending": ["siconfi:rreo"],
  "intergovernmental-transfers": ["siconfi:dca", "siconfi:rreo"],
  "central-government-balance": ["tesouro-rtn:government-central"],
  "federal-revenue": ["tesouro-rtn:government-central"],
  "federal-expenditure": ["tesouro-rtn:government-central"],
  "social-security-balance": ["tesouro-rtn:government-central"],
  "federal-debt-profile": ["tesouro-dpf:debt-profile"],
  "fuel-prices": ["anp:fuel-prices"],
  "electricity-consumption": ["epe:electricity-consumption"],
  "formal-job-flow": ["mte:formal-employment"],
  "formal-job-stock": ["mte:formal-employment"],
  "investment-funds": ["cvm:investment-funds"],
};

function conceptHasIntegratedSource(concept: EconomicConcept) {
  return concept.sources.some((source) => GENERICALLY_INTEGRATED_SOURCES.has(source))
    || (PREFERRED_DATASETS[concept.id] ?? []).some((id) => Boolean(getOfficialDataset(id)));
}

// These are language-level economic synonyms, not benchmark prompts. They make
// the router resilient to the vocabulary gap between people and publishers.
const SYNONYMS: Record<string, string[]> = {
  "ipca-headline": ["inflacao", "inflation", "custo de vida", "consumer inflation", "precos ao consumidor", "ipca cheio"],
  "ipca-components": ["grupo do ipca", "item do ipca", "partes da cesta", "cesta de consumo", "grupo de produtos", "item e subitem", "product group", "product item", "subitem", "inflation drivers", "decomposicao da inflacao", "por que a inflacao subiu", "fontes da alta de precos", "what drove inflation"],
  "ipca-regional": ["inflacao por cidade", "inflacao nas capitais", "capitais pesquisadas", "inflation by region", "regional consumer prices"],
  ipca15: ["ipca 15", "previa da inflacao", "mid month inflation", "inflation preview"],
  "administered-prices": ["tarifas reguladas", "precos controlados", "precos regulados", "formados pelo mercado", "government controlled prices", "regulated prices", "precos livres"],
  "inflation-diffusion": ["itens subindo", "parcela dos itens", "itens ficaram mais caros", "inflacao disseminada", "breadth of inflation", "share of prices rising"],
  "producer-prices": ["precos na fabrica", "ipp", "factory gate prices", "industrial prices"],
  "construction-costs": ["sinapi", "custo de construir", "material e mao de obra", "building costs"],
  unemployment: ["desemprego", "desocupacao", "procura trabalho nao encontra", "procurando trabalho sem encontrar", "sem trabalho", "looking for work cannot find", "jobless", "unemployed"],
  "employment-level": ["ocupados", "pessoas ocupadas", "pessoas trabalhando", "quantas pessoas trabalham", "emprego total", "people working", "employed workers"],
  "formal-job-flow": ["carteiras assinadas abertas encerradas", "saldo de vagas", "saldo de empregos formais", "saldo do emprego formal", "caged", "empregos com carteira", "vagas formais", "formal jobs created", "formal job creation", "admissoes demissoes"],
  "formal-job-stock": ["vinculos com carteira", "quantos empregos formais", "rais", "estoque de emprego", "empregos formais", "formal employment stock"],
  "selic-target": ["selic", "copom", "juros basicos", "policy rate", "basic interest rate"],
  "selic-effective": ["selic efetiva", "overnight rate", "taxa overnight"],
  cdi: ["cdi", "rendimento interbancario", "referencia dos investimentos", "deposito interfinanceiro", "interbank return", "interbank deposit rate"],
  "yield-curve": ["curva de juros", "juros futuros", "taxa por vencimento", "term structure", "forward rates"],
  "inflation-target": ["meta de inflacao", "objetivo de alta de precos", "banda permitida", "banda da meta", "tolerance band", "inflation goal"],
  "focus-expectations": ["focus", "mercado esta esperando", "expectativas do mercado", "previsoes do mercado", "market forecasts", "median expectations"],
  "monetary-aggregates": ["m1", "m2", "m3", "m4", "meios de pagamento", "money in circulation", "money supply"],
  "exchange-rates": ["cambio", "dolar", "euro", "usd brl", "real exchange rate", "ptax"],
  "gdp-growth": ["pib", "crescimento economico", "economia expandindo", "economia cresceu", "removing inflation", "economic expansion", "economic growth"],
  "gdp-level": ["tamanho da economia", "precos correntes e constantes", "valor do pib", "size of the economy", "current and constant prices", "nominal gdp", "real gdp"],
  "gdp-expenditure": ["consumo governo investimento comercio exterior", "consumo das familias governo investimento", "household consumption government investment foreign trade", "break economic output", "consumo investimento exportacoes", "otica da demanda", "componentes da demanda", "gdp demand components", "contribution to gdp growth", "consumption versus investment contribution", "contribuicao para o crescimento do pib"],
  "gdp-industry": ["pib por setor", "agro industria servicos", "value added by industry", "productive sectors", "sectors of economic output", "sector contribution to growth"],
  "state-gdp": ["pib dos estados", "economia de cada estado", "tamanho e crescimento de cada estado", "economia estadual", "crescimento real do pib por estado", "pib per capita estadual", "ranking dos estados por pib", "each state economy", "state economies", "regional gdp", "state real gdp growth", "state gdp per capita"],
  "municipal-gdp": ["pib das cidades", "pib municipal", "city economies", "local gdp", "economic output by municipality", "municipal output per resident", "economy of each municipality"],
  "ibc-br": ["ibc br", "previa do pib", "termometro da economia", "monthly gdp proxy", "activity tracker"],
  "industrial-production": ["fabricas produzindo", "quanto as fabricas produzem", "producao das fabricas", "producao da industria", "factories producing", "factory output", "pim pf", "industrial output"],
  "retail-sales": ["varejo", "lojas vendendo", "vendas de bens em volume", "shops selling goods", "goods in volume terms", "vendas do comercio", "retail trade"],
  "services-volume": ["setor de servicos", "pms", "service activity"],
  "labor-force-participation": ["idade de trabalhar", "mercado de trabalho", "taxa de participacao", "forca de trabalho", "working or looking for work", "labor participation"],
  underutilization: ["desempregados subocupados", "deixou de procurar", "forca de trabalho potencial", "subutilizacao", "subocupacao", "horas insuficientes", "underemployment", "unused labor"],
  informality: ["sem vinculo formal", "sem protecao", "informalidade", "sem carteira", "trabalho informal", "informal workers"],
  "real-earnings": ["salario real", "renda do trabalho", "poder de compra do salario", "real wages"],
  "earnings-mass": ["total de renda do trabalho", "todas pessoas ocupadas", "massa salarial", "massa de rendimento", "total labor income", "aggregate wages"],
  "wage-gaps": ["homens e mulheres", "brancos e negros", "diferenca salarial", "hiato salarial", "pay gap", "earnings by race", "earnings by sex"],
  "credit-stock": ["devem aos bancos", "divida com bancos", "carteira de credito", "saldo de emprestimos", "outstanding loans", "loan book"],
  "credit-to-gdp": ["emprestimos em relacao a economia", "credito pib", "financial depth", "loans relative to gdp"],
  "credit-concessions": ["novos emprestimos", "credito novo", "new lending", "loan originations"],
  "credit-delinquency": ["emprestimos atrasados", "mais de tres meses", "inadimplencia", "atraso acima de 90 dias", "inadimplencia por modalidade de credito", "default rate", "nonperforming loans", "delinquency by credit modality"],
  "credit-interest": ["pagar para tomar emprestimos", "juros por modalidade", "juros bancarios", "custo do credito", "modalidades de credito com juros mais altos", "lending rates", "loan rates", "rates by credit modality", "highest credit rates"],
  "credit-spreads": ["custo de captacao", "juro cobrado do cliente", "spread bancario", "margem dos bancos", "bank margin", "lending spread"],
  "household-debt-service": ["endividamento das familias", "comprometimento de renda", "debt burden"],
  "housing-credit": ["compra de imoveis", "quanto foi financiado", "financiamento imobiliario", "credito habitacional", "mortgage lending", "home loans"],
  "gross-public-debt": ["divida bruta", "dbgg", "government gross debt"],
  "net-public-debt": ["divida liquida", "dlsp", "public net debt"],
  "public-primary-balance": ["receitas menos despesas antes dos juros", "azul ou vermelho", "resultado primario", "superavit primario", "deficit primario"],
  "central-government-balance": ["resultado do governo central", "tesouro previdencia banco central", "central government deficit"],
  "federal-revenue": ["arrecadacao federal", "receita tributaria", "impostos federais", "federal tax", "federal tax revenue", "tax and social security revenue", "federal tax receipts"],
  "federal-expenditure": ["gasto federal", "despesa da uniao", "orcamento executado", "federal spending"],
  "federal-debt-profile": ["divida publica federal", "titulos da uniao", "indexadores prazos detentores", "prazo da divida", "custo da divida", "government bond composition", "debt maturity", "debt holders"],
  "social-security-balance": ["resultado da previdencia", "inss", "beneficios previdenciarios", "social security deficit"],
  "subnational-revenue": ["quanto cada prefeitura recebeu", "fontes de receita", "receita dos municipios", "receita dos estados", "financas locais", "municipal revenue", "state revenue"],
  "subnational-expenditure": ["gasto municipal", "gasto estadual", "despesa de prefeitura", "local government spending"],
  "subnational-debt": ["divida de estados", "divida municipal", "local government debt"],
  "personnel-spending": ["gasto com pessoal", "limite de pessoal", "folha do governo", "government payroll limit"],
  "health-education-spending": ["pisos constitucionais", "saude e ensino", "minimo constitucional", "gasto minimo saude", "gasto minimo educacao", "health education floor"],
  "intergovernmental-transfers": ["fpm", "fpe", "repasses federais", "transferencias para municipios", "federal transfers"],
  "current-account": ["recebeu do exterior mais do que pagou", "comercio servicos rendas", "transacoes correntes", "conta corrente externa", "current account"],
  "foreign-direct-investment": ["investimento direto", "idp", "fdi"],
  "international-reserves": ["reservas cambiais", "reservas externas", "foreign reserves"],
  "portfolio-flows": ["capital estrangeiro em acoes", "fluxo para renda fixa", "portfolio investment", "foreign securities flows"],
  "external-debt": ["divida externa", "devedores publicos e privados no exterior", "por vencimento", "public and private borrowers owe abroad", "foreign currency debt", "debt owed abroad"],
  "trade-balance": ["exported more than imported", "balanca comercial", "exportacoes menos importacoes", "trade surplus", "trade deficit"],
  exports: ["sell to trading partner", "products sold abroad", "exportacoes", "vendas ao exterior", "shipments abroad", "foreign sales"],
  imports: ["buy from origin country", "goods bought abroad", "importacoes", "compras do exterior", "foreign purchases"],
  "terms-of-trade": ["more imports for same exports", "termos de troca", "preco exportacao importacao", "export purchasing power"],
  "investment-funds": ["fundos de investimento", "patrimonio dos fundos", "cotistas", "fund assets"],
  "listed-company-financials": ["contas trimestrais padronizadas", "empresas negociadas em bolsa", "balanco de empresas abertas", "companhias listadas", "companhias abertas", "divida liquida e ebitda", "comparar empresas do mesmo setor", "dre", "company filings", "listed companies", "net debt and ebitda"],
  "public-offerings": ["oferta de acoes", "ipo", "emissao de debentures", "securities offering"],
  "financial-institutions": ["cadastro de bancos", "balanco dos bancos", "financial institution registry", "bank balance sheets"],
  "pix-statistics": ["pix", "pagamento instantaneo", "transferencias instantaneas", "por quem transferiu", "instant transfers", "instant payments", "pix transactions"],
  "capital-market-investors": ["investidores na bolsa", "pessoa fisica na bolsa", "stock market investors"],
  population: ["people live in every municipality", "by age and sex", "habitantes", "populacao estimada", "censo", "population count"],
  "population-projections": ["children working age elderly future", "future decades", "projecao demografica", "envelhecimento futuro", "future population", "dependency ratio"],
  "household-income": ["renda domiciliar", "renda per capita", "household income", "income per person in a household", "average household resources per person", "household income per capita"],
  "income-inequality": ["gini", "desigualdade", "income concentration"],
  poverty: ["low income thresholds", "share below income line", "pobreza", "extrema pobreza", "abaixo da linha de pobreza", "poor households"],
  "household-consumption": ["orcamento familiar", "gastos das familias", "cesta de consumo", "household budget"],
  "consumer-durable-ownership": ["bens nos domicilios", "acesso a internet geladeira carro", "household amenities", "durable goods ownership"],
  "fuel-prices": ["preco gasolina", "preco diesel", "etanol", "gasoline price", "diesel price"],
  "oil-gas-production": ["barrels cubic metres field basin", "petroleo", "gas natural", "pre sal", "oil output"],
  "electricity-generation": ["geracao eletrica", "energia gerada", "hydro thermal generation", "power output"],
  "electricity-consumption": ["consumo de energia", "demanda eletrica", "consumo residencial industrial comercial", "energia por classe de consumo e estado", "electricity use", "power demand", "electricity used by homes industry commerce", "electricity consumption by state and sector"],
  "energy-balance": ["matriz energetica", "oferta de energia", "energy mix", "energy supply and use"],
  "crop-harvest": ["safra", "colheita", "crop forecast", "harvest forecast"],
  "agricultural-production": ["municipio colheu cada cultura", "produtividade da cultura", "producao agricola", "lavouras", "quanto foi colhido", "crop output"],
  "livestock-production": ["rebanho", "gado", "leite ovos", "livestock herd", "animal production"],
  "food-supply-stocks": ["estoque de graos", "armazenagem", "food stocks", "crop inventories"],
  "rural-credit": ["credito rural", "financiamento agricola", "farm credit"],
  "construction-activity": ["producao da construcao", "obras", "building activity", "construction output"],
  "housing-stock": ["domicilios vazios", "domicilios existem", "condicoes de ocupacao", "numero de domicilios", "moradias ocupadas", "vacant homes", "occupancy conditions", "dwelling stock"],
  "housing-rent": ["aluguel residencial", "preco do aluguel", "rent inflation", "housing rent"],
  deforestation: ["desmatamento", "floresta derrubada", "area de floresta por bioma", "monitoramento oficial da floresta", "prodes", "deter", "forest clearing", "forest area cleared by biome"],
  "greenhouse-emissions": ["emissoes de carbono", "gases de efeito estufa", "co2 emissions", "emissions inventory"],
};

const conceptIndex = concepts.map((concept) => {
  const aliases = SYNONYMS[concept.id] ?? [];
  const text = [concept.id, concept.en, concept.pt, concept.domain, ...aliases].join(" ");
  return { concept, aliases, normalized: normalizeText(text), tokens: tokenize(text), grams: trigrams(text) };
});
const semanticVocabulary = [...new Set(conceptIndex.flatMap((entry) => entry.tokens))];
const conceptTokenFrequency = new Map(semanticVocabulary.map((token) => [token, conceptIndex.filter((entry) => entry.tokens.includes(token)).length]));

function exactAliasBoost(normalizedQuery: string, aliases: string[]) {
  let boost = 0;
  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias || !normalizedQuery.includes(normalizedAlias)) continue;
    const aliasTokens = tokenize(alias);
    if (aliasTokens.length >= 3) boost = Math.max(boost, 0.34);
    else if (aliasTokens.length === 2) boost = Math.max(boost, 0.25);
    else if (aliasTokens.length === 1) {
      const frequency = conceptTokenFrequency.get(aliasTokens[0]) ?? 1;
      boost = Math.max(boost, 0.26 / Math.sqrt(frequency));
    }
  }
  return boost;
}

function exactLabelBoost(normalizedQuery: string, queryTokenCount: number, values: string[]) {
  let boost = 0;
  for (const value of values) {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue || !normalizedQuery.includes(normalizedValue)) continue;
    const coverage = Math.min(1, (tokenize(value).length / Math.max(queryTokenCount, 1)) * 1.5);
    boost = Math.max(boost, 0.42 * coverage);
  }
  return boost;
}

function scoreTokenOverlap(queryTokens: string[], candidateTokens: string[]) {
  if (!queryTokens.length || !candidateTokens.length) return { score: 0, matched: [] as string[] };
  const matched = queryTokens.filter((queryToken) => candidateTokens.some((candidate) => tokenMatches(queryToken, candidate)));
  const recall = matched.length / queryTokens.length;
  const precision = matched.length / Math.min(candidateTokens.length, Math.max(queryTokens.length * 3, 1));
  return { score: recall * 0.76 + Math.min(precision, 1) * 0.24, matched };
}

function routeConcepts(query: string): ConceptMatch[] {
  const normalized = normalizeText(query);
  const allQueryTokens = tokenize(query);
  const recognizedTokens = allQueryTokens.filter((queryToken) => semanticVocabulary.some((term) => tokenMatches(queryToken, term)));
  const queryTokens = recognizedTokens.length ? recognizedTokens : allQueryTokens;
  const queryGrams = trigrams(query);
  const scored = conceptIndex.map(({ concept, aliases, tokens, grams }) => {
    const overlap = scoreTokenOverlap(queryTokens, tokens);
    const aliasBoost = exactAliasBoost(normalized, aliases);
    const labelBoost = exactLabelBoost(normalized, queryTokens.length, [concept.en, concept.pt, concept.id]);
    const fuzzy = jaccard(queryGrams, grams);
    const score = Math.min(1, overlap.score * 0.75 + fuzzy * 0.12 + aliasBoost + labelBoost);
    return { ...concept, score, confidence: score, matchedTerms: overlap.matched };
  }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  const top = scored[0]?.score ?? 0;
  const second = scored[1]?.score ?? 0;
  const margin = Math.max(0, top - second);
  return scored.slice(0, 5).map((match, index) => ({
    ...match,
    confidence: Number(Math.max(0, Math.min(0.99, match.score * 0.84 + (index === 0 ? margin * 0.6 : 0))).toFixed(3)),
    score: Number(match.score.toFixed(3)),
  }));
}

type RawCandidate = { provider: "bcb-sgs" | "ibge-aggregates" | "siconfi" | "tesouro-rtn" | "tesouro-dpf" | "comexstat" | "anp" | "epe" | "mte" | "cvm"; upstreamId: string; title: string; survey?: string; normalizedTitle: string; titleTokens: string[]; stableIndicatorIds: string[] };

const stableIndicatorLookup = new Map<string, string[]>();
for (const indicator of indicators) {
  const upstreamId = String(indicator.upstream.seriesCode ?? indicator.upstream.aggregate);
  const key = `${indicator.provider}:${upstreamId}`;
  stableIndicatorLookup.set(key, [...(stableIndicatorLookup.get(key) ?? []), indicator.id]);
}

function indexedCandidate(provider: RawCandidate["provider"], upstreamId: string, title: string, survey?: string): RawCandidate {
  return {
    provider,
    upstreamId,
    title,
    survey,
    normalizedTitle: normalizeText(title),
    titleTokens: tokenize(title),
    stableIndicatorIds: stableIndicatorLookup.get(`${provider}:${upstreamId}`) ?? [],
  };
}

const bcbSearchIndex = bcbDatasetRows.map(([code, title]) => indexedCandidate("bcb-sgs", code, title));
const ibgeSearchIndex = ibgeDatasetRows.map(([aggregate, title, survey]) => indexedCandidate("ibge-aggregates", aggregate, title, survey));
const siconfiSearchIndex = siconfiDatasets.map((dataset) => indexedCandidate("siconfi", dataset.upstreamId, dataset.title, dataset.collectionName ?? undefined));
const tesouroRtnSearchIndex = tesouroRtnDatasets.map((dataset) => indexedCandidate("tesouro-rtn", dataset.upstreamId, dataset.title, dataset.collectionName ?? undefined));
const tesouroDpfSearchIndex = tesouroDpfDatasets.map((dataset) => indexedCandidate("tesouro-dpf", dataset.upstreamId, dataset.title, dataset.collectionName ?? undefined));
const comexstatSearchIndex = comexstatDatasets.map((dataset) => indexedCandidate("comexstat", dataset.upstreamId, dataset.title, dataset.collectionName ?? undefined));
const anpSearchIndex = anpDatasets.map((dataset) => indexedCandidate("anp", dataset.upstreamId, dataset.title, dataset.collectionName ?? undefined));
const epeSearchIndex = epeDatasets.map((dataset) => indexedCandidate("epe", dataset.upstreamId, dataset.title, dataset.collectionName ?? undefined));
const mteSearchIndex = mteDatasets.map((dataset) => indexedCandidate("mte", dataset.upstreamId, dataset.title, dataset.collectionName ?? undefined));
const cvmSearchIndex = cvmDatasets.map((dataset) => indexedCandidate("cvm", dataset.upstreamId, dataset.title, dataset.collectionName ?? undefined));

function searchDatasets(query: string, conceptMatches: ConceptMatch[], limit: number): DatasetMatch[] {
  const resolvedConcepts = conceptMatches.filter((match) => match.confidence >= 0.34);
  const allowedSources = new Set(resolvedConcepts.filter(conceptHasIntegratedSource).flatMap((match) => match.sources));
  if (resolvedConcepts.length && !allowedSources.size) return [];

  const expansionText = resolvedConcepts.slice(0, 2).flatMap((concept) => [concept.en, concept.pt, ...(SYNONYMS[concept.id] ?? [])]).join(" ");
  const queryTokens = tokenize(query);
  const expansionTokens = tokenize(expansionText).filter((token) => !queryTokens.some((queryToken) => tokenMatches(queryToken, token)));
  const normalizedQuery = normalizeText(query);
  const preferredOrder = new Map(
    resolvedConcepts
      .flatMap((concept) => PREFERRED_DATASETS[concept.id] ?? [])
      .map((id, index) => [id, index] as const),
  );
  const rawCandidates: RawCandidate[] = [
    ...(!allowedSources.size || allowedSources.has("BCB") ? bcbSearchIndex : []),
    ...(!allowedSources.size || allowedSources.has("IBGE") ? ibgeSearchIndex : []),
    ...(!allowedSources.size || allowedSources.has("Tesouro Nacional") ? siconfiSearchIndex : []),
    ...(!allowedSources.size || allowedSources.has("Tesouro Nacional") ? tesouroRtnSearchIndex : []),
    ...(!allowedSources.size || allowedSources.has("Tesouro Nacional") ? tesouroDpfSearchIndex : []),
    ...(!allowedSources.size || allowedSources.has("MDIC") ? comexstatSearchIndex : []),
    ...(!allowedSources.size || allowedSources.has("ANP") ? anpSearchIndex : []),
    ...(!allowedSources.size || allowedSources.has("EPE") ? epeSearchIndex : []),
    ...(!allowedSources.size || allowedSources.has("MTE") ? mteSearchIndex : []),
    ...(!allowedSources.size || allowedSources.has("CVM") ? cvmSearchIndex : []),
  ];

  return rawCandidates
    .map((candidate) => {
      const direct = scoreTokenOverlap(queryTokens, candidate.titleTokens);
      const expanded = scoreTokenOverlap(expansionTokens, candidate.titleTokens);
      const phrase = normalizedQuery.length > 3 && candidate.normalizedTitle.includes(normalizedQuery) ? 0.35 : 0;
      const stableIndicatorIds = candidate.stableIndicatorIds;
      // Compatibility is useful, but it must never dominate relevance. A tiny
      // tie-breaker keeps an equally good stable shortcut without bending
      // discovery back toward the legacy 32-series catalog.
      const stableBoost = stableIndicatorIds.length ? 0.01 : 0;
      const datasetId = `${candidate.provider}:${candidate.upstreamId}`;
      const preferredRank = preferredOrder.get(datasetId);
      const preferredBoost = preferredRank === undefined ? 0 : Math.max(0.3, 0.9 - preferredRank * 0.25);
      const score = direct.score * 0.62 + expanded.score * 0.24 + phrase + stableBoost + preferredBoost;
      const why = [];
      if (preferredRank !== undefined) why.push("verified concept-to-dataset match");
      if (direct.matched.length) why.push(`query terms: ${direct.matched.join(", ")}`);
      if (expanded.matched.length) why.push(`concept terms: ${expanded.matched.slice(0, 5).join(", ")}`);
      if (stableIndicatorIds.length) why.push("stable Open Economics series available");
      return { candidate, score, why, stableIndicatorIds };
    })
    .filter((item) => item.score >= 0.16)
    .sort((left, right) => right.score - left.score || left.candidate.upstreamId.localeCompare(right.candidate.upstreamId, undefined, { numeric: true }))
    .slice(0, limit)
    .flatMap(({ candidate, score, why, stableIndicatorIds }) => {
      const dataset = getOfficialDataset(`${candidate.provider}:${candidate.upstreamId}`);
      return dataset ? [{ ...dataset, score: Number(Math.min(score, 1).toFixed(3)), why, stableIndicatorIds }] : [];
    });
}

export function semanticSearch(query: string, limit = 10): SemanticSearchResult {
  const normalizedQuery = normalizeText(query);
  const concepts = routeConcepts(query);
  const top = concepts[0];
  const second = concepts[1];
  const margin = (top?.score ?? 0) - (second?.score ?? 0);
  const resolutionStatus = !top || top.confidence < 0.26
    ? "unresolved"
    : top.confidence < 0.48 || margin < 0.045
      ? "ambiguous"
      : "resolved";
  const selectedConcepts = concepts.filter((concept, index) => index === 0 || (concept.score >= 0.48 && concept.score >= (top?.score ?? 0) - 0.12));
  const datasets = resolutionStatus === "unresolved" ? [] : searchDatasets(query, selectedConcepts, limit);
  const primaryDataset = datasets[0];
  const stable = Boolean(primaryDataset?.stableIndicatorIds.length);
  const missingSources = [...new Set(selectedConcepts.flatMap((concept) => conceptHasIntegratedSource(concept) ? [] : concept.sources))];
  const complete = resolutionStatus === "resolved" && missingSources.length === 0 && Boolean(primaryDataset);

  const availability = resolutionStatus === "unresolved"
    ? { status: "unresolved" as const, complete: false, explanation: "The economic need could not be resolved confidently. Refine the subject, measure, geography, or frequency.", missingSources }
    : stable
      ? { status: "stable-series-ready" as const, complete, explanation: "At least one matching dataset has a stable Open Economics v1 series shortcut.", missingSources }
      : primaryDataset?.provider === "bcb-sgs"
        ? { status: "official-dataset-ready" as const, complete, explanation: "Matching official BCB time series can be queried through the generic dataset route.", missingSources }
        : primaryDataset?.provider === "ibge-aggregates"
          ? { status: "official-dataset-ready" as const, complete, explanation: "Matching official IBGE aggregate data can be queried after selecting its published measures and dimensions.", missingSources }
        : primaryDataset?.provider === "siconfi"
          ? { status: "official-dataset-ready" as const, complete, explanation: "Matching official SICONFI fiscal data can be queried through the generic dataset route.", missingSources }
          : primaryDataset?.provider === "tesouro-rtn"
            ? { status: "official-dataset-ready" as const, complete, explanation: "Matching monthly Government Central revenue, expenditure, and fiscal-result accounts can be queried from the versioned RTN series.", missingSources }
          : primaryDataset?.provider === "tesouro-dpf"
            ? { status: "official-dataset-ready" as const, complete, explanation: "Matching monthly Federal Public Debt composition, holder, average-maturity, and cost statistics can be queried from the versioned RMD annex.", missingSources }
          : primaryDataset?.provider === "comexstat"
            ? { status: "official-dataset-ready" as const, complete, explanation: "Matching official MDIC Comex Stat trade data can be queried through the generic dataset route.", missingSources }
          : primaryDataset?.provider === "anp"
            ? { status: "official-dataset-ready" as const, complete, explanation: "Matching official ANP fuel-price observations can be queried and aggregated by product, period, and geography.", missingSources }
          : primaryDataset?.provider === "epe"
            ? { status: "official-dataset-ready" as const, complete, explanation: "Matching official EPE electricity consumption can be queried by month, geography, class, and market.", missingSources }
          : primaryDataset?.provider === "mte"
            ? { status: "official-dataset-ready" as const, complete, explanation: "Matching official adjusted Novo Caged employment stock and flow can be queried by month and national, region/state, or activity breakdown.", missingSources }
          : primaryDataset?.provider === "cvm"
            ? { status: "official-dataset-ready" as const, complete, explanation: "Matching official CVM investment-fund reports can be queried by daily fund classification or resolved to a fund/class latest report.", missingSources }
        : primaryDataset
          ? { status: "official-metadata-ready" as const, complete, explanation: "Matching official metadata is available, but a query-ready retrieval contract has not been verified.", missingSources }
          : { status: "source-not-integrated" as const, complete: false, explanation: `The need was understood, but its authoritative source is not integrated yet${missingSources.length ? `: ${missingSources.join(", ")}` : "."}`, missingSources };

  return {
    query,
    normalizedQuery,
    resolution: {
      status: resolutionStatus,
      confidence: top?.confidence ?? 0,
      explanation: resolutionStatus === "resolved"
        ? `Resolved primarily to ${top.id}.`
        : resolutionStatus === "ambiguous"
          ? "Several economic concepts are plausible; inspect the candidates before querying data."
          : "No concept cleared the abstention threshold; no nearby series was substituted.",
    },
    concepts: resolutionStatus === "unresolved" ? concepts.filter((concept) => concept.score >= 0.1).slice(0, 3) : selectedConcepts,
    datasets,
    availability,
  };
}

export function economicConcepts() {
  return concepts;
}
