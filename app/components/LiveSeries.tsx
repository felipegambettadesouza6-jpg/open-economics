"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/app/components/CopyButton";
import { DataChart } from "@/app/components/DataChart";

interface Observation {
  date: string;
  period: string;
  value: number | null;
}

interface ResponseShape {
  data: Observation[];
  meta: {
    stale: boolean;
    indicator: { unit_symbol: string };
    provenance: { retrieved_at: string };
  };
}

function twoYearsAgo() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 2);
  return date.toISOString().slice(0, 10);
}

export function LiveSeries() {
  const requestPath = useMemo(
    () => `/api/v1/indicators/br-ipca-12m/observations?start=${twoYearsAgo()}&order=asc`,
    [],
  );
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; response: ResponseShape }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(requestPath, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return (await response.json()) as ResponseShape;
      })
      .then((response) => setState({ status: "ready", response }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setState({ status: "error", message: error.message });
      });
    return () => controller.abort();
  }, [requestPath]);

  const latest = state.status === "ready"
    ? [...state.response.data].reverse().find((item) => item.value !== null)
    : null;

  return (
    <div className="live-proof">
      <div className="live-proof-top">
        <span className="live-label"><i /> Live from IBGE</span>
        <CopyButton value={requestPath} label="Copy request" />
      </div>
      <code className="request-line"><b>GET</b> {requestPath}</code>
      {state.status === "loading" && <div className="live-loading" role="status">Requesting official data…</div>}
      {state.status === "error" && (
        <div className="live-error" role="alert">
          <strong>Official source unavailable</strong>
          <span>{state.message}. No value has been substituted.</span>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <div className="live-value-row">
            <div>
              <span>IPCA · trailing 12 months</span>
              <strong>{latest?.value?.toFixed(2) ?? "—"}<small>%</small></strong>
            </div>
            <div className="live-period">
              <span>Reference period</span>
              <b>{latest?.period ?? "Unavailable"}</b>
            </div>
          </div>
          <DataChart data={state.response.data} unit="percent" decimals={2} compact />
          <div className="live-foot">
            <span>{state.response.data.length} official observations</span>
            <span>{state.response.meta.stale ? "Cached snapshot · refresh delayed" : "Source response current"}</span>
          </div>
        </>
      )}
    </div>
  );
}

