import assert from "node:assert/strict";
import test from "node:test";

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

function env() {
  return {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
}

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
};

async function request(path) {
  const runtime = await worker();
  return runtime.fetch(
    new Request(`http://localhost:3000${path}`, { headers: { accept: "text/html,application/json" } }),
    env(),
    ctx,
  );
}

test("redirects legacy links and server-renders the bilingual Open Economics homepage", async () => {
  const redirectResponse = await request("/");
  assert.equal(redirectResponse.status, 307);
  assert.equal(redirectResponse.headers.get("location"), "/en");

  const response = await request("/en");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Open Economics/i);
  assert.match(html, /Brazil’s economy, made readable/i);
  assert.match(html, /Explore data/i);
  assert.match(html, /Search the economic atlas/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|react-loading-skeleton|codex-preview/i);
});

test("exposes a searchable catalog through the public API", async () => {
  const response = await request("/api/v1/indicators?q=selic");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");

  const body = await response.json();
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.some((item) => item.id === "br-selic-target"));
  assert.ok(body.data.every((item) => item.source_agency === "BCB" || item.source_agency === "IBGE"));
});

test("returns strict problem details for invalid API queries", async () => {
  const response = await request("/api/v1/indicators/br-ipca-monthly/observations?not_a_parameter=yes");
  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type") ?? "", /^application\/problem\+json/i);

  const body = await response.json();
  assert.equal(body.code, "UNKNOWN_QUERY_PARAMETER");
  assert.equal(body.status, 400);
  assert.ok(body.request_id);
});

test("publishes a valid OpenAPI document and health report", async () => {
  const [openapiResponse, healthResponse] = await Promise.all([
    request("/api/v1/openapi.json"),
    request("/api/v1/health"),
  ]);
  assert.equal(openapiResponse.status, 200);
  assert.equal(healthResponse.status, 200);

  const openapi = await openapiResponse.json();
  const health = await healthResponse.json();
  assert.equal(openapi.openapi, "3.1.0");
  assert.ok(openapi.paths["/indicators/{id}/observations"]);
  assert.equal(health.status, "ok");
  assert.ok(health.catalog.indicators >= 25);
});
