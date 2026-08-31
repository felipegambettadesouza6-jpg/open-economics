import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=300/i);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");

  const html = await response.text();
  assert.match(html, /Open Economics/i);
  assert.match(html, /Official data,/i);
  assert.match(html, /made to/i);
  assert.match(html, /Explore data/i);
  assert.match(html, /Search indicators/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|react-loading-skeleton|codex-preview/i);

  const portugueseResponse = await request("/pt-br");
  assert.equal(portugueseResponse.status, 200);
  const portugueseHtml = await portugueseResponse.text();
  assert.match(portugueseHtml, /lang="pt-BR"/i);
  assert.match(portugueseHtml, /Dados oficiais,/i);
  assert.match(portugueseHtml, /Explorar dados/i);
});

test("server-renders the major localized product experiences", async () => {
  const routes = [
    ["/en/catalog", /Economic data catalog/i],
    ["/en/indicators/br-ipca-12m", /IPCA — 12-month change/i],
    ["/en/playground", /Build it\. Run it\. Understand it\./i],
    ["/en/docs", /Clear contracts\. Readable data\./i],
    ["/en/guides", /Brazilian economic data, from endpoint to answer\./i],
    ["/en/guides/spreadsheets", /Brazil IPCA, Selic, and CDI in your spreadsheet/i],
    ["/pt-br/guides/spreadsheets", /IPCA, Selic e CDI na sua planilha/i],
    ["/pt-br/guides/selic-api", /A série Selic certa/i],
    ["/pt-br/guides/ipca-api", /IPCA mensal ou em 12 meses/i],
    ["/pt-br/guides/cdi-api", /CDI mensal oficial/i],
    ["/en/sources", /Know where every value came from\./i],
    ["/en/status", /Failure is data, too\./i],
    ["/pt-br/docs", /Contratos claros\. Dados legíveis\./i],
  ];

  for (const [path, pattern] of routes) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), pattern, path);
  }
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

test("ships a no-auth Postman collection for developer directories", async () => {
  const collection = JSON.parse(await readFile(new URL("../public/open-economics.postman_collection.json", import.meta.url), "utf8"));
  assert.equal(collection.auth.type, "noauth");
  assert.equal(collection.variable[0].key, "baseUrl");
  assert.ok(collection.item.some((item) => item.name === "Latest Selic target"));
  assert.ok(collection.item.some((item) => item.name === "Monthly CDI history"));
  assert.ok(collection.item.some((item) => item.name === "Download IPCA history as CSV"));
});

test("publishes crawl directives, a bilingual sitemap, structured data, and privacy-safe telemetry ingestion", async () => {
  const [robotsResponse, sitemapResponse, indicatorResponse] = await Promise.all([
    request("/robots.txt"),
    request("/sitemap.xml"),
    request("/pt-br/indicators/br-ipca-monthly"),
  ]);
  assert.equal(robotsResponse.status, 200);
  assert.match(await robotsResponse.text(), /Sitemap: https:\/\/open-economics-data\..+\/sitemap\.xml/i);
  assert.equal(sitemapResponse.status, 200);
  const sitemap = await sitemapResponse.text();
  assert.match(sitemap, /hreflang="pt-BR"/i);
  assert.match(sitemap, /\/en\/indicators\/br-ipca-monthly/i);
  assert.match(sitemap, /\/en\/guides/i);
  assert.match(sitemap, /\/pt-br\/guides\/spreadsheets/i);
  assert.match(sitemap, /\/pt-br\/guides\/selic-api/i);
  assert.match(sitemap, /\/pt-br\/guides\/ipca-api/i);
  assert.match(sitemap, /\/pt-br\/guides\/cdi-api/i);
  assert.match(await indicatorResponse.text(), /"@type":"Dataset"/i);

  const runtime = await worker();
  const telemetryResponse = await runtime.fetch(
    new Request("http://localhost:3000/_events", {
      method: "POST",
      headers: { "content-type": "text/plain", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" },
      body: JSON.stringify({ event: "page_view", path: "/en", session: crypto.randomUUID() }),
    }),
    env(),
    ctx,
  );
  assert.equal(telemetryResponse.status, 204);
});
