"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { recordActivation } from "@/app/components/Telemetry";
import type { Locale } from "@/lib/i18n";

type RecipeId = "selic" | "jobs" | "unemployment";
type ApiResult = Record<string, unknown>;

const ORIGIN = "https://open-economics-data.knbf982hkn.chatgpt.site";

const recipes = {
  selic: {
    dataset: "bcb-sgs:432",
    question: { en: "What is Brazil’s Selic target?", "pt-br": "Qual é a meta Selic do Brasil?" },
    detail: { en: "Latest official target plus source, unit, and reference date.", "pt-br": "Última meta oficial, com fonte, unidade e data de referência." },
    paths: ["/api/v1/indicators/br-selic-target/latest"],
    tool: "get_bcb_series",
    arguments: { dataset_id: "bcb-sgs:432", order: "desc", limit: 12 },
  },
  jobs: {
    dataset: "mte:formal-employment",
    question: { en: "How did formal employment change in SP and MG in 2025?", "pt-br": "Como variou o emprego formal em SP e MG em 2025?" },
    detail: { en: "Monthly adjusted stock and flows from Novo Caged.", "pt-br": "Estoque e fluxos mensais ajustados do Novo Caged." },
    paths: ["/api/v2/datasets/mte%3Aformal-employment/observations?from=2025-01&to=2025-12&breakdown=state&states=SP%7CMG&limit=50"],
    tool: "get_mte_formal_employment",
    arguments: { dataset_id: "mte:formal-employment", from: "2025-01", to: "2025-12", breakdown: "state", states: ["SP", "MG"], limit: 50 },
  },
  unemployment: {
    dataset: "br-unemployment-rate",
    question: { en: "Show Brazil’s unemployment trend since 2015.", "pt-br": "Mostre a trajetória do desemprego desde 2015." },
    detail: { en: "Official IBGE series with normalized dates and raw values.", "pt-br": "Série oficial do IBGE com datas normalizadas e valores brutos." },
    paths: ["/api/v1/indicators/br-unemployment-rate/observations?start=2015-01-01&order=asc"],
    tool: "search_official_data",
    arguments: { query: "Brazil national unemployment rate since 2015, quarterly, official IBGE data", limit: 5 },
  },
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRows(result: ApiResult | null) {
  const data = result?.data;
  return Array.isArray(data) ? data.map(asRecord) : data ? [asRecord(data)] : [];
}

function display(value: unknown, locale: Locale) {
  if (typeof value === "number") return value.toLocaleString(locale, { maximumFractionDigits: 2 });
  return typeof value === "string" && value ? value : "—";
}

async function requestRecipe(recipeId: RecipeId) {
  const response = await fetch(recipes[recipeId].paths[0]);
  const body = await response.json() as ApiResult;
  if (!response.ok) {
    const problem = asRecord(body.error ?? body);
    throw new Error(String(problem.detail ?? problem.message ?? `HTTP ${response.status}`));
  }
  return body;
}

export function QueryRecipes({ locale, initialRecipe = "selic" }: { locale: Locale; initialRecipe?: RecipeId }) {
  const pt = locale === "pt-br";
  const [active, setActive] = useState<RecipeId>(initialRecipe);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"api" | "mcp" | "share" | "">("");

  const run = useCallback(async (recipeId: RecipeId) => {
    setStatus("loading");
    setError("");
    try {
      const body = await requestRecipe(recipeId);
      setResult(body);
      setStatus("ready");
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : (pt ? "Consulta indisponível." : "Query unavailable."));
      setStatus("error");
    }
  }, [pt]);

  useEffect(() => {
    let cancelled = false;
    requestRecipe(active).then((body) => {
      if (cancelled) return;
      setResult(body);
      setStatus("ready");
    }).catch((cause) => {
      if (cancelled) return;
      setResult(null);
      setError(cause instanceof Error ? cause.message : (pt ? "Consulta indisponível." : "Query unavailable."));
      setStatus("error");
    });
    return () => { cancelled = true; };
  }, [active, pt]);

  const recipe = recipes[active];
  const rows = useMemo(() => asRows(result), [result]);
  const meta = asRecord(result?.meta);
  const stale = meta.stale === true;

  const select = (id: RecipeId) => {
    const url = new URL(window.location.href);
    url.searchParams.set("recipe", id);
    url.searchParams.delete("utm_source");
    url.searchParams.delete("utm_medium");
    url.searchParams.delete("utm_campaign");
    window.history.replaceState({}, "", url);
    setResult(null);
    setError("");
    setStatus("loading");
    setActive(id);
    recordActivation("recipe_run");
  };

  const copy = async (kind: "api" | "mcp" | "share") => {
    const share = new URL(window.location.href);
    share.searchParams.set("recipe", active);
    share.searchParams.set("utm_source", "recipe-share");
    share.searchParams.set("utm_medium", "referral");
    share.searchParams.set("utm_campaign", active);
    const mcp = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: recipe.tool, arguments: recipe.arguments } };
    const value = kind === "api"
      ? recipe.paths.map((path) => `${ORIGIN}${path}`).join("\n")
      : kind === "mcp" ? JSON.stringify(mcp, null, 2) : share.toString();
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    recordActivation(kind === "api" ? "api_url_copy" : kind === "mcp" ? "mcp_config_copy" : "share_link_copy");
    window.setTimeout(() => setCopied(""), 1800);
  };

  return <div className="query-studio">
    <div className="query-questions" role="tablist" aria-label={pt ? "Perguntas prontas" : "Ready-to-run questions"}>
      {(Object.keys(recipes) as RecipeId[]).map((id, index) => <button key={id} role="tab" aria-selected={active === id} className={active === id ? "active" : ""} onClick={() => select(id)}>
        <span>0{index + 1}</span><b>{recipes[id].question[locale]}</b><small>{recipes[id].detail[locale]}</small>
      </button>)}
    </div>

    <section className="query-result" aria-live="polite">
      <header><div><span>{recipe.dataset}</span><h1>{recipe.question[locale]}</h1></div><div className={`query-state ${status}`}><i />{status === "loading" ? (pt ? "Consultando" : "Querying") : status === "ready" ? (stale ? (pt ? "Snapshot anterior" : "Stale snapshot") : (pt ? "Fonte respondendo" : "Source responding")) : (pt ? "Indisponível" : "Unavailable")}</div></header>
      {status === "loading" && <div className="query-loading">{pt ? "Buscando a observação oficial e sua proveniência…" : "Fetching the official observation and its provenance…"}</div>}
      {status === "error" && <div className="query-error"><b>{pt ? "A fonte não respondeu." : "The source did not respond."}</b><p>{error}</p><button onClick={() => { recordActivation("recipe_run"); void run(active); }}>{pt ? "Tentar novamente" : "Try again"}</button></div>}
      {status === "ready" && active === "selic" && <div className="query-latest">
        <strong>{display(rows[0]?.value, locale)}<small>% a.a.</small></strong>
        <dl><div><dt>{pt ? "Período" : "Period"}</dt><dd>{display(rows[0]?.period ?? rows[0]?.date, locale)}</dd></div><div><dt>{pt ? "Fonte" : "Source"}</dt><dd>Banco Central do Brasil</dd></div><div><dt>{pt ? "Série" : "Series"}</dt><dd>SGS 432</dd></div></dl>
      </div>}
      {status === "ready" && active === "jobs" && <div className="query-table-wrap"><table><thead><tr><th>{pt ? "Mês" : "Month"}</th><th>UF</th><th>{pt ? "Saldo" : "Balance"}</th><th>{pt ? "Estoque" : "Stock"}</th></tr></thead><tbody>{rows.map((row, index) => { const breakdown = asRecord(row.breakdown); return <tr key={`${row.period}-${breakdown.id}-${index}`}><td>{display(row.period, locale)}</td><td>{display(breakdown.id, locale)}</td><td>{display(row.balance, locale)}</td><td>{display(row.stock, locale)}</td></tr>; })}</tbody></table></div>}
      {status === "ready" && active === "unemployment" && <div className="query-table-wrap"><table><thead><tr><th>{pt ? "Período" : "Period"}</th><th>{pt ? "Taxa" : "Rate"}</th><th>{pt ? "Estado" : "Status"}</th></tr></thead><tbody>{rows.slice(-20).reverse().map((row, index) => <tr key={`${row.period}-${index}`}><td>{display(row.period ?? row.date, locale)}</td><td>{display(row.value, locale)}%</td><td>{display(row.status ?? "observed", locale)}</td></tr>)}</tbody></table></div>}
      {status === "ready" && !rows.length && <div className="query-error"><b>{pt ? "A fonte respondeu sem observações." : "The source returned no observations."}</b></div>}
      <footer><span>{pt ? "Valores oficiais · significado e origem preservados" : "Official values · meaning and provenance preserved"}</span><button onClick={() => copy("share")}>{copied === "share" ? (pt ? "Link copiado" : "Link copied") : (pt ? "Compartilhar consulta" : "Share query")}</button></footer>
    </section>

    <section className="query-recipes">
      <div><span>API</span><h2>{pt ? "Reutilize a consulta" : "Reuse the query"}</h2><pre><code>GET {recipe.paths[0]}</code></pre><button onClick={() => copy("api")}>{copied === "api" ? (pt ? "Copiado" : "Copied") : (pt ? "Copiar URL" : "Copy URL")}</button></div>
      <div className="query-mcp-card"><span>MCP</span><h2>{pt ? "Faça a mesma pergunta por uma ferramenta" : "Ask the same question through a tool"}</h2><pre><code>{JSON.stringify({ name: recipe.tool, arguments: recipe.arguments }, null, 2)}</code></pre><button onClick={() => copy("mcp")}>{copied === "mcp" ? (pt ? "Copiado" : "Copied") : (pt ? "Copiar chamada MCP" : "Copy MCP call")}</button></div>
    </section>
  </div>;
}
