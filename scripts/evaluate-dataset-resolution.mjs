import { mkdir, writeFile } from "node:fs/promises";
import { datasetResolutionGold } from "../benchmarks/dataset-resolution-gold.mjs";

const baseUrl = process.env.OPEN_ECONOMICS_URL ?? "http://localhost:3000";
const failures = [];
let conceptTop1 = 0;
let datasetTop1 = 0;
let datasetTop3 = 0;

for (const item of datasetResolutionGold) {
  const url = `${baseUrl}/api/v2/search?q=${encodeURIComponent(item.query)}&limit=5`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  const result = (await response.json()).data;
  const concepts = result.concepts.map((concept) => concept.id);
  const datasets = result.datasets.map((dataset) => dataset.id);
  const conceptPass = concepts[0] === item.concept;
  const top1Pass = item.acceptable.includes(datasets[0]);
  const top3Pass = datasets.slice(0, 3).some((id) => item.acceptable.includes(id));
  conceptTop1 += Number(conceptPass);
  datasetTop1 += Number(top1Pass);
  datasetTop3 += Number(top3Pass);
  if (!conceptPass || !top1Pass) failures.push({ ...item, returnedConcepts: concepts.slice(0, 3), returnedDatasets: datasets.slice(0, 3) });
}

const total = datasetResolutionGold.length;
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  total,
  conceptTop1: conceptTop1 / total,
  datasetTop1: datasetTop1 / total,
  datasetTop3: datasetTop3 / total,
  failures,
};
await mkdir(new URL("../benchmarks/generated/", import.meta.url), { recursive: true });
await writeFile(new URL("../benchmarks/generated/dataset-resolution.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
