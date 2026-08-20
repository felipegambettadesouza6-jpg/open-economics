"use client";

import { useEffect, useState } from "react";

interface Check {
  id: string;
  label: string;
  endpoint: string;
  state: "checking" | "ok" | "error";
  detail: string;
}

const initialChecks: Check[] = [
  { id: "api", label: "API router & catalog", endpoint: "/api/v1/health", state: "checking", detail: "Checking…" },
  { id: "ibge", label: "IBGE Aggregates", endpoint: "/api/v1/indicators/br-ipca-monthly/latest", state: "checking", detail: "Checking…" },
  { id: "bcb", label: "BCB SGS", endpoint: "/api/v1/indicators/br-selic-target/latest", state: "checking", detail: "Checking…" },
];

export function ApiStatus() {
  const [checks, setChecks] = useState(initialChecks);
  const [checkedAt, setCheckedAt] = useState("");

  async function runChecks() {
    setChecks(initialChecks);
    const results = await Promise.all(
      initialChecks.map(async (check): Promise<Check> => {
        const started = performance.now();
        try {
          const response = await fetch(check.endpoint, { cache: "no-store" });
          const payload = (await response.json()) as { meta?: { stale?: boolean } };
          const duration = (performance.now() - started).toFixed(0);
          return {
            ...check,
            state: response.ok ? "ok" : "error",
            detail: response.ok
              ? `${duration} ms${payload.meta?.stale ? " · stale snapshot" : " · response current"}`
              : `HTTP ${response.status}`,
          };
        } catch {
          return { ...check, state: "error", detail: "Network request failed" };
        }
      }),
    );
    setChecks(results);
    setCheckedAt(new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "medium" }));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void runChecks(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const allOk = checks.every((check) => check.state === "ok");
  const checking = checks.some((check) => check.state === "checking");

  return (
    <div className="status-panel">
      <div className="overall-status">
        <span className={checking ? "status-orb checking" : allOk ? "status-orb" : "status-orb error"} />
        <div>
          <strong>{checking ? "Running live checks" : allOk ? "All checked systems operational" : "One or more checks need attention"}</strong>
          <span>{checkedAt ? `Checked ${checkedAt}` : "Checking this deployment now"}</span>
        </div>
        <button type="button" onClick={runChecks} disabled={checking}>Run again</button>
      </div>
      <div className="status-checks">
        {checks.map((check) => (
          <div key={check.id}>
            <span className={`check-mark ${check.state}`}>{check.state === "ok" ? "✓" : check.state === "error" ? "!" : "·"}</span>
            <div><strong>{check.label}</strong><small>{check.endpoint}</small></div>
            <span>{check.detail}</span>
          </div>
        ))}
      </div>
      <p>
        Publisher checks retrieve one real observation through the public API. This is a point-in-time
        diagnostic, not an uptime guarantee. Stale snapshots are labeled explicitly.
      </p>
    </div>
  );
}
