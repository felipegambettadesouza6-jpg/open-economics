import assert from "node:assert/strict";
import test from "node:test";

let workerPromise;
async function worker() {
  workerPromise ??= import(new URL("../dist/server/index.js", import.meta.url).href).then((module) => module.default);
  return workerPromise;
}

function env() {
  return {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
}

function envWithSnapshots() {
  const snapshots = new Map();
  const DB = {
    async batch() { return []; },
    prepare(sql) {
      let values = [];
      return {
        bind(...nextValues) {
          values = nextValues;
          return this;
        },
        async first() {
          if (!sql.startsWith("SELECT payload_json")) return null;
          return snapshots.get(values[0]) ?? null;
        },
        async run() {
          if (sql.startsWith("INSERT INTO series_snapshots")) {
            snapshots.set(values[0], {
              payload_json: values[2],
              fetched_at: values[3],
              expires_at: values[4],
            });
          }
          return {};
        },
      };
    },
  };
  return { runtimeEnv: { ...env(), DB }, snapshots };
}

const ctx = { waitUntil() {}, passThroughOnException() {} };

async function request(path, init = {}, runtimeEnv = env()) {
  const runtime = await worker();
  return runtime.fetch(
    new Request(`http://localhost:3000${path}`, { headers: { accept: "application/json", ...(init.headers ?? {}) }, ...init }),
    runtimeEnv,
    ctx,
  );
}

async function withFetchMock(mock, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("catalog exposes canonical filters and rejects invalid filter values", { concurrency: false }, async () => {
  const response = await request("/api/v1/indicators?q=selic&source=BCB&frequency=daily");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-expose-headers"), "Cache-Control, Server-Timing, Warning, X-Request-Id");

  const body = await response.json();
  assert.ok(body.data.some((indicator) => indicator.id === "br-selic-target"));
  assert.equal(body.meta.filters.source, "bcb");
  assert.ok(body.meta.available_filters.categories.some((category) => category.id === "inflation"));
  assert.ok(body.data.every((indicator) => indicator.links.self.startsWith("http://localhost:3000/api/v1/")));

  const invalid = await request("/api/v1/indicators?category=made-up");
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, "INVALID_CATEGORY");
});

test("normalizes BCB daily observations, preserves raw provenance, and sorts upstream rows", { concurrency: false }, async () => {
  let upstreamUrl = "";
  let upstreamInit;
  await withFetchMock(async (input, init) => {
    upstreamUrl = String(input);
    upstreamInit = init;
    return new Response(JSON.stringify([
      { data: "03/01/2024", valor: "11.75" },
      { data: "01/01/2024", valor: "11.75" },
      { data: "02/01/2024", valor: "11.75" },
    ]), { headers: { "content-type": "application/json" } });
  }, async () => {
    const response = await request("/api/v1/indicators/br-selic-target/observations?start=2024-01-01&end=2024-01-03&limit=2");
    assert.equal(response.status, 200);
    const body = await response.json();

    assert.deepEqual(body.data.map((item) => item.date), ["2024-01-01", "2024-01-02"]);
    assert.deepEqual(body.data.map((item) => item.period), ["2024-01-01", "2024-01-02"]);
    assert.equal(body.data[0].raw_value, "11.75");
    assert.equal(body.meta.available, 3);
    assert.equal(body.meta.returned, 2);
    assert.equal(body.meta.truncated, true);
    assert.match(body.meta.provenance.upstream_url, /dataInicial=01%2F01%2F2024/);

    const csvResponse = await request("/api/v1/indicators/br-selic-target/observations?start=2024-01-01&end=2024-01-03&format=csv");
    assert.equal(csvResponse.status, 200);
    assert.match(csvResponse.headers.get("content-type") ?? "", /^text\/csv/);
    const csv = await csvResponse.text();
    assert.match(csv, /^indicator_id,source_id,source_url,upstream_url,date,period,value,status,source_date,raw_value/m);
    assert.match(csv, /br-selic-target,bcb,/);
  });
  assert.match(upstreamUrl, /dataFinal=03%2F01%2F2024/);
  assert.equal(upstreamInit.cache, "no-store");
  assert.equal("cf" in upstreamInit, false);
});

test("v2 resolves demand before availability and abstains instead of substituting", { concurrency: false }, async () => {
  const root = await request("/api/v2");
  const rootBody = await root.json();
  assert.equal(rootBody.version, "v2");
  assert.equal(rootBody.status, "stable");
  assert.equal(rootBody.links.mcp, "http://localhost:3000/api/mcp");

  const inflation = await request("/api/v2/search?q=Brazilian%20monthly%20inflation&limit=3");
  assert.equal(inflation.status, 200);
  const inflationBody = await inflation.json();
  assert.equal(inflationBody.data.resolution.status, "resolved");
  assert.equal(inflationBody.data.concepts[0].id, "ipca-headline");
  assert.equal(inflationBody.meta.catalog.counts.total, 12886);
  assert.ok(inflationBody.data.datasets.some((dataset) => dataset.stableIndicatorIds.includes("br-ipca-monthly")));

  const formalJobs = await request("/api/v2/search?q=formal%20jobs%20by%20state");
  const formalJobsBody = await formalJobs.json();
  assert.equal(formalJobsBody.data.concepts[0].id, "formal-job-flow");
  assert.equal(formalJobsBody.data.datasets[0].id, "mte:formal-employment");
  assert.equal(formalJobsBody.data.availability.status, "official-dataset-ready");
  assert.equal(formalJobsBody.data.availability.complete, true);

  const nonsense = await request("/api/v2/search?q=quantum%20banana%20weather");
  const nonsenseBody = await nonsense.json();
  assert.equal(nonsenseBody.data.resolution.status, "unresolved");
  assert.deepEqual(nonsenseBody.data.datasets, []);
});

test("v2 exposes stable identities and generic BCB observations with provenance", { concurrency: false }, async () => {
  const detail = await request("/api/v2/datasets/bcb-sgs%3A432");
  assert.equal(detail.status, 200);
  const detailBody = await detail.json();
  assert.equal(detailBody.data.id, "bcb-sgs:432");
  assert.deepEqual(detailBody.data.stableIndicatorIds, ["br-selic-target"]);

  await withFetchMock(async (input) => {
    const upstream = String(input);
    if (upstream.includes("consultarMetadadosSeriesInternet")) return new Response("", { headers: { "set-cookie": "JSESSIONID=test-session; Path=/sgspub" } });
    if (upstream.includes("cmiDadosBasicos.jsp")) return new Response(`
      <td><span><b>Full name</b></span></td><td><span>Interest rate - Selic target</span></td>
      <td><span><b>Periodicity</b></span></td><td><span>Daily</span></td>
      <td><span><b>Unit</b></span></td><td><span>% p.y.</span></td>
      <td><span><b>Source</b></span></td><td><span>Copom</span></td>
    `);
    assert.match(upstream, /bcdata\.sgs\.432\/dados/);
    return new Response(JSON.stringify([{ data: "02/01/2024", valor: "11,75" }]));
  }, async () => {
    const response = await request("/api/v2/datasets/bcb-sgs%3A432/observations?start=2024-01-01&end=2024-01-03");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data[0].date, "2024-01-02");
    assert.equal(body.data[0].value, 11.75);
    assert.equal(body.meta.dataset.sourceAgency, "BCB");
    assert.equal(body.meta.schema.periodicity, "Daily");
    assert.equal(body.meta.schema.unit, "% p.y.");
    assert.match(body.meta.provenance.upstream_url, /dataInicial=01%2F01%2F2024/);
  });
});

