import { readFile, writeFile } from "node:fs/promises";

const concepts = JSON.parse(await readFile(new URL("../benchmarks/generated/demand-concepts.json", import.meta.url), "utf8"));
const report = JSON.parse(await readFile(new URL("../benchmarks/generated/v2-semantic-baseline.json", import.meta.url), "utf8"));
const tasks = (await readFile(new URL("../benchmarks/generated/real-demand-v1.jsonl", import.meta.url), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
const failures = new Set(report.failures.map((failure) => failure.id));
const genericallyIntegratedSources = new Set(["BCB", "IBGE"]);
const integratedConcepts = new Set([
  "subnational-revenue", "subnational-expenditure", "subnational-debt", "personnel-spending", "health-education-spending", "intergovernmental-transfers",
  "central-government-balance", "federal-revenue", "federal-expenditure", "social-security-balance",
  "trade-balance", "exports", "imports", "fuel-prices", "electricity-consumption", "formal-job-flow", "formal-job-stock", "investment-funds", "federal-debt-profile",
]);

const priorities = concepts.map((concept) => {
  const relevant = tasks.filter((task) => task.gold.concepts.includes(concept.id));
  const failed = relevant.filter((task) => failures.has(task.id));
  const sourceRouteAvailable = concept.sources.some((source) => genericallyIntegratedSources.has(source)) || integratedConcepts.has(concept.id);
  const failureWeight = failed.reduce((sum, task) => sum + task.weight, 0);
  const priorityScore = concept.weight * 3 + failureWeight * 2 + (sourceRouteAvailable ? 0 : concept.weight * 4);
  return {
    concept_id: concept.id,
    domain: concept.domain,
    demand_weight: concept.weight,
    benchmark_tasks: relevant.length,
    failed_tasks: failed.length,
    failure_weight: failureWeight,
    acceptable_official_sources: concept.sources,
    next_constraint: !sourceRouteAvailable ? "source-integration" : failed.length ? "semantic-resolution" : "dataset-validation",
    priority_score: priorityScore,
  };
}).sort((left, right) => right.priority_score - left.priority_score || right.demand_weight - left.demand_weight || left.concept_id.localeCompare(right.concept_id));

const output = {
  generated_from: ["open-economics-real-demand-v1", "open-economics-v2-semantic-router"],
  ordering_rule: "Demand weight and benchmark failures rank concepts; institutions are attached only after the need is selected.",
  priorities,
};
await writeFile(new URL("../benchmarks/generated/coverage-priorities.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ top_priorities: priorities.slice(0, 20) }, null, 2));
