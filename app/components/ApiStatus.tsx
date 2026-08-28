"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

interface Check {
  id: string;
  label: string;
  endpoint: string;
  state: "checking" | "ok" | "error";
  detail: string;
}

function initialChecks(pt: boolean): Check[] { return [
  { id: "api", label: pt ? "Roteador da API e catálogo" : "API router & catalog", endpoint: "/api/v1/health", state: "checking", detail: pt ? "Verificando…" : "Checking…" },
  { id: "ibge", label: pt ? "Agregados do IBGE" : "IBGE Aggregates", endpoint: "/api/v1/indicators/br-ipca-monthly/latest", state: "checking", detail: pt ? "Verificando…" : "Checking…" },
  { id: "bcb", label: "BCB SGS", endpoint: "/api/v1/indicators/br-selic-target/latest", state: "checking", detail: pt ? "Verificando…" : "Checking…" },
]; }

export function ApiStatus({ locale = "en" }: { locale?: Locale }) {
  const pt = locale === "pt-br";
  const [checks, setChecks] = useState(() => initialChecks(pt));
  const [checkedAt, setCheckedAt] = useState("");

  const runChecks = useCallback(async () => {
    const pendingChecks = initialChecks(pt);
    setChecks(pendingChecks);
    const results = await Promise.all(
      pendingChecks.map(async (check): Promise<Check> => {
        const started = performance.now();
        try {
          const response = await fetch(check.endpoint, { cache: "no-store" });
          const payload = (await response.json()) as { meta?: { stale?: boolean } };
          const duration = (performance.now() - started).toFixed(0);
          return {
            ...check,
            state: response.ok ? "ok" : "error",
            detail: response.ok
              ? `${duration} ms${payload.meta?.stale ? (pt ? " · snapshot desatualizado" : " · stale snapshot") : (pt ? " · resposta atual" : " · response current")}`
              : `HTTP ${response.status}`,
          };
        } catch {
          return { ...check, state: "error", detail: pt ? "Falha na requisição de rede" : "Network request failed" };
        }
      }),
    );
    setChecks(results);
    setCheckedAt(new Date().toLocaleString(locale, { dateStyle: "medium", timeStyle: "medium" }));
  }, [locale, pt]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void runChecks(); }, 0);
    return () => window.clearTimeout(timer);
  }, [runChecks]);

  const allOk = checks.every((check) => check.state === "ok");
  const checking = checks.some((check) => check.state === "checking");

  return (
    <div className="status-panel">
      <div className="overall-status">
        <span className={checking ? "status-orb checking" : allOk ? "status-orb" : "status-orb error"} />
        <div>
          <strong>{checking ? (pt ? "Executando verificações" : "Running live checks") : allOk ? (pt ? "Todos os sistemas verificados estão operacionais" : "All checked systems operational") : (pt ? "Uma ou mais verificações precisam de atenção" : "One or more checks need attention")}</strong>
          <span>{checkedAt ? `${pt ? "Verificado" : "Checked"} ${checkedAt}` : (pt ? "Verificando esta implantação" : "Checking this deployment now")}</span>
        </div>
        <button type="button" onClick={runChecks} disabled={checking}>{pt ? "Verificar novamente" : "Run again"}</button>
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
        {pt ? "As verificações recuperam uma observação real pela API pública. É um diagnóstico pontual, não uma garantia de disponibilidade. Snapshots desatualizados são identificados." : "Publisher checks retrieve one real observation through the public API. This is a point-in-time diagnostic, not an uptime guarantee. Stale snapshots are labeled explicitly."}
      </p>
    </div>
  );
}