test("v2 preserves IBGE dimensions and distinct official value states", { concurrency: false }, async () => {
  await withFetchMock(async (input) => {
    assert.match(String(input), /agregados\/5932\/periodos\/-2\/variaveis\/6561/);
    return new Response(JSON.stringify([{
      id: "6561",
      variavel: "Taxa trimestral",
      unidade: "%",
      resultados: [{
        classificacoes: [{ id: "11255", nome: "Setores", categoria: { "90707": "PIB" } }],
        series: [{
          localidade: { id: "1", nivel: { id: "N1", nome: "Brasil" }, nome: "Brasil" },
          serie: { "202601": "1.8", "202602": "X" },
        }],
      }],
    }]));
  }, async () => {
    const response = await request("/api/v2/datasets/ibge-aggregates%3A5932/observations?variable=6561&periods=-2&locality=BR&classification=11255%5B90707%5D");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data[0].unit, "%");
    assert.equal(body.data[0].results[0].classifications[0].categoria["90707"], "PIB");
    assert.equal(body.data[0].results[0].series[0].geography.name, "Brasil");
    assert.equal(body.data[0].results[0].series[0].observations[1].status, "suppressed");
    assert.equal(body.meta.selection.classification, "11255[90707]");
  });
});

test("v2 routes fiscal needs to SICONFI and preserves report structure and provenance", { concurrency: false }, async () => {
  const search = await request("/api/v2/search?q=municipal%20revenue%20and%20expenditure");
  const searchBody = await search.json();
  assert.equal(searchBody.data.concepts[0].id, "subnational-revenue");
  assert.equal(searchBody.data.datasets[0].id, "siconfi:dca");
  assert.equal(searchBody.data.availability.status, "official-dataset-ready");

  await withFetchMock(async (input) => {
    const upstream = String(input);
    assert.match(upstream, /siconfi\/tt\/dca/);
    assert.match(upstream, /an_exercicio=2024/);
    assert.match(upstream, /id_ente=3550308/);
    return new Response(JSON.stringify({ items: [{ instituicao: "Prefeitura", conta: "Receitas", coluna: "Receitas realizadas", valor: "100,00" }], count: 1, hasMore: false, limit: 5000, offset: 0 }));
  }, async () => {
    const response = await request("/api/v2/datasets/siconfi%3Adca/observations?year=2024&entity=3550308&annex=DCA-Anexo%20I-C");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data[0].valor, "100,00");
    assert.equal(body.meta.selection.entity, 3550308);
    assert.equal(body.meta.provenance.source, "Tesouro Nacional — SICONFI");
  });

  const missingEntity = await request("/api/v2/datasets/siconfi%3Adca/observations?year=2024");
  assert.equal(missingEntity.status, 400);
  assert.equal((await missingEntity.json()).code, "INVALID_ENTITY");
});

