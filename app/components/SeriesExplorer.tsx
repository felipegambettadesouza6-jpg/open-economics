"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/app/components/CopyButton";
import { DataChart } from "@/app/components/DataChart";

interface Observation {
  date: string;
  period: string;
  source_date: string;
  value: number | null;
  raw_value: string;
  status: string;
}

interface SeriesResponse {
  data: Observation[];
  meta: {
    stale: boolean;
    cache: string;
    provenance: {
      retrieved_at: string;
      upstream_url: string;
    };
  };
}

type RangeKey = "1Y" | "5Y" | "10Y" | "MAX";

function subtractYears(years: number) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function formatValue(value: number | null, decimals: number, unit: string) {
  if (value === null) return "—";
  const formatted = new Intl.NumberFormat("en", {
    minimumFractionDigits: Math.min(decimals, 1),
    maximumFractionDigits: decimals,
  }).format(value);
  if (unit === "R$") return `R$ ${formatted}`;
  return `${formatted} ${unit}`;
}

export function SeriesExplorer({
  indicatorId,
  unit,
  decimals,
  frequency,
  startDate,
}: {
  indicatorId: string;
  unit: string;
  decimals: number;
  frequency: string;
  startDate: string;
}) {
  // Daily series are much more responsive at a one-year initial window; broader
  // ranges remain one click away and the API still supports the full ten years.
  const [range, setRange] = useState<RangeKey>(() => frequency === "daily" ? "1Y" : "5Y");
  const [response, setResponse] = useState<SeriesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const end = new Date().toISOString().slice(0, 10);
  const start = range === "1Y"
    ? subtractYears(1)
    : range === "5Y"
      ? subtractYears(5)
      : range === "10Y"
        ? subtractYears(10)
        : frequency === "daily"
          ? subtractYears(10)
          : startDate;
  const requestPath = `/api/v1/indicators/${indicatorId}/observations?start=${start}&end=${end}&order=asc&limit=5000`;

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError("");
    });
    fetch(requestPath, { signal: controller.signal })
      .then(async (result) => {
        if (!result.ok) {
          const body = (await result.json().catch(() => null)) as { detail?: string } | null;
          throw new Error(body?.detail ?? `API returned HTTP ${result.status}`);
        }
        return (await result.json()) as SeriesResponse;
      })
      .then((data) => setResponse(data))
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [requestPath]);

  const valid = useMemo(
    () => response?.data.filter((item): item is Observation & { value: number } => item.value !== null) ?? [],
    [response],
  );
  const latest = valid.at(-1);
  const previous = valid.at(-2);
  const change = latest && previous ? latest.value - previous.value : null;
  const tableRows = [...(response?.data ?? [])].reverse().slice(0, 24);

  return (
    <section className="series-explorer">
      <div className="series-toolbar">
        <div className="range-control" aria-label="Chart range">
          {(["1Y", "5Y", "10Y", "MAX"] as RangeKey[]).map((item) => (
            <button
              className={range === item ? "active" : ""}
              type="button"
              aria-pressed={range === item}
              onClick={() => setRange(item)}
              key={item}
            >
              {item === "MAX" && frequency === "daily" ? "10Y max" : item === "MAX" ? "Max" : item}
            </button>
          ))}
        </div>
        <div className="series-actions">
          <CopyButton value={requestPath} label="Copy API URL" />
          <a href={`${requestPath}&format=csv`} download>Download CSV</a>
          <a href={requestPath}>View JSON ↗</a>
        </div>
      </div>

      {loading && <div className="series-state" role="status">Loading official observations…</div>}
      {error && (
        <div className="series-state error" role="alert">
          <strong>Official source unavailable</strong>
          <p>{error}</p>
          <span>No values have been estimated or substituted.</span>
        </div>
      )}
      {!loading && !error && response && (
        <>
          {response.meta.stale && (
            <div className="stale-notice">
              The official source could not be refreshed. This is the last known good snapshot and is marked stale.
            </div>
          )}
          <div className="series-summary">
            <div>
              <span>Latest value</span>
              <strong>{formatValue(latest?.value ?? null, decimals, unit)}</strong>
            </div>
            <div>
              <span>Reference period</span>
              <strong>{latest?.period ?? "Unavailable"}</strong>
            </div>
            <div>
              <span>Previous-period change</span>
              <strong>{change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(decimals)} ${unit}`}</strong>
            </div>
            <div>
              <span>Observations shown</span>
              <strong>{response.data.length.toLocaleString("en")}</strong>
            </div>
          </div>
          <div className="chart-panel">
            <div className="chart-title-row">
              <div>
                <strong>History</strong>
                <span>{unit} · {start} to {end}</span>
              </div>
              <span className="chart-source-state">
                <i /> {response.meta.cache === "hit" ? "Cached official response" : "Fresh official response"}
              </span>
            </div>
            <DataChart data={response.data} unit={unit} decimals={decimals} />
          </div>

          <div className="observation-section">
            <div className="section-heading compact-heading">
              <div>
                <p className="kicker">Observations</p>
                <h2>Recent data</h2>
              </div>
              <span>Showing the 24 most recent returned periods</span>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Reference period</th><th>Normalized date</th><th>Value</th><th>Status</th><th>Source value</th></tr>
                </thead>
                <tbody>
                  {tableRows.map((item) => (
                    <tr key={`${item.date}-${item.source_date}`}>
                      <td><strong>{item.period}</strong></td>
                      <td><code>{item.date}</code></td>
                      <td>{formatValue(item.value, decimals, unit)}</td>
                      <td><span className={`observation-status ${item.status}`}>{item.status}</span></td>
                      <td><code>{item.raw_value}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-note">
              Source values are preserved verbatim. IBGE suppression and availability symbols remain distinct from numeric zero.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
