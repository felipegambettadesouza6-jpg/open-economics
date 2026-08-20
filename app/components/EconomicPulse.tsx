"use client";
import { useEffect, useState } from "react";
import { localized, type Locale } from "@/lib/i18n";

type Point = { date: string; period: string; value: number | null };
type PulseState = Record<string, { status: "loading" | "ready" | "error"; data?: Point[] }>;
const series = [
  { id: "br-ipca-12m", label: "IPCA · 12m", source: "IBGE", color: "blue" },
  { id: "br-selic-target", label: "Selic", source: "BCB", color: "lime" },
  { id: "br-unemployment-rate", label: "Unemployment · Desocupação", source: "IBGE", color: "coral" },
  { id: "br-ibc-br", label: "IBC-Br", source: "BCB", color: "ink" },
] as const;
function yearAgo(years: number) { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return d.toISOString().slice(0, 10); }
function pathFor(data: Point[]) {
  const points = data.filter((point): point is Point & { value: number } => point.value !== null).slice(-48);
  if (points.length < 2) return "";
  const values = points.map((point) => point.value); const min = Math.min(...values); const max = Math.max(...values); const spread = max - min || 1;
  return points.map((point, index) => `${index ? "L" : "M"}${(index / (points.length - 1) * 100).toFixed(2)},${(8 + (max - point.value) / spread * 44).toFixed(2)}`).join(" ");
}

export function EconomicPulse({ locale }: { locale: Locale }) {
  const [state, setState] = useState<PulseState>(() => Object.fromEntries(series.map((item) => [item.id, { status: "loading" }])));
  useEffect(() => {
    const controller = new AbortController();
    series.forEach((item) => fetch(`/api/v1/indicators/${item.id}/observations?start=${yearAgo(item.id === "br-ibc-br" ? 4 : 2)}&order=asc`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ data: Point[] }>; })
      .then(({ data }) => setState((current) => ({ ...current, [item.id]: { status: "ready", data } })))
      .catch((error: Error) => { if (error.name !== "AbortError") setState((current) => ({ ...current, [item.id]: { status: "error" } })); }));
    return () => controller.abort();
  }, []);
  return <div className="pulse-plot"><div className="plot-coordinate">BR · 14.2350° S / 51.9253° W</div>{series.map((item, index) => {
    const current = state[item.id]; const latest = current?.data?.filter((point) => point.value !== null).at(-1); const path = current?.data ? pathFor(current.data) : "";
    return <a className={`pulse-line ${item.color}`} href={localized(locale, `/indicators/${item.id}`)} key={item.id}><span className="pulse-index">0{index + 1}</span><span className="pulse-label"><b>{item.label}</b><small>{item.source}</small></span><svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path className="pulse-grid-path" d="M0 53H100 M0 30H100" />{path ? <path className="pulse-data-path" d={path} /> : <path className="pulse-wait-path" d="M0 44 L22 36 L43 42 L64 25 L82 31 L100 18" />}</svg><span className="pulse-value">{latest?.value != null ? <><b>{latest.value.toLocaleString(locale, { maximumFractionDigits: 2 })}</b><small>{latest.period}</small></> : <><b>—</b><small>{current?.status === "error" ? (locale === "pt-br" ? "Fonte indisponível" : "Source unavailable") : (locale === "pt-br" ? "Carregando" : "Loading")}</small></>}</span></a>;
  })}</div>;
}
