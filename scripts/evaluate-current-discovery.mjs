import { readFile, writeFile } from "node:fs/promises";

const currentV1ConceptMap = JSON.parse(await readFile(new URL("../benchmarks/current-v1-concept-map.json", import.meta.url), "utf8"));

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("benchmark", `${process.pid}-${Date.now()}`);
const worker = (await import(workerUrl.href)).default;
const response = await worker.fetch(
  new Request("http://benchmark.local/api/v1/indicators?limit=500"),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);
if (!response.ok) throw new Error(`Unable to load local catalog: ${response.status}`);
const catalog = (await response.json()).data;
await writeFile(new URL("../benchmarks/generated/current-v1-catalog.json", import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);

const benchmarkText = await readFile(new URL("../benchmarks/generated/real-demand-v1.jsonl", import.meta.url), "utf8");
const tasks = benchmarkText.trim().split("\n").map((line) => JSON.parse(line));

const STOPWORDS = new Set([
  "a", "ao", "as", "com", "como", "da", "das", "de", "desde", "do", "dos", "e", "em", "entre", "foi", "mais", "me", "no", "nos", "o", "os", "ou", "para", "pela", "pelas", "pelo", "pelos", "por", "qual", "quando", "que", "se", "sem", "uma", "um", "ultimo", "ultimos",
  "a", "and", "as", "at", "by", "for", "from", "give", "has", "have", "how", "in", "is", "it", "last", "me", "of", "official", "over", "show", "since", "than", "that", "the", "this", "to", "versus", "what", "when", "which", "with", "year", "years",
]);

function normalize(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value) {
  return normalize(value).split(/\s+/).filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function trigrams(value) {
  const padded = `  ${normalize(value)}  `;
  const result = new Set();
  for (let index = 0; index < padded.length - 2; index += 1) result.add(padded.slice(index, index + 3));
  return result;
}

function dice(left, right) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return (2 * overlap) / (left.size + right.size);
}

function fields(item) {
  return {
    primary: normalize([item.id, item.name, item.official_name, ...item.aliases].join(" ")),
    secondary: normalize([item.description, item.category, item.category_name, item.source_agency].join(" ")),
  };
}

function literalSearch(query) {
  const needle = normalize(query);
  return catalog
    .filter((item) => normalize([item.id, item.name, item.official_name, item.description, item.category_name, ...item.aliases].join(" ")).includes(needle))
    .map((item) => ({ item, score: 1 }));
}

function lexicalSearch(query, useTrigrams = false) {
  const queryTokens = tokens(query);
  const queryTrigrams = trigrams(query);
  return catalog
    .map((item) => {
      const { primary, secondary } = fields(item);
      let score = 0;
      for (const token of queryTokens) {
        if (primary.split(" ").includes(token)) score += 8;
        else if (primary.includes(token)) score += 5;
        else if (secondary.split(" ").includes(token)) score += 3;
        else if (secondary.includes(token)) score += 1;
      }
      if (primary.includes(normalize(query))) score += 20;
      if (useTrigrams) score += 12 * dice(queryTrigrams, trigrams(primary));
      return { item, score };
    })
    .filter((candidate) => candidate.score >= (useTrigrams ? 10 : 8))
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));
}

function covers(candidate, goldConcepts) {
  const concepts = currentV1ConceptMap[candidate.item.id] ?? [];
  return goldConcepts.every((concept) => concepts.includes(concept));
}

function evaluate(search) {
  const rows = tasks.map((task) => {
    const results = search(task.request);
    const isCovered = task.gold.concepts.every((concept) => Object.values(currentV1ConceptMap).some((mapped) => mapped.includes(concept)));
    return {
      weight: task.weight,
      covered: isCovered,
      returned: results.length > 0,
      top1: isCovered && results[0] ? covers(results[0], task.gold.concepts) : false,
      top3: isCovered && results.slice(0, 3).some((candidate) => covers(candidate, task.gold.concepts)),
      safeMiss: !isCovered && results.length === 0,
    };
  });
  const weighted = (predicate, subset = rows) => {
    const denominator = subset.reduce((sum, row) => sum + row.weight, 0);
    return denominator ? subset.reduce((sum, row) => sum + (predicate(row) ? row.weight : 0), 0) / denominator : 0;
  };
  const covered = rows.filter((row) => row.covered);
  const unsupported = rows.filter((row) => !row.covered);
  return {
    covered_tasks: covered.length,
    unsupported_tasks: unsupported.length,
    top1_on_covered: weighted((row) => row.top1, covered),
    top3_on_covered: weighted((row) => row.top3, covered),
    safe_miss_on_unsupported: weighted((row) => row.safeMiss, unsupported),
    overall_top1: weighted((row) => row.top1),
  };
}

const conceptWeights = new Map();
for (const task of tasks) {
  for (const concept of task.gold.concepts) conceptWeights.set(concept, Math.max(conceptWeights.get(concept) ?? 0, task.weight));
}
const totalConceptWeight = [...conceptWeights.values()].reduce((sum, weight) => sum + weight, 0);
const coveredConceptWeight = [...conceptWeights.entries()]
  .filter(([concept]) => Object.values(currentV1ConceptMap).some((mapped) => mapped.includes(concept)))
  .reduce((sum, [, weight]) => sum + weight, 0);

const report = {
  benchmark: "open-economics-real-demand-v1",
  current_catalog_indicators: catalog.length,
  independent_demand_concepts: conceptWeights.size,
  mapped_current_concepts: [...conceptWeights.keys()].filter((concept) => Object.values(currentV1ConceptMap).some((mapped) => mapped.includes(concept))).length,
  weighted_concept_coverage: coveredConceptWeight / totalConceptWeight,
  engines: {
    current_literal_substring: evaluate(literalSearch),
    token_weighted: evaluate((query) => lexicalSearch(query, false)),
    token_plus_character_trigrams: evaluate((query) => lexicalSearch(query, true)),
  },
};

await writeFile(new URL("../benchmarks/generated/current-v1-baseline.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
