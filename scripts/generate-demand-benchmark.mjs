import { mkdir, writeFile } from "node:fs/promises";
import { complexCases, concepts } from "../benchmarks/demand-concepts.mjs";
import { discoveryHoldout } from "../benchmarks/discovery-holdout.mjs";

const workflows = ["latest", "history", "change", "breakdown", "methodology", "freshness"];
const personas = ["citizen", "developer", "economist", "journalist", "business", "policymaker"];

function regional(concept) {
  return concept.dimensions.some((item) => ["geography", "state", "municipality", "government entity"].includes(item));
}

function requestFor(concept, workflow, language) {
  const label = language === "pt-BR" ? concept.pt : concept.en;
  const pt = {
    latest: `Qual é o dado mais recente de ${label}?`,
    history: `Quero a série histórica de ${label} desde 2015.`,
    change: `Quanto ${label} mudou no último ano e em relação ao mesmo período do ano anterior?`,
    breakdown: regional(concept)
      ? `Detalhe ${label} pelos recortes geográficos e econômicos oficiais disponíveis.`
      : `Compare ${label} no período atual com os cinco anos anteriores.`,
    methodology: `O que exatamente mede ${label}, em qual unidade e com qual metodologia oficial?`,
    freshness: `Qual é o período de referência mais recente de ${label}, quando foi publicado e quando deve sair a próxima atualização?`,
  };
  const en = {
    latest: `What is the latest official value for ${label}?`,
    history: `Give me the history of ${label} since 2015.`,
    change: `How did ${label} change over the last year and versus the same period a year earlier?`,
    breakdown: regional(concept)
      ? `Break down ${label} using the available official geographic and economic dimensions.`
      : `Compare the current ${label} with the previous five years.`,
    methodology: `What exactly does ${label} measure, in which unit, and under which official methodology?`,
    freshness: `What is the latest reference period for ${label}, when was it released, and when is the next update expected?`,
  };
  return (language === "pt-BR" ? pt : en)[workflow];
}

const tasks = [];
for (const [conceptIndex, item] of concepts.entries()) {
  for (const [workflowIndex, workflow] of workflows.entries()) {
    const language = (conceptIndex + workflowIndex) % 5 < 3 ? "pt-BR" : "en";
    tasks.push({
      id: `demand-${String(tasks.length + 1).padStart(4, "0")}`,
      demand_case_id: `${item.id}:${workflow}`,
      request: requestFor(item, workflow, language),
      language,
      persona: personas[(conceptIndex + workflowIndex) % personas.length],
      domain: item.domain,
      workflow,
      weight: item.weight,
      gold: {
        concepts: [item.id],
        acceptable_official_sources: item.sources,
        expected_frequency: item.frequency,
        required_dimensions: workflow === "breakdown" ? item.dimensions : [],
        must_preserve: ["unit", "reference period", "source identifier", "source URL", "retrieval time", "methodology context"],
        allow_unsupported: false,
      },
    });
  }
}

for (const [id, en, pt, caseConcepts, workflow, weight] of complexCases) {
  const conceptRecords = caseConcepts.map((conceptId) => concepts.find((item) => item.id === conceptId));
  if (conceptRecords.some((item) => !item)) throw new Error(`Unknown concept in complex case ${id}.`);
  const sources = [...new Set(conceptRecords.flatMap((item) => item.sources))];
  const dimensions = [...new Set(conceptRecords.flatMap((item) => item.dimensions))];
  const language = tasks.length % 2 === 0 ? "pt-BR" : "en";
  tasks.push({
    id: `demand-${String(tasks.length + 1).padStart(4, "0")}`,
    demand_case_id: id,
    request: language === "pt-BR" ? pt : en,
    alternate_request: language === "pt-BR" ? en : pt,
    language,
    persona: personas[tasks.length % personas.length],
    domain: conceptRecords[0].domain,
    workflow,
    weight,
    gold: {
      concepts: caseConcepts,
      acceptable_official_sources: sources,
      expected_frequency: [...new Set(conceptRecords.map((item) => item.frequency))].join(" + "),
      required_dimensions: dimensions,
      must_preserve: ["unit", "reference period", "source identifier", "source URL", "retrieval time", "methodology context"],
      allow_unsupported: workflow.startsWith("boundary-"),
    },
  });
}

for (const [conceptIndex, item] of concepts.entries()) {
  const request = discoveryHoldout[item.id];
  if (!request) throw new Error(`Missing discovery holdout for ${item.id}.`);
  const language = /\b(the|how|what|which|is|are|did|through|into|from|each|than|before|being)\b/i.test(request) ? "en" : "pt-BR";
  tasks.push({
    id: `demand-${String(tasks.length + 1).padStart(4, "0")}`,
    demand_case_id: `${item.id}:discovery-holdout`,
    request,
    language,
    persona: personas[(conceptIndex + 2) % personas.length],
    domain: item.domain,
    workflow: "discovery-holdout",
    weight: item.weight,
    gold: {
      concepts: [item.id],
      acceptable_official_sources: item.sources,
      expected_frequency: item.frequency,
      required_dimensions: item.dimensions,
      must_preserve: ["unit", "reference period", "source identifier", "source URL", "retrieval time", "methodology context"],
      allow_unsupported: false,
    },
  });
}

if (Object.keys(discoveryHoldout).length !== concepts.length) throw new Error("Discovery holdout must have exactly one prompt per concept.");
if (tasks.length !== 696) throw new Error(`Expected 696 tasks, generated ${tasks.length}.`);
if (new Set(tasks.map((item) => item.id)).size !== tasks.length) throw new Error("Duplicate benchmark task IDs.");
if (new Set(tasks.map((item) => item.request)).size !== tasks.length) throw new Error("Duplicate benchmark requests.");

const domainCounts = Object.fromEntries(
  [...new Set(tasks.map((item) => item.domain))]
    .sort()
    .map((domain) => [domain, tasks.filter((item) => item.domain === domain).length]),
);

const summary = {
  benchmark: "open-economics-real-demand-v1",
  schema_version: "2026-09-03",
  tasks: tasks.length,
  independent_concepts: concepts.length,
  complex_cases: complexCases.length,
  discovery_holdouts: concepts.length,
  languages: Object.fromEntries(["pt-BR", "en"].map((language) => [language, tasks.filter((item) => item.language === language).length])),
  domains: domainCounts,
  workflows: Object.fromEntries([...new Set(tasks.map((item) => item.workflow))].sort().map((workflow) => [workflow, tasks.filter((item) => item.workflow === workflow).length])),
};

await mkdir(new URL("../benchmarks/generated/", import.meta.url), { recursive: true });
await mkdir(new URL("../lib/semantic/generated/", import.meta.url), { recursive: true });
await writeFile(new URL("../benchmarks/generated/demand-concepts.json", import.meta.url), `${JSON.stringify(concepts, null, 2)}\n`);
// Product discovery consumes the demand taxonomy, never the held-out prompts or
// benchmark answers. Keeping this artifact separate makes that boundary auditable.
await writeFile(
  new URL("../lib/semantic/generated/economic-concepts.generated.json", import.meta.url),
  `${JSON.stringify({ schema_version: 1, concepts })}\n`,
);
await writeFile(new URL("../benchmarks/generated/real-demand-v1.jsonl", import.meta.url), `${tasks.map((task) => JSON.stringify(task)).join("\n")}\n`);
await writeFile(new URL("../benchmarks/generated/real-demand-v1.summary.json", import.meta.url), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