test("v2 resolves detailed trade demand and sends bounded selections to Comex Stat", { concurrency: false }, async () => {
  const search = await request("/api/v2/search?q=Brazilian%20exports%20by%20product%20and%20country");
  const searchBody = await search.json();
  assert.equal(searchBody.data.concepts[0].id, "exports");
  assert.equal(searchBody.data.datasets[0].id, "comexstat:general");

  await withFetchMock(async (input, init) => {
    assert.equal(String(input), "https://api-comexstat.mdic.gov.br/general?language=en");
    assert.equal(init.method, "POST");
    const selection = JSON.parse(init.body);
    assert.equal(selection.flow, "export");
    assert.deepEqual(selection.details, ["country", "heading"]);
    assert.deepEqual(selection.metrics, ["metricFOB", "metricKG"]);
    return new Response(JSON.stringify({ success: true, data: { list: [{ year: "2026", monthNumber: "08", country: "China", metricFOB: "1000" }] }, language: "en" }));
  }, async () => {
    const response = await request("/api/v2/datasets/comexstat%3Ageneral/observations?flow=export&from=2026-08&to=2026-08&details=country%7Cheading&metrics=metricFOB%7CmetricKG&language=en");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data[0].country, "China");
    assert.equal(body.meta.selection.flow, "export");
    assert.equal(body.meta.provenance.source, "MDIC — Comex Stat");
  });

  const invalid = await request("/api/v2/datasets/comexstat%3Ageneral/observations?flow=export&from=2026-08&to=2026-08&metrics=metricCIF");
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, "INVALID_METRICS");
});

