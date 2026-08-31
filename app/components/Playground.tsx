"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "@/app/components/CopyButton";
import { recordActivation, useSearchTelemetry } from "@/app/components/Telemetry";
import { localized, type Locale } from "@/lib/i18n";

interface PlaygroundIndicator {
  id: string;
  name: string;
  officialName: string;
  source: string;
  frequency: string;
}

type Endpoint = "observations" | "latest" | "metadata";

function oneYearAgo() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

export function Playground({ indicators, locale = "en" }: { indicators: PlaygroundIndicator[]; locale?: Locale }) {
  const pt = locale === "pt-br";
  // Keep the server and first browser render identical; URL state is applied
  // after hydration so a shared playground link never causes a mismatch.
  const [endpoint, setEndpoint] = useState<Endpoint>("observations");
  const [indicator, setIndicator] = useState("br-ipca-monthly");
  const [start, setStart] = useState(oneYearAgo);
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [order, setOrder] = useState("asc");
  const [limit, setLimit] = useState("100");
  const [result, setResult] = useState<{
    status: number;
    statusText: string;
    body: string;
    latency: number;
    requestId: string | null;
    cacheControl: string | null;
    warning: string | null;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [snippet, setSnippet] = useState<"curl" | "python" | "javascript">("curl");
  const [indicatorQuery, setIndicatorQuery] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const [origin, setOrigin] = useState("");
  const initialRun = useRef(false);
  const snippetLanguages = ["curl", "python", "javascript"] as const;
  const visibleIndicators = indicators.filter((item) => `${item.name} ${item.officialName} ${item.id} ${item.source}`.toLowerCase().includes(indicatorQuery.toLowerCase()));
  useSearchTelemetry({ surface: "playground", query: indicatorQuery, results: visibleIndicators.length, locale });
  const numericLimit = Number(limit);
  const validationError = endpoint !== "observations" ? ""
    : start > end ? (pt ? "A data inicial deve ser anterior ou igual à data final." : "Start date must be on or before end date.")
      : !Number.isInteger(numericLimit) || numericLimit < 1 || numericLimit > 5000 ? (pt ? "O limite deve ser um número inteiro entre 1 e 5000." : "Limit must be a whole number between 1 and 5000.")
        : "";

  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
    const params = new URLSearchParams(window.location.search);
    const selectedEndpoint = params.get("endpoint");
    const selectedIndicator = params.get("indicator");
    const selectedStart = params.get("start");
    const selectedEnd = params.get("end");
    const selectedOrder = params.get("order");
    const selectedLimit = params.get("limit");

    queueMicrotask(() => {
      if (selectedEndpoint === "latest" || selectedEndpoint === "metadata" || selectedEndpoint === "observations") setEndpoint(selectedEndpoint);
      if (selectedIndicator && indicators.some((item) => item.id === selectedIndicator)) setIndicator(selectedIndicator);
      if (selectedStart) setStart(selectedStart);
      if (selectedEnd) setEnd(selectedEnd);
      if (selectedOrder === "asc" || selectedOrder === "desc") setOrder(selectedOrder);
      if (selectedLimit && /^\d+$/.test(selectedLimit)) setLimit(selectedLimit);
      setUrlReady(true);
    });
  }, [indicators]);

  const requestPath = useMemo(() => {
    if (endpoint === "metadata") return `/api/v1/indicators/${indicator}`;
    if (endpoint === "latest") return `/api/v1/indicators/${indicator}/latest`;
    const params = new URLSearchParams({ start, end, order, limit });
    return `/api/v1/indicators/${indicator}/observations?${params}`;
  }, [endpoint, indicator, start, end, order, limit]);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams({ endpoint, indicator });
    if (endpoint === "observations") {
      params.set("start", start);
      params.set("end", end);
      params.set("order", order);
      params.set("limit", limit);
    }
    window.history.replaceState({}, "", `${localized(locale, "/playground")}?${params}`);
  }, [endpoint, indicator, start, end, order, limit, locale, urlReady]);

  const absoluteUrl = `${origin}${requestPath}`;

  const snippets = {
    curl: `curl --fail --silent \\\n  "${absoluteUrl}"`,
    python: `import requests\n\nresponse = requests.get("${absoluteUrl}", timeout=30)\nresponse.raise_for_status()\ndata = response.json()\nprint(data["data"])`,
    javascript: `const response = await fetch("${absoluteUrl}");\nif (!response.ok) throw new Error(\`HTTP \${response.status}\`);\nconst { data, meta } = await response.json();\nconsole.log(data, meta.provenance);`,
  };

  const execute = useCallback(async (activated = false) => {
    if (validationError) return;
    setRunning(true);
    const started = performance.now();
    try {
      const response = await fetch(requestPath);
      const body = await response.text();
      let formatted = body;
      try {
        formatted = JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        formatted = body;
      }
      setResult({
        status: response.status,
        statusText: response.statusText,
        body: formatted,
        latency: performance.now() - started,
        requestId: response.headers.get("x-request-id"),
        cacheControl: response.headers.get("cache-control"),
        warning: response.headers.get("warning"),
      });
      if (activated && response.ok) recordActivation("playground_run");
    } catch (error) {
      setResult({
        status: 0,
        statusText: "Network error",
        body: error instanceof Error ? error.message : "Request failed",
        latency: performance.now() - started,
        requestId: null,
        cacheControl: null,
        warning: null,
      });
    } finally {
      setRunning(false);
    }
  }, [requestPath, validationError]);

  useEffect(() => {
    if (!urlReady || initialRun.current) return;
    initialRun.current = true;
    void execute(false);
  }, [execute, urlReady]);

  return (
    <div className="playground">
      <div className="playground-builder">
        <div className="builder-head">
          <span>{pt ? "Construtor de requisição" : "Request builder"}</span>
          <b>{pt ? "Somente GET" : "GET only"}</b>
        </div>
        <label className="form-field">
          <span>Endpoint <small>{pt ? "Escolha o tipo de resposta" : "Choose the response shape"}</small></span>
          <select value={endpoint} onChange={(event) => setEndpoint(event.target.value as Endpoint)}>
            <option value="observations">{pt ? "Observações da série" : "Series observations"}</option>
            <option value="latest">{pt ? "Observação mais recente" : "Latest observation"}</option>
            <option value="metadata">{pt ? "Metadados do indicador" : "Indicator metadata"}</option>
          </select>
        </label>
        <label className="form-field">
          <span>{pt ? "Indicador" : "Indicator"} <small>{pt ? "ID estável da série" : "Stable series ID"}</small></span>
          <input className="indicator-search" type="search" value={indicatorQuery} onChange={(event) => setIndicatorQuery(event.target.value)} placeholder={pt ? "Filtrar por nome ou ID…" : "Filter by name or ID…"} />
          <select value={indicator} onChange={(event) => setIndicator(event.target.value)}>
            {visibleIndicators.map((item) => (
              <option key={item.id} value={item.id}>{pt ? item.officialName : item.name} · {item.source}</option>
            ))}
          </select>
        </label>
        {endpoint === "observations" && (
          <>
            <div className="form-grid">
              <label className="form-field">
                <span>{pt ? "Data inicial" : "Start date"} <small>YYYY-MM-DD · {pt ? "inclusiva" : "inclusive"}</small></span>
                <input type="date" value={start} onChange={(event) => setStart(event.target.value)} aria-invalid={Boolean(validationError && start > end)} />
              </label>
              <label className="form-field">
                <span>{pt ? "Data final" : "End date"} <small>YYYY-MM-DD · {pt ? "inclusiva" : "inclusive"}</small></span>
                <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} aria-invalid={Boolean(validationError && start > end)} />
              </label>
            </div>
            <div className="form-grid">
              <label className="form-field">
                <span>{pt ? "Ordem" : "Order"} <small>{pt ? "ordenação por data" : "sort by date"}</small></span>
                <select value={order} onChange={(event) => setOrder(event.target.value)}>
                  <option value="asc">{pt ? "Crescente" : "Ascending"}</option>
                  <option value="desc">{pt ? "Decrescente" : "Descending"}</option>
                </select>
              </label>
              <label className="form-field">
                <span>{pt ? "Limite" : "Limit"} <small>1—5000</small></span>
                <input min="1" max="5000" type="number" value={limit} onChange={(event) => setLimit(event.target.value)} aria-invalid={Boolean(validationError && !(numericLimit >= 1 && numericLimit <= 5000))} />
              </label>
            </div>
          </>
        )}
        <div className="generated-url">
          <span>{pt ? "URL gerada" : "Generated URL"}</span>
          <code>{requestPath}</code>
          <CopyButton value={absoluteUrl} label={pt ? "Copiar URL" : "Copy URL"} successLabel={pt ? "Copiado" : "Copied"} activation="api_url_copy" />
        </div>
        {validationError && <p className="request-validation" id="request-validation" role="alert">{validationError}</p>}
        <button className="run-button" type="button" onClick={() => void execute(true)} disabled={running || Boolean(validationError)} aria-describedby={validationError ? "request-validation" : undefined}>
          {running ? (pt ? "Executando…" : "Running request…") : (pt ? "Executar requisição" : "Run request")} <span>→</span>
        </button>

        <div className="snippet-panel">
          <div className="snippet-tabs" role="tablist" aria-label={pt ? "Linguagem do exemplo de código" : "Code example language"}>
            {snippetLanguages.map((language, index) => (
              <button
                key={language}
                id={`snippet-tab-${language}`}
                role="tab"
                aria-selected={snippet === language}
                aria-controls="snippet-code-panel"
                tabIndex={snippet === language ? 0 : -1}
                className={snippet === language ? "active" : ""}
                type="button"
                onClick={() => setSnippet(language)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  const direction = event.key === "ArrowRight" ? 1 : -1;
                  const next = snippetLanguages[(index + direction + snippetLanguages.length) % snippetLanguages.length];
                  setSnippet(next);
                  document.getElementById(`snippet-tab-${next}`)?.focus();
                }}
              >
                {language === "javascript" ? "JavaScript" : language === "python" ? "Python" : "cURL"}
              </button>
            ))}
            <CopyButton value={snippets[snippet]} label={pt ? "Copiar código" : "Copy code"} successLabel={pt ? "Copiado" : "Copied"} activation="code_copy" />
          </div>
          <pre id="snippet-code-panel" role="tabpanel" aria-labelledby={`snippet-tab-${snippet}`} tabIndex={0}><code>{snippets[snippet]}</code></pre>
        </div>
      </div>

      <div className="playground-response">
        <div className="response-head">
          <span>{pt ? "Resposta" : "Response"}</span>
          {result ? (
            <div>
              <b className={result.status >= 200 && result.status < 300 ? "success" : "failure"}>
                {result.status || "ERR"} {result.statusText}
              </b>
              <span>{result.latency.toFixed(0)} ms</span>
            </div>
          ) : <span>{pt ? "Ainda não executada" : "Not run yet"}</span>}
        </div>
        {result ? (
          <>
            <div className="response-meta">
              <span>request <code>{result.requestId ?? (pt ? "indisponível" : "not available")}</code></span>
              <span>{result.cacheControl ?? (pt ? "sem cabeçalho de cache" : "no cache header")}</span>
              {result.warning && <span className="warning">{result.warning}</span>}
            </div>
            <pre className="response-body"><code>{result.body}</code></pre>
            <div className="response-legend"><span><code>data</code>{pt ? "observações normalizadas" : "normalized observations"}</span><span><code>meta</code>{pt ? "definição e origem" : "definition and provenance"}</span><span><code>status</code>{pt ? "semântica do valor" : "value semantics"}</span></div>
            <div className="response-actions">
              <CopyButton value={result.body} label={pt ? "Copiar resposta" : "Copy response"} successLabel={pt ? "Copiado" : "Copied"} activation="response_copy" />
              <a href={requestPath} target="_blank" rel="noreferrer" data-activation="raw_response_open">{pt ? "Abrir resposta bruta" : "Open raw response"} ↗</a>
            </div>
          </>
        ) : (
          <div className="response-empty">
            <span aria-hidden="true">&#123; &#125;</span>
            <strong>{pt ? "Execute a requisição para inspecionar a resposta." : "Run the request to inspect the response."}</strong>
            <p>{pt ? "Status, tempo, cabeçalhos, dados normalizados e origem aparecerão aqui." : "Status, timing, headers, normalized data, and provenance will appear here."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
