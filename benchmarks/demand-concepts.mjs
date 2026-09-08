/**
 * Independent demand model for Open Economics 2.0.
 *
 * Nothing in this file references an Open Economics indicator ID. Concepts were
 * selected from recurring Brazilian economic-information needs and official
 * statistical domains. Source families are gold provenance constraints, not an
 * implementation roadmap.
 */

function concept(
  id,
  domain,
  en,
  pt,
  sources,
  frequency,
  dimensions = [],
  weight = 2,
) {
  return { id, domain, en, pt, sources, frequency, dimensions, weight };
}

export const concepts = [
  // Prices and cost of living (9)
  concept("ipca-headline", "prices", "headline IPCA inflation", "inflação medida pelo IPCA cheio", ["IBGE"], "monthly", ["change basis", "geography", "basket component"], 3),
  concept("ipca-components", "prices", "IPCA inflation by spending group and item", "IPCA por grupo e item de despesa", ["IBGE"], "monthly", ["basket component", "geography", "change basis"], 3),
  concept("ipca-regional", "prices", "IPCA inflation across surveyed regions", "IPCA por região pesquisada", ["IBGE"], "monthly", ["geography", "change basis"], 2),
  concept("inpc", "prices", "INPC inflation for lower-income households", "inflação do INPC para famílias de menor renda", ["IBGE"], "monthly", ["change basis", "geography", "basket component"], 2),
  concept("ipca15", "prices", "IPCA-15 mid-month inflation", "prévia da inflação IPCA-15", ["IBGE"], "monthly", ["change basis", "geography", "basket component"], 2),
  concept("administered-prices", "prices", "regulated versus market-set consumer prices", "preços administrados e livres", ["BCB", "IBGE"], "monthly", ["price type", "change basis"], 2),
  concept("inflation-diffusion", "prices", "inflation diffusion across consumer-price items", "índice de difusão da inflação", ["BCB", "IBGE"], "monthly", ["basket component"], 2),
  concept("producer-prices", "prices", "producer price inflation", "inflação ao produtor", ["IBGE"], "monthly", ["industry", "change basis"], 2),
  concept("construction-costs", "prices", "construction cost inflation", "variação dos custos da construção", ["IBGE"], "monthly", ["geography", "cost component"], 2),

  // Monetary policy, rates, FX and expectations (8)
  concept("selic-target", "monetary", "Copom Selic target rate", "meta da taxa Selic definida pelo Copom", ["BCB"], "event/daily", ["decision meeting"], 3),
  concept("selic-effective", "monetary", "effective overnight Selic rate", "taxa Selic efetiva", ["BCB"], "daily", [], 2),
  concept("cdi", "monetary", "CDI interbank rate", "taxa CDI interbancária", ["BCB", "B3"], "daily", [], 2),
  concept("yield-curve", "monetary", "Brazilian interest-rate term structure", "estrutura a termo das taxas de juros", ["BCB", "ANBIMA"], "daily", ["maturity", "instrument"], 2),
  concept("inflation-target", "monetary", "official inflation target and tolerance band", "meta oficial de inflação e intervalo de tolerância", ["CMN", "BCB"], "annual", ["target year"], 2),
  concept("focus-expectations", "monetary", "Focus survey expectations", "expectativas do Boletim Focus", ["BCB"], "weekly", ["indicator", "horizon", "statistic"], 3),
  concept("monetary-aggregates", "monetary", "money supply and monetary aggregates", "oferta de moeda e agregados monetários", ["BCB"], "monthly", ["aggregate"], 2),
  concept("exchange-rates", "monetary", "official Brazilian real exchange rates", "taxas de câmbio oficiais do real", ["BCB"], "daily", ["currency", "rate type"], 3),

  // Output and economic activity (10)
  concept("gdp-growth", "activity", "real GDP growth", "crescimento real do PIB", ["IBGE"], "quarterly", ["change basis", "seasonal adjustment"], 3),
  concept("gdp-level", "activity", "nominal and real GDP level", "nível do PIB nominal e real", ["IBGE"], "quarterly/annual", ["price basis", "seasonal adjustment"], 3),
  concept("gdp-expenditure", "activity", "GDP by consumption, investment, government and net exports", "PIB pela ótica da demanda", ["IBGE"], "quarterly", ["expenditure component", "price basis"], 3),
  concept("gdp-industry", "activity", "GDP by industry and economic sector", "PIB por atividade econômica", ["IBGE"], "quarterly/annual", ["industry", "price basis"], 2),
  concept("state-gdp", "activity", "GDP of Brazilian states", "PIB dos estados", ["IBGE"], "annual", ["state", "industry", "price basis"], 2),
  concept("municipal-gdp", "activity", "GDP of Brazilian municipalities", "PIB dos municípios", ["IBGE"], "annual", ["municipality", "industry", "price basis"], 2),
  concept("ibc-br", "activity", "IBC-Br monthly economic activity", "atividade econômica mensal medida pelo IBC-Br", ["BCB"], "monthly", ["seasonal adjustment", "geography"], 3),
  concept("industrial-production", "activity", "industrial production", "produção industrial", ["IBGE"], "monthly", ["industry", "geography", "change basis", "seasonal adjustment"], 3),
  concept("retail-sales", "activity", "retail sales volume and revenue", "volume e receita do comércio varejista", ["IBGE"], "monthly", ["retail segment", "geography", "change basis", "seasonal adjustment"], 3),
  concept("services-volume", "activity", "services-sector volume and revenue", "volume e receita do setor de serviços", ["IBGE"], "monthly", ["service segment", "geography", "change basis", "seasonal adjustment"], 3),

  // Labor, employment and earnings (10)
  concept("unemployment", "labor", "unemployment rate", "taxa de desemprego", ["IBGE"], "moving-quarter/monthly", ["geography", "sex", "age", "education"], 3),
  concept("labor-force-participation", "labor", "labor-force participation rate", "taxa de participação na força de trabalho", ["IBGE"], "moving-quarter/monthly", ["geography", "sex", "age", "education"], 2),
  concept("employment-level", "labor", "employed population", "população ocupada", ["IBGE"], "moving-quarter/monthly", ["geography", "industry", "employment type"], 3),
  concept("underutilization", "labor", "labor underutilization and underemployment", "subutilização e subocupação da força de trabalho", ["IBGE"], "moving-quarter/quarterly", ["geography", "component"], 2),
  concept("informality", "labor", "informality rate", "taxa de informalidade", ["IBGE"], "moving-quarter/monthly", ["geography", "industry"], 2),
  concept("real-earnings", "labor", "real labor earnings", "rendimento real do trabalho", ["IBGE"], "moving-quarter/monthly", ["geography", "industry", "employment type"], 3),
  concept("earnings-mass", "labor", "real aggregate labor-income mass", "massa de rendimento real do trabalho", ["IBGE"], "moving-quarter/monthly", ["geography"], 2),
  concept("formal-job-flow", "labor", "formal job admissions, dismissals and net creation", "admissões, desligamentos e saldo de empregos formais", ["MTE"], "monthly", ["geography", "industry", "occupation", "worker characteristic"], 3),
  concept("formal-job-stock", "labor", "stock of formal employment", "estoque de empregos formais", ["MTE"], "monthly/annual", ["geography", "industry", "occupation", "worker characteristic"], 3),
  concept("wage-gaps", "labor", "earnings gaps by sex and race", "diferenças de rendimento por sexo e raça", ["IBGE", "MTE"], "quarterly/annual", ["sex", "race", "geography", "industry"], 2),

  // Credit and household/business finance (8)
  concept("credit-stock", "credit", "total outstanding credit", "saldo total da carteira de crédito", ["BCB"], "monthly", ["borrower sector", "resource type", "lender type"], 3),
  concept("credit-to-gdp", "credit", "credit as a share of GDP", "crédito como proporção do PIB", ["BCB"], "monthly", ["borrower sector", "resource type"], 2),
  concept("credit-concessions", "credit", "new credit concessions", "concessões de crédito", ["BCB"], "monthly", ["borrower sector", "credit modality", "resource type"], 2),
  concept("credit-interest", "credit", "average lending interest rates", "taxas médias de juros do crédito", ["BCB"], "monthly", ["borrower sector", "credit modality", "resource type"], 3),
  concept("credit-spreads", "credit", "bank lending spreads", "spreads bancários", ["BCB"], "monthly", ["borrower sector", "credit modality"], 2),
  concept("credit-delinquency", "credit", "credit delinquency over 90 days", "inadimplência do crédito acima de 90 dias", ["BCB"], "monthly", ["borrower sector", "credit modality", "resource type"], 3),
  concept("household-debt-service", "credit", "household indebtedness and debt-service burden", "endividamento e comprometimento de renda das famílias", ["BCB"], "monthly", ["debt concept", "housing inclusion"], 3),
  concept("housing-credit", "credit", "housing finance balances, concessions and rates", "saldo, concessões e juros do financiamento imobiliário", ["BCB"], "monthly", ["measure", "resource type", "borrower sector"], 2),

  // National fiscal accounts (8)
  concept("public-primary-balance", "fiscal-national", "public-sector primary balance", "resultado primário do setor público", ["BCB", "Tesouro Nacional"], "monthly", ["government level", "flow basis"], 3),
  concept("central-government-balance", "fiscal-national", "central-government fiscal balance", "resultado fiscal do Governo Central", ["Tesouro Nacional"], "monthly", ["revenue/expense category", "flow basis"], 3),
  concept("gross-public-debt", "fiscal-national", "general-government gross debt", "dívida bruta do governo geral", ["BCB"], "monthly", ["valuation", "instrument"], 3),
  concept("net-public-debt", "fiscal-national", "public-sector net debt", "dívida líquida do setor público", ["BCB"], "monthly", ["government level", "asset/liability component"], 2),
  concept("federal-revenue", "fiscal-national", "federal tax and contribution revenue", "arrecadação federal de impostos e contribuições", ["Receita Federal", "Tesouro Nacional"], "monthly", ["tax type", "economic sector"], 3),
  concept("federal-expenditure", "fiscal-national", "federal government expenditure", "despesas do governo federal", ["Tesouro Nacional"], "monthly", ["economic category", "function", "agency"], 3),
  concept("federal-debt-profile", "fiscal-national", "federal public debt composition, maturity and cost", "composição, vencimento e custo da dívida pública federal", ["Tesouro Nacional"], "monthly", ["instrument", "indexer", "holder", "maturity"], 2),
  concept("social-security-balance", "fiscal-national", "social-security revenue, benefits and balance", "receitas, benefícios e resultado da Previdência", ["Previdência Social", "Tesouro Nacional"], "monthly", ["clientele", "benefit type", "geography"], 2),

  // State and municipal public finance (6)
  concept("subnational-revenue", "fiscal-subnational", "state and municipal revenue", "receitas de estados e municípios", ["Tesouro Nacional"], "bimonthly/annual", ["government entity", "account", "revenue category"], 3),
  concept("subnational-expenditure", "fiscal-subnational", "state and municipal expenditure", "despesas de estados e municípios", ["Tesouro Nacional"], "bimonthly/annual", ["government entity", "function", "expense category"], 3),
  concept("subnational-debt", "fiscal-subnational", "state and municipal debt", "dívida de estados e municípios", ["Tesouro Nacional"], "quadrimester/annual", ["government entity", "debt concept"], 2),
  concept("personnel-spending", "fiscal-subnational", "subnational personnel spending and fiscal limits", "despesa de pessoal e limites fiscais dos entes", ["Tesouro Nacional"], "quadrimester", ["government entity", "government branch", "limit concept"], 2),
  concept("health-education-spending", "fiscal-subnational", "minimum health and education spending by government entity", "gastos mínimos em saúde e educação por ente", ["Tesouro Nacional", "FNDE"], "bimonthly/annual", ["government entity", "policy function", "limit concept"], 2),
  concept("intergovernmental-transfers", "fiscal-subnational", "federal transfers to states and municipalities", "transferências federais para estados e municípios", ["Tesouro Nacional"], "monthly", ["government entity", "transfer type"], 2),

  // External sector and trade (9)
  concept("current-account", "external", "current-account balance", "saldo em transações correntes", ["BCB"], "monthly", ["component"], 3),
  concept("foreign-direct-investment", "external", "foreign direct investment in Brazil", "investimento direto no país", ["BCB"], "monthly", ["component", "country"], 3),
  concept("portfolio-flows", "external", "portfolio investment flows", "fluxos de investimento em carteira", ["BCB"], "monthly", ["instrument", "direction"], 2),
  concept("international-reserves", "external", "international reserves", "reservas internacionais", ["BCB"], "daily/monthly", ["reserve concept"], 3),
  concept("external-debt", "external", "Brazilian external debt", "dívida externa brasileira", ["BCB"], "quarterly", ["sector", "maturity", "instrument"], 2),
  concept("trade-balance", "external", "merchandise trade balance", "balança comercial de bens", ["MDIC", "BCB"], "monthly", ["flow", "product", "partner", "geography"], 3),
  concept("exports", "external", "Brazilian merchandise exports", "exportações brasileiras de bens", ["MDIC"], "monthly", ["product", "partner", "state", "transport mode"], 3),
  concept("imports", "external", "Brazilian merchandise imports", "importações brasileiras de bens", ["MDIC"], "monthly", ["product", "partner", "state", "transport mode"], 3),
  concept("terms-of-trade", "external", "terms of trade and export/import price indexes", "termos de troca e índices de preços de exportação e importação", ["FUNCEX", "IPEA"], "monthly", ["index type"], 1),

  // Capital markets and financial system (6)
  concept("investment-funds", "markets", "investment-fund assets, quotas and investor counts", "patrimônio, cotas e cotistas de fundos de investimento", ["CVM"], "daily/monthly", ["fund", "fund class", "measure"], 2),
  concept("listed-company-financials", "markets", "financial statements of listed companies", "demonstrações financeiras de companhias abertas", ["CVM"], "quarterly/annual", ["company", "statement", "account"], 2),
  concept("public-offerings", "markets", "registered securities offerings", "ofertas públicas de valores mobiliários", ["CVM"], "event", ["security type", "issuer", "offering status"], 1),
  concept("financial-institutions", "markets", "financial-institution registry and balance-sheet aggregates", "cadastro e agregados contábeis de instituições financeiras", ["BCB"], "monthly/quarterly", ["institution", "conglomerate", "account"], 2),
  concept("pix-statistics", "markets", "Pix usage and transaction statistics", "estatísticas de uso e transações do Pix", ["BCB"], "monthly", ["participant", "person type", "transaction type"], 2),
  concept("capital-market-investors", "markets", "investor participation in Brazilian capital markets", "participação de investidores no mercado de capitais", ["CVM", "B3"], "monthly", ["investor type", "market segment"], 1),

  // Population, households and inequality (7)
  concept("population", "population-income", "Brazilian population estimates and census counts", "população brasileira estimada e censitária", ["IBGE"], "annual/decennial", ["geography", "age", "sex"], 3),
  concept("population-projections", "population-income", "population projections", "projeções da população", ["IBGE"], "annual", ["geography", "age", "sex", "projection scenario"], 2),
  concept("household-income", "population-income", "household per-capita income", "renda domiciliar per capita", ["IBGE"], "quarterly/annual", ["geography", "income class", "household characteristic"], 3),
  concept("income-inequality", "population-income", "income inequality and Gini coefficient", "desigualdade de renda e índice de Gini", ["IBGE", "IPEA"], "annual", ["geography", "income concept"], 2),
  concept("poverty", "population-income", "poverty and extreme-poverty rates", "taxas de pobreza e extrema pobreza", ["IBGE", "IPEA"], "annual", ["geography", "poverty line", "household characteristic"], 2),
  concept("household-consumption", "population-income", "household consumption expenditure and budget shares", "despesas de consumo e orçamento das famílias", ["IBGE"], "survey/annualized", ["expense category", "income class", "geography"], 2),
  concept("consumer-durable-ownership", "population-income", "household access to durable goods and services", "acesso domiciliar a bens duráveis e serviços", ["IBGE"], "annual/decennial", ["asset/service", "geography", "household characteristic"], 1),

  // Agriculture (5)
  concept("crop-harvest", "agriculture", "crop area, production and yield forecasts", "previsão de área, produção e produtividade agrícola", ["IBGE", "CONAB"], "monthly/annual", ["crop", "geography", "harvest year", "forecast vintage"], 3),
  concept("agricultural-production", "agriculture", "annual agricultural production", "produção agrícola anual", ["IBGE"], "annual", ["crop", "geography", "measure"], 2),
  concept("livestock-production", "agriculture", "livestock inventories and animal production", "rebanhos e produção pecuária", ["IBGE"], "quarterly/annual", ["animal/product", "geography", "measure"], 2),
  concept("food-supply-stocks", "agriculture", "public food supply and crop stocks", "abastecimento e estoques agrícolas", ["CONAB", "IBGE"], "monthly/annual", ["product", "geography", "stock type"], 1),
  concept("rural-credit", "agriculture", "rural credit disbursements and balances", "concessões e saldo do crédito rural", ["BCB"], "monthly", ["program", "purpose", "borrower", "geography"], 2),

  // Energy and natural resources (5)
  concept("electricity-generation", "energy", "electricity generation", "geração de energia elétrica", ["ANEEL", "ONS", "EPE"], "daily/monthly", ["energy source", "subsystem", "facility"], 2),
  concept("electricity-consumption", "energy", "electricity consumption", "consumo de energia elétrica", ["EPE"], "monthly", ["consumer class", "geography"], 2),
  concept("oil-gas-production", "energy", "oil and natural-gas production", "produção de petróleo e gás natural", ["ANP"], "monthly", ["product", "field", "basin", "pre-salt status"], 2),
  concept("fuel-prices", "energy", "retail fuel prices", "preços de combustíveis ao consumidor", ["ANP"], "weekly", ["fuel", "geography", "price statistic"], 3),
  concept("energy-balance", "energy", "Brazilian energy supply and use balance", "balanço energético brasileiro", ["EPE"], "annual", ["energy source", "economic sector", "flow"], 1),

  // Housing and construction (3)
  concept("construction-activity", "housing", "construction output and activity", "atividade e produção da construção", ["IBGE"], "monthly/quarterly", ["measure", "geography"], 2),
  concept("housing-stock", "housing", "housing stock and household occupancy", "estoque de domicílios e condição de ocupação", ["IBGE"], "annual/decennial", ["geography", "occupancy status", "housing characteristic"], 1),
  concept("housing-rent", "housing", "residential rent inflation", "inflação de aluguel residencial", ["IBGE"], "monthly", ["geography", "change basis"], 2),

  // Environment with material economic use (2)
  concept("deforestation", "environment", "official deforestation estimates", "estimativas oficiais de desmatamento", ["INPE"], "daily/annual", ["biome", "geography", "monitoring system"], 1),
  concept("greenhouse-emissions", "environment", "Brazilian greenhouse-gas emissions inventory", "inventário brasileiro de emissões de gases de efeito estufa", ["MCTI"], "annual", ["gas", "sector", "inventory methodology"], 1),
];