test("v2 routes fuel-price demand to ANP and returns disclosed privacy-minimized aggregates", { concurrency: false }, async () => {
  const search = await request("/api/v2/search?q=preco%20da%20gasolina%20em%20Sao%20Paulo");
  const searchBody = await search.json();
  assert.equal(searchBody.data.concepts[0].id, "fuel-prices");
  assert.equal(searchBody.data.datasets[0].id, "anp:fuel-prices");
  assert.equal(searchBody.data.availability.status, "official-dataset-ready");

  const csv = [
    "Regiao - Sigla;Estado - Sigla;Municipio;Revenda;CNPJ da Revenda;Nome da Rua;Numero Rua;Complemento;Bairro;Cep;Produto;Data da Coleta;Valor de Venda;Valor de Compra;Unidade de Medida;Bandeira",
    "SE;SP;SAO PAULO;POSTO A;00.000.000/0001-00;RUA A;1;;;00000-000;GASOLINA;03/08/2026;6,00;;R$ / litro;BRANCA",
    "SE;SP;CAMPINAS;POSTO B;00.000.000/0001-01;RUA B;2;;;00000-001;GASOLINA;05/08/2026;6,20;;R$ / litro;BRANCA",
    "SE;RJ;RIO DE JANEIRO;POSTO C;00.000.000/0001-02;RUA C;3;;;00000-002;GASOLINA;05/08/2026;6,80;;R$ / litro;BRANCA",
  ].join("\n");
  await withFetchMock(async (input) => {
    assert.match(String(input), /ultimas-4-semanas-gasolina-etanol\.csv$/);
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8" } });
  }, async () => {
    const response = await request("/api/v2/datasets/anp%3Afuel-prices/observations?fuel_group=gasoline-ethanol&geography=state&state=SP&period=week&product=GASOLINA");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].geography.id, "SP");
    assert.equal(body.data[0].source_observation_count, 2);
    assert.equal(body.data[0].average_sale_price, 6.1);
    assert.equal(body.data[0].minimum_sale_price, 6);
    assert.equal(body.data[0].maximum_sale_price, 6.2);
    assert.equal(body.meta.provenance.source, "ANP — Levantamento de Preços de Combustíveis");
    assert.deepEqual(body.meta.transformation.excluded_source_fields, ["station name", "CNPJ", "street address", "brand"]);
  });

  const incomplete = await request("/api/v2/datasets/anp%3Afuel-prices/observations?fuel_group=glp&year=2026");
  assert.equal(incomplete.status, 400);
  assert.equal((await incomplete.json()).code, "INCOMPLETE_PERIOD");
});

test("v2 routes electricity demand to the versioned EPE snapshot and preserves dimensions", { concurrency: false }, async () => {
  const search = await request("/api/v2/search?q=consumo%20residencial%20industrial%20e%20comercial%20de%20energia%20por%20estado");
  const searchBody = await search.json();
  assert.equal(searchBody.data.concepts[0].id, "electricity-consumption");
  assert.equal(searchBody.data.datasets[0].id, "epe:electricity-consumption");
  assert.equal(searchBody.data.availability.status, "official-dataset-ready");

  const response = await request("/api/v2/datasets/epe%3Aelectricity-consumption/observations?from=2026-06&to=2026-06&geography=state&states=SP&classes=Residencial&markets=Cativo");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].period, "2026-06");
  assert.equal(body.data[0].geography.id, "SP");
  assert.equal(body.data[0].class, "Residencial");
  assert.equal(body.data[0].market, "Cativo");
  assert.ok(body.data[0].consumption_mwh > 0);
  assert.equal(body.meta.provenance.source_version, "2026-08-24");
  assert.match(body.meta.provenance.upstream_url, /Dados_abertos_Consumo_Mensal\.xlsx$/);
});

test("v2 routes formal-job demand to adjusted Novo Caged stock and flows without combining official tables", { concurrency: false }, async () => {
  const search = await request("/api/v2/search?q=saldo%20de%20empregos%20formais%20por%20estado");
  const searchBody = await search.json();
  assert.equal(searchBody.data.concepts[0].id, "formal-job-flow");
  assert.equal(searchBody.data.datasets[0].id, "mte:formal-employment");
  assert.equal(searchBody.data.availability.status, "official-dataset-ready");

  const response = await request("/api/v2/datasets/mte%3Aformal-employment/observations?from=2026-07&to=2026-07&breakdown=state&states=SP");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].period, "2026-07");
  assert.deepEqual(body.data[0].breakdown, { type: "state", id: "SP", label: "São Paulo" });
  assert.equal(body.data[0].stock, 14706436);
  assert.equal(body.data[0].admissions, 708456);
  assert.equal(body.data[0].dismissals, 690642);
  assert.equal(body.data[0].balance, 17814);
  assert.equal(body.meta.provenance.source_version, "202607");
  assert.match(body.meta.provenance.source_file, /202607/);

  const invalid = await request("/api/v2/datasets/mte%3Aformal-employment/observations?breakdown=industry&states=SP");
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, "INVALID_BREAKDOWN");
});

