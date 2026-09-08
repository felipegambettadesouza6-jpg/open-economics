import { readFile, writeFile } from "node:fs/promises";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("benchmark", `${Date.now()}`);
const worker = (await import(workerUrl.href)).default;
const allTasks = (await readFile(new URL("../benchmarks/generated/real-demand-v1.jsonl", import.meta.url), "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const tasks = process.argv.includes("--holdout") ? allTasks.filter((task) => task.workflow === "discovery-holdout") : allTasks;

const env = { ASSETS: { fetch: async () => new Response("not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const genericallyIntegratedSources = new Set(["BCB", "IBGE"]);
const integratedConcepts = new Set([
  "subnational-revenue", "subnational-expenditure", "subnational-debt", "personnel-spending", "health-education-spending", "intergovernmental-transfers",
  "central-government-balance", "federal-revenue", "federal-expenditure", "social-security-balance",
  "trade-balance", "exports", "imports", "fuel-prices", "electricity-consumption", "formal-job-flow", "formal-job-stock", "investment-funds", "federal-debt-profile",
]);
const rows = [];

for (const task of tasks) {
  const url = new URL("http://benchmark.local/api/v2/search");
  url.searchParams.set("q", task.request);
  url.searchParams.set("limit", "5");
  const originalLog = console.log;
  console.log = () => {};
  const response = await worker.fetch(new Request(url), env, ctx);
  console.log = originalLog;
  if (!response.ok) throw new Error(`Search failed for ${task.id}: ${response.status} ${await response.text()}`);
  const body = await response.json();
  const returnedConcepts = body.data.concepts.map((concept) => concept.id);
  const expected = task.gold.concepts;
  const sourceIntegrated = task.gold.acceptable_official_sources.some((source) => genericallyIntegratedSources.has(source))
    || expected.every((concept) => integratedConcepts.has(concept));
  rows.push({
    id: task.id,
    workflow: task.workflow,
    domain: task.domain,
    weight: task.weight,
    expected,
    returned: returnedConcepts,
    resolution: body.data.resolution.status,
    availability: body.data.availability.status,
    top1: expected.includes(returnedConcepts[0]),
    top3: expected.some((concept) => returnedConcepts.slice(0, 3).includes(concept)),
    sourceIntegrated,
    queryReady: sourceIntegrated && expected.includes(returnedConcepts[0]) && ["stable-series-ready", "official-dataset-ready"].includes(body.data.availability.status),
    safeUnsupported: sourceIntegrated || ["source-not-integrated", "unresolved"].includes(body.data.availability.status),
  });
}

function rate(items, field) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return total ? items.reduce((sum, item) => sum + (item[field] ? item.weight : 0), 0) / total : 0;
}

const holdout = rows.filter((row) => row.workflow === "discovery-holdout");
const unsupported = rows.filter((row) => !row.sourceIntegrated);
const queryReady = rows.filter((row) => row.queryReady && row.top1);
const unserved = rows.filter((row) => !row.queryReady);
const allConcepts = [...new Set(rows.flatMap((row) => row.expected))];
const queryReadyConcepts = allConcepts.filter((concept) => {
  const relevant = rows.filter((row) => row.expected.includes(concept));
  return relevant.length > 0 && relevant.every((row) => row.queryReady);
});
const domains = Object.fromEntries([...new Set(rows.map((row) => row.domain))].sort().map((domain) => {
  const subset = rows.filter((row) => row.domain === domain);
  return [domain, { tasks: subset.length, query_ready: rate(subset, "queryReady"), top1: rate(subset, "top1"), top3: rate(subset, "top3") }];
}));

const report = {
  benchmark: "open-economics-real-demand-v1",
  system: "open-economics-v2-semantic-router",
  tasks: rows.length,
  query_ready_demand: {
    tasks: queryReady.length,
    unweighted_rate: queryReady.length / rows.length,
    demand_weighted_rate: rate(rows, "queryReady"),
    concepts: queryReadyConcepts.length,
    total_concepts: allConcepts.length,
  },
  overall: { top1: rate(rows, "top1"), top3: rate(rows, "top3") },
  discovery_holdout: { tasks: holdout.length, top1: rate(holdout, "top1"), top3: rate(holdout, "top3") },
  unsupported_sources: {
    tasks: unsupported.length,
    unweighted_rate: unsupported.length / rows.length,
    demand_weighted_rate: 1 - rate(rows, "sourceIntegrated"),
    safe_non_substitution: rate(unsupported, "safeUnsupported"),
  },
  unserved_demand: {
    tasks: unserved.length,
    unweighted_rate: unserved.length / rows.length,
    demand_weighted_rate: 1 - rate(rows, "queryReady"),
  },
  resolution_counts: Object.fromEntries(["resolved", "ambiguous", "unresolved"].map((status) => [status, rows.filter((row) => row.resolution === status).length])),
  availability_counts: Object.fromEntries([...new Set(rows.map((row) => row.availability))].sort().map((status) => [status, rows.filter((row) => row.availability === status).length])),
  domains,
  failures: rows.filter((row) => !row.top3).map(({ id, expected, returned, resolution, availability }) => ({ id, expected, returned, resolution, availability })),
};

const outputName = process.argv.includes("--holdout") ? "v2-semantic-holdout.json" : "v2-semantic-baseline.json";
await writeFile(new URL(`../benchmarks/generated/${outputName}`, import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, failures: report.failures.length }, null, 2));
