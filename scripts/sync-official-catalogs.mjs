import { mkdir, writeFile } from "node:fs/promises";

const USER_AGENT = "Open-Economics/2.0 catalog-sync (+https://github.com/felipegambettadesouza6-jpg/open-economics)";

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function plainText(value = "") {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchBcbSgsCatalog() {
  const pageSize = 1000;
  const packages = [];
  let total = Number.POSITIVE_INFINITY;
  for (let start = 0; start < total; start += pageSize) {
    const payload = await getJson(`https://dadosabertos.bcb.gov.br/api/3/action/package_search?rows=${pageSize}&start=${start}`);
    if (!payload.success) throw new Error("BCB CKAN package search was not successful.");
    total = payload.result.count;
    packages.push(...payload.result.results);
  }

  const byCode = new Map();
  for (const item of packages) {
    const resource = item.resources?.find((candidate) => /bcdata\.sgs\.\d+\/dados/i.test(candidate.url ?? ""));
    const match = /bcdata\.sgs\.(\d+)\/dados/i.exec(resource?.url ?? "");
    if (!match) continue;
    const code = match[1];
    byCode.set(code, [code, plainText(item.title), item.name]);
  }
  return [...byCode.values()].sort((left, right) => Number(left[0]) - Number(right[0]));
}

async function fetchIbgeCatalog() {
  const surveys = await getJson("https://servicodados.ibge.gov.br/api/v3/agregados");
  const datasets = [];
  for (const survey of surveys) {
    for (const aggregate of survey.agregados ?? []) {
      datasets.push([String(aggregate.id), plainText(aggregate.nome), String(survey.id)]);
    }
  }
  return {
    datasets: datasets.sort((left, right) => Number(left[0]) - Number(right[0])),
    surveys: Object.fromEntries(surveys.map((survey) => [String(survey.id), plainText(survey.nome)])),
  };
}

const [bcb, ibge] = await Promise.all([fetchBcbSgsCatalog(), fetchIbgeCatalog()]);
const output = {
  schema_version: 1,
  synced_at: new Date().toISOString(),
  provenance: {
    bcb: "https://dadosabertos.bcb.gov.br/api/3/action/package_search",
    ibge: "https://servicodados.ibge.gov.br/api/v3/agregados",
  },
  counts: { bcb_sgs: bcb.length, ibge_aggregates: ibge.datasets.length, total: bcb.length + ibge.datasets.length },
  ibge_surveys: ibge.surveys,
  // Compact tuple schemas keep the committed source snapshot small:
  // bcb_sgs = [series code, title, CKAN slug]
  // ibge_aggregates = [aggregate id, title, survey id]
  bcb_sgs: bcb,
  ibge_aggregates: ibge.datasets,
};

const directory = new URL("../lib/catalog/generated/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("official-datasets.generated.json", directory), `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({ synced_at: output.synced_at, ...output.counts }, null, 2));