test("v2 routes fund demand to CVM and preserves aggregate versus fund-level semantics", { concurrency: false }, async () => {
  const search = await request("/api/v2/search?q=patrimonio%20cotas%20e%20cotistas%20de%20fundos%20de%20investimento");
  const searchBody = await search.json();
  assert.equal(searchBody.data.concepts[0].id, "investment-funds");
  assert.equal(searchBody.data.datasets[0].id, "cvm:investment-funds");
  assert.equal(searchBody.data.availability.status, "official-dataset-ready");

  const aggregate = await request("/api/v2/datasets/cvm%3Ainvestment-funds/observations?from=2026-09-03&to=2026-09-03&breakdown=classification&classifications=Renda%20Fixa");
  assert.equal(aggregate.status, 200);
  const aggregateBody = await aggregate.json();
  assert.equal(aggregateBody.data.length, 1);
  assert.equal(aggregateBody.data[0].breakdown.label, "Renda Fixa");
  assert.ok(aggregateBody.data[0].net_assets_brl > 0);
  assert.equal(aggregateBody.data[0].quota_value_brl, null);
  assert.equal(aggregateBody.meta.source_snapshot.endDate, "2026-09-03");
  assert.equal(aggregateBody.meta.source_snapshot.sourceEndDate, "2026-09-04");

  const fund = await request("/api/v2/datasets/cvm%3Ainvestment-funds/observations?breakdown=fund&q=BRASILPREV%20TOP%20TPF&limit=5");
  assert.equal(fund.status, 200);
  const fundBody = await fund.json();
  assert.ok(fundBody.data.length >= 1);
  assert.match(fundBody.data[0].breakdown.name, /BRASILPREV TOP TPF/);
  assert.ok(fundBody.data[0].quota_value_brl > 0);
  assert.match(fundBody.meta.provenance.dictionary_url, /meta_inf_diario_fi\.txt$/);

  const unsafeDump = await request("/api/v2/datasets/cvm%3Ainvestment-funds/observations?breakdown=fund");
  assert.equal(unsafeDump.status, 400);
  assert.equal((await unsafeDump.json()).code, "MISSING_FUND_SELECTION");
});

test("v2 routes Government Central fiscal demand to RTN and preserves account hierarchy", { concurrency: false }, async () => {
  const search = await request("/api/v2/search?q=resultado%20receitas%20e%20despesas%20do%20governo%20central");
  const searchBody = await search.json();
  assert.equal(searchBody.data.datasets[0].id, "tesouro-rtn:government-central");
  assert.equal(searchBody.data.availability.status, "official-dataset-ready");

  const response = await request("/api/v2/datasets/tesouro-rtn%3Agovernment-central/observations?from=2026-07&to=2026-07&accounts=1%7C4%7C5");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.length, 3);
  assert.deepEqual(body.data.map((row) => row.account.id), ["1", "4", "5"]);
  assert.equal(body.data[0].value_millions_brl, 275883.95996691);
  assert.equal(body.data[1].value_millions_brl, 215522.0223716);
  assert.equal(body.data[2].value_millions_brl, 10783.4321841);
  assert.equal(body.meta.provenance.table, "1.2");
  assert.match(body.meta.provenance.source_file, /jul26\.xlsx$/);

  const detail = await request("/api/v2/datasets/tesouro-rtn%3Agovernment-central/observations?from=2026-07&to=2026-07&q=Bolsa%20Familia");
  assert.equal(detail.status, 200);
  const detailBody = await detail.json();
  assert.equal(detailBody.data.length, 1);
  assert.equal(detailBody.data[0].account.id, "4.4.1.2");
});

