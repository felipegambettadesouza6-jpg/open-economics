"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/app/components/CopyButton";

interface PlaygroundIndicator {
  id: string;
  name: string;
  source: string;
  frequency: string;
}

type Endpoint = "observations" | "latest" | "metadata";

function oneYearAgo() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

export function Playground({ indicators }: { indicators: PlaygroundIndicator[] }) {
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

  useEffect(() => {
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
    });
  }, [indicators]);

  const requestPath = useMemo(() => {
    if (endpoint === "metadata") return `/api/v1/indicators/${indicator}`;
    if (endpoint === "latest") return `/api/v1/indicators/${indicator}/latest`;
    const params = new URLSearchParams({ start, end, order, limit });
    return `/api/v1/indicators/${indicator}/observations?${params}`;
  }, [endpoint, indicator, start, end, order, limit]);

  useEffect(() => {
    const params = new URLSearchParams({ endpoint, indicator });
    if (endpoint === "observations") {
      params.set("start", start);
      params.set("end", end);
      params.set("order", order);
      params.set("limit", limit);
    }
    window.history.replaceState({}, "", `/playground?${params}`);
  }, [endpoint, indicator, start, end, order, limit]);

  const absoluteUrl = typeof window === "undefined" ? requestPath : `${window.location.origin}${requestPath}`;

  const snippets = {
    curl: `curl --fail --silent \\\n  "${absoluteUrl}"`,
    python: `import requests\n\nresponse = requests.get("${absoluteUrl}", timeout=30)\nresponse.raise_for_status()\ndata = response.json()\nprint(data["data"])`,
    javascript: `const response = await fetch("${absoluteUrl}");\nif (!response.ok) throw new Error(\`HTTP \${response.status}\`);\nconst { data, meta } = await response.json();\nconsole.log(data, meta.provenance);`,
  };

  async function execute() {
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
  }

  return (
    <div className="playground">
      <div className="playground-builder">
        <div className="builder-head">
          <span>Request builder</span>
          <b>GET only</b>
        </div>
        <label className="form-field">
          <span>Endpoint</span>
          <select value={endpoint} onChange={(event) => setEndpoint(event.target.value as Endpoint)}>
            <option value="observations">Series observations</option>
            <option value="latest">Latest observation</option>
            <option value="metadata">Indicator metadata</option>
          </select>
        </label>
        <label className="form-field">
          <span>Indicator</span>
          <select value={indicator} onChange={(event) => setIndicator(event.target.value)}>
            {indicators.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.source}</option>
            ))}
          </select>
        </label>
        {endpoint === "observations" && (
          <>
            <div className="form-grid">
              <label className="form-field">
                <span>Start date</span>
                <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
              </label>
              <label className="form-field">
                <span>End date</span>
                <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
              </label>
            </div>
            <div className="form-grid">
              <label className="form-field">
                <span>Order</span>
                <select value={order} onChange={(event) => setOrder(event.target.value)}>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
              <label className="form-field">
                <span>Limit</span>
                <input min="1" max="5000" type="number" value={limit} onChange={(event) => setLimit(event.target.value)} />
              </label>
            </div>
          </>
        )}
        <div className="generated-url">
          <span>Generated URL</span>
          <code>{requestPath}</code>
          <CopyButton value={absoluteUrl} />
        </div>
        <button className="run-button" type="button" onClick={execute} disabled={running}>
          {running ? "Running request…" : "Run request"} <span>→</span>
        </button>

        <div className="snippet-panel">
          <div className="snippet-tabs" role="tablist" aria-label="Code example language">
            {(["curl", "python", "javascript"] as const).map((language) => (
              <button
                key={language}
                role="tab"
                aria-selected={snippet === language}
                className={snippet === language ? "active" : ""}
                type="button"
                onClick={() => setSnippet(language)}
              >
                {language === "javascript" ? "JavaScript" : language === "python" ? "Python" : "cURL"}
              </button>
            ))}
            <CopyButton value={snippets[snippet]} label="Copy" />
          </div>
          <pre><code>{snippets[snippet]}</code></pre>
        </div>
      </div>

      <div className="playground-response">
        <div className="response-head">
          <span>Response</span>
          {result ? (
            <div>
              <b className={result.status >= 200 && result.status < 300 ? "success" : "failure"}>
                {result.status || "ERR"} {result.statusText}
              </b>
              <span>{result.latency.toFixed(0)} ms</span>
            </div>
          ) : <span>Not run yet</span>}
        </div>
        {result ? (
          <>
            <div className="response-meta">
              <span>request <code>{result.requestId ?? "not available"}</code></span>
              <span>{result.cacheControl ?? "no cache header"}</span>
              {result.warning && <span className="warning">{result.warning}</span>}
            </div>
            <pre className="response-body"><code>{result.body}</code></pre>
            <div className="response-actions">
              <CopyButton value={result.body} label="Copy response" />
              <a href={requestPath} target="_blank" rel="noreferrer">Open raw response ↗</a>
            </div>
          </>
        ) : (
          <div className="response-empty">
            <span aria-hidden="true">&#123; &#125;</span>
            <strong>Run the request to inspect the response.</strong>
            <p>Status, timing, headers, normalized data, and provenance will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