export const complexCases = [
  ["compare-selic-ipca", "Compare the Selic target with 12-month IPCA since 2018.", "Compare a meta Selic com o IPCA em 12 meses desde 2018.", ["selic-target", "ipca-headline"], "comparison", 3],
  ["unemployment-since-2015", "Show unemployment since 2015 and explain that each monthly point is a moving quarter.", "Mostre o desemprego desde 2015 e explique que cada ponto mensal é um trimestre móvel.", ["unemployment"], "history-with-semantics", 3],
  ["household-vs-company-delinquency", "Compare household and company credit delinquency over the last five years.", "Compare a inadimplência do crédito de famílias e empresas nos últimos cinco anos.", ["credit-delinquency"], "dimension-comparison", 3],
  ["gdp-demand-contribution", "Which contributed more to recent GDP growth: household consumption or investment?", "O que contribuiu mais para o crescimento recente do PIB: consumo das famílias ou investimento?", ["gdp-expenditure", "gdp-growth"], "multi-measure-analysis", 3],
  ["state-gdp-ranking", "Rank states by real GDP growth and GDP per capita, preserving the reference year.", "Ordene os estados por crescimento real do PIB e PIB per capita, preservando o ano de referência.", ["state-gdp", "population"], "ranking", 2],
  ["municipal-fiscal-comparison", "Compare personnel spending and net current revenue for Recife, Salvador and Fortaleza.", "Compare despesa de pessoal e receita corrente líquida de Recife, Salvador e Fortaleza.", ["personnel-spending", "subnational-revenue"], "entity-comparison", 2],
  ["soy-exports-china", "Monthly soybean export value and volume to China by Brazilian state since 2020.", "Valor e volume mensal das exportações de soja para a China por estado desde 2020.", ["exports"], "multidimensional-query", 3],
  ["formal-jobs-sector-state", "Net formal job creation by sector and state over the last 24 months.", "Saldo de empregos formais por setor e estado nos últimos 24 meses.", ["formal-job-flow"], "multidimensional-query", 3],
  ["wages-vs-inflation", "Have real earnings recovered faster than consumer prices since the pandemic?", "Os rendimentos reais se recuperaram mais rápido que os preços ao consumidor desde a pandemia?", ["real-earnings", "ipca-headline"], "comparison", 3],
  ["debt-cost-rate-cycle", "Compare the federal debt's average cost and maturity with the Selic cycle.", "Compare o custo médio e o prazo da dívida federal com o ciclo da Selic.", ["federal-debt-profile", "selic-target"], "comparison", 2],
  ["focus-vs-actual", "Compare Focus inflation expectations made a year earlier with realized IPCA.", "Compare as expectativas de inflação do Focus feitas um ano antes com o IPCA realizado.", ["focus-expectations", "ipca-headline"], "vintage-comparison", 3],
  ["credit-modality-cost", "Which household credit modalities have the highest rates and delinquency?", "Quais modalidades de crédito para pessoas físicas têm os maiores juros e inadimplência?", ["credit-interest", "credit-delinquency"], "ranking", 3],
  ["rent-vs-headline", "Compare residential rent inflation with headline IPCA in my region.", "Compare a inflação do aluguel residencial com o IPCA cheio na minha região.", ["housing-rent", "ipca-headline"], "geographic-comparison", 2],
  ["industrial-electricity", "Industrial electricity consumption by state alongside industrial production.", "Consumo industrial de energia por estado junto com a produção industrial.", ["electricity-consumption", "industrial-production"], "cross-source-comparison", 2],
  ["presalt-production", "How much of Brazil's oil production comes from the pre-salt, by month?", "Quanto da produção brasileira de petróleo vem do pré-sal, por mês?", ["oil-gas-production"], "share", 2],
  ["fund-industry", "Track investment-fund assets and investor counts by fund class.", "Acompanhe o patrimônio e o número de cotistas por classe de fundo.", ["investment-funds"], "multidimensional-query", 2],
  ["listed-company-leverage", "Compare net debt and EBITDA for listed Brazilian companies in the same sector.", "Compare dívida líquida e EBITDA de companhias abertas brasileiras do mesmo setor.", ["listed-company-financials"], "entity-comparison", 2],
  ["aging-projection", "How will Brazil's old-age dependency ratio change through 2060?", "Como a razão de dependência de idosos no Brasil mudará até 2060?", ["population-projections"], "projection-retrieval", 2],
  ["poverty-inequality-regions", "Compare poverty and income inequality across Brazilian regions.", "Compare pobreza e desigualdade de renda entre as regiões brasileiras.", ["poverty", "income-inequality"], "geographic-comparison", 2],
  ["harvest-vintages", "How has the current soybean harvest forecast been revised across monthly vintages?", "Como a previsão atual da safra de soja foi revisada entre as divulgações mensais?", ["crop-harvest"], "vintage-comparison", 2],
  ["tax-revenue-mix", "How has the composition of federal tax revenue changed since 2019?", "Como mudou a composição da arrecadação federal desde 2019?", ["federal-revenue"], "composition", 3],
  ["pension-balance", "Show social-security contributions, benefits and the resulting balance by client group.", "Mostre contribuições, benefícios e o resultado da Previdência por clientela.", ["social-security-balance"], "multidimensional-query", 2],
  ["causal-inflation-boundary", "Why did Brazilian inflation rise last month? Use official data and distinguish evidence from causal interpretation.", "Por que a inflação brasileira subiu no mês passado? Use dados oficiais e diferencie evidência de interpretação causal.", ["ipca-components", "administered-prices"], "boundary-causal", 3],
  ["forecast-boundary", "Forecast next year's GDP using Open Economics data.", "Faça uma previsão do PIB do próximo ano usando dados do Open Economics.", ["gdp-growth", "focus-expectations"], "boundary-no-original-forecast", 3],
];

if (concepts.length !== 96) {
  throw new Error(`Expected 96 independent demand concepts, found ${concepts.length}.`);
}