test("v2 routes Federal Public Debt demand to distinct RMD tables without mixing units", { concurrency: false }, async () => {
  const search = await request("/api/v2/search?q=federal%20public%20debt%20composition%20holders%20maturity%20and%20cost");
  const searchBody = await search.json();
  assert.equal(searchBody.data.concepts[0].id, "federal-debt-profile");
  assert.equal(searchBody.data.datasets[0].id, "tesouro-dpf:debt-profile");
  assert.equal(searchBody.data.availability.status, "official-dataset-ready");

  const composition = await request("/api/v2/datasets/tesouro-dpf%3Adebt-profile/observations?table=composition&from=2026-07&to=2026-07&categories=total%7Ctaxa-flutuante");
  assert.equal(composition.status, 200);
  const compositionBody = await composition.json();
  assert.deepEqual(compositionBody.data.map((row) => row.category.id), ["taxa-flutuante", "total"]);
  assert.equal(compositionBody.data[0].unit, "BRL billion");
  assert.equal(compositionBody.data[0].value, 4747.25402252676);
  assert.equal(compositionBody.data[1].value, 9288.7802713778);
  assert.equal(compositionBody.data[1].share_percent, 100);

  const holders = await request("/api/v2/datasets/tesouro-dpf%3Adebt-profile/observations?table=holders&from=2026-07&to=2026-07&categories=nao-residentes");
  const holdersBody = await holders.json();
  assert.equal(holdersBody.data[0].value, 879.072502796579);
  assert.equal(holdersBody.data[0].share_percent, 9.823447605653262);
  assert.ok(holdersBody.meta.table.footnotes.some((note) => note.includes("não-residentes")));

  const maturity = await request("/api/v2/datasets/tesouro-dpf%3Adebt-profile/observations?table=average-maturity-by-indexer&from=2026-07&to=2026-07&categories=indice-de-precos");
  const maturityBody = await maturity.json();
  assert.equal(maturityBody.data[0].unit, "years");
  assert.equal(maturityBody.data[0].value, 6.84903275);

  const cost = await request("/api/v2/datasets/tesouro-dpf%3Adebt-profile/observations?table=twelve-month-cost&from=2026-07&to=2026-07&categories=dpf");
  const costBody = await cost.json();
  assert.equal(costBody.data[0].unit, "% p.a.");
  assert.equal(costBody.data[0].value, 12.45432);
  assert.match(costBody.meta.provenance.annex_url, /publicacao-anexo\/29025$/);
});

test("MCP exposes a focused read-only tool surface backed by v2 discovery", { concurrency: false }, async () => {
  const headers = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-protocol-version": "2025-11-25",
  };
  const listed = await request("/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  assert.equal(listed.status, 200);
  const listedText = await listed.text();
  assert.match(listedText, /search_official_data/);
  assert.match(listedText, /get_ibge_schema/);
  assert.match(listedText, /get_siconfi_data/);
  assert.match(listedText, /get_comexstat_data/);
  assert.match(listedText, /get_anp_fuel_prices/);
  assert.match(listedText, /get_epe_electricity_consumption/);
  assert.match(listedText, /get_mte_formal_employment_schema/);
  assert.match(listedText, /get_mte_formal_employment/);
  assert.match(listedText, /get_cvm_investment_funds_schema/);
  assert.match(listedText, /get_cvm_investment_funds/);
  assert.match(listedText, /get_tesouro_rtn_schema/);
  assert.match(listedText, /get_tesouro_rtn/);
  assert.match(listedText, /get_tesouro_dpf_schema/);
  assert.match(listedText, /get_tesouro_dpf/);
  assert.equal((listedText.match(/"name":/g) ?? []).length, 19);

  const called = await request("/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search_official_data", arguments: { query: "taxa de desemprego desde 2015", limit: 3 } } }),
  });
  assert.equal(called.status, 200);
  const calledText = await called.text();
  assert.match(calledText, /Resolved to unemployment/);
  assert.match(calledText, /br-unemployment-rate/);

  const debtCalled = await request("/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_tesouro_dpf", arguments: { dataset_id: "tesouro-dpf:debt-profile", table: "composition", from: "2026-07", to: "2026-07", categories: ["total"], limit: 10 } } }),
  });
  assert.equal(debtCalled.status, 200);
  const debtCalledText = await debtCalled.text();
  assert.match(debtCalledText, /9288\.7802713778/);
  assert.match(debtCalledText, /Relatório Mensal da Dívida Pública Federal/);
  assert.match(debtCalledText, /publicacao-anexo\/29025/);
});

