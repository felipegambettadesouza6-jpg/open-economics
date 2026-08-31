import assert from "node:assert/strict";
import test from "node:test";

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

function env() {
  return {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
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

test("exposes the official monthly CDI series with stable semantics", { concurrency: false }, async () => {
  const response = await request("/api/v1/indicators/br-cdi-monthly");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.id, "br-cdi-monthly");
  assert.equal(body.data.frequency, "monthly");
  assert.equal(body.data.unit_symbol, "% p.m.");
  assert.equal(body.data.upstream.seriesCode, 4391);
});

test("normalizes BCB daily observations, preserves raw provenance, and sorts upstream rows", { concurrency: false }, async () => {
  let upstreamUrl = "";
  await withFetchMock(async (input) => {
    upstreamUrl = String(input);
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
});

test("requests only the IBGE periods needed and retains source-specific data status", { concurrency: false }, async () => {
  let upstreamUrl = "";
  await withFetchMock(async (input) => {
    upstreamUrl = String(input);
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