test("requests only the IBGE periods needed and retains source-specific data status", { concurrency: false }, async () => {
  let upstreamUrl = "";
  let upstreamInit;
  await withFetchMock(async (input, init) => {
    upstreamUrl = String(input);
    upstreamInit = init;
    return new Response(JSON.stringify([{
      id: "63",
      resultados: [{ series: [{ serie: { "202401": "0,42", "202402": "-", "202403": "X" } }] }],
    }]), { headers: { "content-type": "application/json" } });
  }, async () => {
    const response = await request("/api/v1/indicators/br-ipca-monthly/observations?start=2024-01-01&end=2024-03-31");
    assert.equal(response.status, 200);
    const body = await response.json();

    assert.deepEqual(body.data.map((item) => item.period), ["2024-01", "2024-02", "2024-03"]);
    assert.equal(body.data[0].value, 0.42);
    assert.equal(body.data[1].status, "absolute-zero");
    assert.equal(body.data[2].value, null);
    assert.equal(body.data[2].status, "suppressed");
    assert.match(body.meta.provenance.upstream_url, /periodos\/202401\|202402\|202403\/variaveis\/63/);
  });
  assert.match(upstreamUrl, /periodos\/202401\|202402\|202403\/variaveis\/63/);
  assert.equal(upstreamInit.cache, "no-store");
  assert.equal("cf" in upstreamInit, false);
});

test("returns stable RFC problem details for malformed paths, future dates, and upstream connection failures", { concurrency: false }, async () => {
  const malformed = await request("/api/v1/indicators/%ZZ");
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, "INVALID_INDICATOR_ID");

  const future = await request("/api/v1/indicators/br-ipca-monthly/observations?end=2999-01-01");
  assert.equal(future.status, 400);
  assert.equal((await future.json()).code, "DATE_IN_FUTURE");

  await withFetchMock(async () => { throw new TypeError("network down"); }, async () => {
    const response = await request("/api/v1/indicators/br-ipca-monthly/observations?start=2024-01-01&end=2024-01-31");
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.code, "UPSTREAM_CONNECTION_ERROR");
    assert.match(response.headers.get("content-type") ?? "", /^application\/problem\+json/);
  });

  await withFetchMock(async () => {
    const abort = new Error("upstream timeout");
    abort.name = "AbortError";
    throw abort;
  }, async () => {
    const response = await request("/api/v1/indicators/br-ipca-monthly/observations?start=2024-01-01&end=2024-01-31");
    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, "UPSTREAM_TIMEOUT");
  });

  const head = await request("/api/v1/indicators/br-ipca-monthly/observations?invalid=yes", { method: "HEAD" });
  assert.equal(head.status, 400);
  assert.equal(await head.text(), "");
});

test("treats cache failures as a cache bypass instead of a data failure", { concurrency: false }, async () => {
  const unavailableCache = {
    batch: async () => { throw new Error("D1 unavailable"); },
    prepare: () => { throw new Error("D1 unavailable"); },
  };
  await withFetchMock(async () => new Response(JSON.stringify([
    { data: "01/01/2024", valor: "11.75" },
  ]), { headers: { "content-type": "application/json" } }), async () => {
    const response = await request(
      "/api/v1/indicators/br-selic-target/observations?start=2024-01-01&end=2024-01-01",
      {},
      { ...env(), DB: unavailableCache },
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).meta.cache, "miss");
  });
});

test("retries transient BCB failures before returning an upstream error", { concurrency: false }, async () => {
  let attempts = 0;
  await withFetchMock(async () => {
    attempts += 1;
    if (attempts === 1) return new Response("temporary", { status: 503 });
    return new Response(JSON.stringify([{ data: "01/01/2024", valor: "11.75" }]));
  }, async () => {
    const response = await request(
      "/api/v1/indicators/br-selic-target/observations?start=2024-01-01&end=2024-01-01",
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data[0].value, 11.75);
  });
  assert.equal(attempts, 2);
});

test("latest endpoints reuse a stable stale snapshot when BCB is unavailable", { concurrency: false }, async () => {
  const { runtimeEnv, snapshots } = envWithSnapshots();
  await withFetchMock(async () => new Response(JSON.stringify([
    { data: "31/08/2026", valor: "11.75" },
  ])), async () => {
    const response = await request("/api/v1/indicators/br-selic-target/latest", {}, runtimeEnv);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.meta.cache, "miss");
    assert.match(body.meta.provenance.upstream_url, /\/dados\/ultimos\/20\?formato=json/);
  });

  const snapshot = snapshots.get("v2:br-selic-target:latest");
  assert.ok(snapshot);
  snapshot.expires_at = Date.now() - 1;

  await withFetchMock(async () => { throw new TypeError("network down"); }, async () => {
    const response = await request("/api/v1/indicators/br-selic-target/latest", {}, runtimeEnv);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("warning"), '110 - "Response is stale; official source refresh failed"');
    const body = await response.json();
    assert.equal(body.meta.cache, "stale");
    assert.equal(body.meta.stale, true);
    assert.equal(body.data[0].value, 11.75);
  });
});

test("promoted Selic latest endpoints retain an official bundled fallback", { concurrency: false }, async () => {
  await withFetchMock(async () => { throw new TypeError("worker egress blocked"); }, async () => {
    const target = await request("/api/v1/indicators/br-selic-target/latest");
    assert.equal(target.status, 200);
    assert.equal(target.headers.get("warning"), '110 - "Response is stale; official source refresh failed"');
    const targetBody = await target.json();
    assert.equal(targetBody.meta.stale, true);
    assert.equal(targetBody.data[0].date, "2026-08-31");
    assert.equal(targetBody.data[0].value, 14);

    const effective = await request("/api/v1/indicators/br-selic-effective/latest");
    assert.equal(effective.status, 200);
    const effectiveBody = await effective.json();
    assert.equal(effectiveBody.meta.stale, true);
    assert.equal(effectiveBody.data[0].date, "2026-08-28");
    assert.equal(effectiveBody.data[0].value, 13.9);
  });
});

test("the evidenced BCB plus IBGE acquisition path retains official bundled series", { concurrency: false }, async () => {
  await withFetchMock(async () => { throw new TypeError("worker egress blocked"); }, async () => {
    const ibc = await request(
      "/api/v1/indicators/br-ibc-br/observations?start=2025-01-01&end=2026-08-31&order=asc&limit=100",
    );
    assert.equal(ibc.status, 200);
    assert.equal(ibc.headers.get("warning"), '110 - "Response is stale; official source refresh failed"');
    const ibcBody = await ibc.json();
    assert.equal(ibcBody.meta.stale, true);
    assert.equal(ibcBody.meta.indicator.upstream.seriesCode, 24363);
    assert.ok(ibcBody.data.length > 12);
    assert.equal(ibcBody.data.at(-1).date, "2026-06-01");
    assert.equal(ibcBody.data.at(-1).value, 109.89427);

    const gdp = await request(
      "/api/v1/indicators/br-gdp-real-yoy/observations?start=2025-01-01&end=2026-08-31&order=asc&limit=100",
    );
    assert.equal(gdp.status, 200);
    assert.equal(gdp.headers.get("warning"), '110 - "Response is stale; official source refresh failed"');
    const gdpBody = await gdp.json();
    assert.equal(gdpBody.meta.stale, true);
    assert.equal(gdpBody.meta.indicator.upstream.aggregate, 5932);
    assert.equal(gdpBody.meta.indicator.upstream.variable, 6561);
    assert.equal(gdpBody.data.at(-1).period, "2026-Q1");
    assert.equal(gdpBody.data.at(-1).value, 1.8);
  });
});
