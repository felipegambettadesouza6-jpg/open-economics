"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IndicatorDefinition } from "@/lib/domain/types";
import { localized, type Locale } from "@/lib/i18n";

type Point = { date: string; period: string; value: number | null };
type SeriesState = Record<string, { status: "loading" | "ready" | "error"; data?: Point[] }>;

const portraits = [
  { id: "br-ipca-12m", short: "IPCA", source: "IBGE", tone: "rose" },
  { id: "br-selic-target", short: "Selic", source: "BCB", tone: "aqua" },
  { id: "br-unemployment-rate", short: "Unemployment", source: "IBGE", tone: "violet" },
  { id: "br-ibc-br", short: "IBC-Br", source: "BCB", tone: "amber" },
] as const;

function startDate(years: number) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function linePath(data: Point[] = []) {
  const points = data.filter((point): point is Point & { value: number } => point.value !== null).slice(-36);
  if (points.length < 2) return "M0 58 C30 48 50 62 80 38 S140 16 180 24 S220 48 260 20";
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  return points.map((point, index) => {
    const x = (index / (points.length - 1)) * 260;
    const y = 10 + ((high - point.value) / span) * 56;
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export function SignalHero({ indicators, locale }: { indicators: IndicatorDefinition[]; locale: Locale }) {
  const pt = locale === "pt-br";
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [series, setSeries] = useState<SeriesState>(() => Object.fromEntries(portraits.map((item) => [item.id, { status: "loading" }])));
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return indicators.filter((indicator) => [indicator.name, indicator.officialName, indicator.id, ...indicator.aliases].join(" ").toLocaleLowerCase().includes(needle)).slice(0, 5);
  }, [indicators, query]);

  useEffect(() => {
    const controller = new AbortController();
    portraits.forEach((item) => {
      fetch(`/api/v1/indicators/${item.id}/observations?start=${startDate(item.id === "br-ibc-br" ? 4 : 2)}&order=asc`, { signal: controller.signal })
        .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ data: Point[] }>; })
        .then(({ data }) => setSeries((current) => ({ ...current, [item.id]: { status: "ready", data } })))
        .catch((error: Error) => { if (error.name !== "AbortError") setSeries((current) => ({ ...current, [item.id]: { status: "error" } })); });
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) {
        event.preventDefault(); inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return <section className="signal-hero">
    <div className="signal-portraits" aria-label={pt ? "Indicadores econômicos em destaque" : "Featured economic indicators"}>
      {portraits.map((item, index) => {
        const current = series[item.id];
        const latest = current?.data?.filter((point) => point.value !== null).at(-1);
        return <a className={`data-portrait portrait-${index + 1} tone-${item.tone}`} href={localized(locale, `/indicators/${item.id}`)} key={item.id}>
          <span className="portrait-wash" aria-hidden="true" />
          <span className="portrait-panel">
            <span className="portrait-top"><span><b>{item.short}</b><small>{item.source}</small></span><i aria-hidden="true">↗</i></span>
            <svg viewBox="0 0 260 78" preserveAspectRatio="none" aria-hidden="true"><path d="M0 66H260" /><path className="portrait-line" d={linePath(current?.data)} /></svg>
            <span className="portrait-bottom"><strong>{latest?.value != null ? latest.value.toLocaleString(locale, { maximumFractionDigits: 2 }) : "—"}</strong><small>{latest?.period ?? (current?.status === "error" ? (pt ? "Indisponível" : "Unavailable") : (pt ? "Conectando" : "Connecting"))}</small></span>
          </span>
        </a>;
      })}
    </div>
    <div className="signal-hero-copy">
      <p className="signal-eyebrow">{pt ? "Dados oficiais. Uma interface aberta." : "Official data. One open interface."}</p>
      <h1>{pt ? <>A economia,<br /><em>em foco.</em></> : <>The economy,<br /><em>in focus.</em></>}</h1>
      <p className="signal-intro">{pt ? "Encontre, entenda e use os indicadores que movem o Brasil — com contexto para análise e uma API pronta para produção." : "Find, understand, and use the indicators that move Brazil—with context for analysis and an API ready for production."}</p>
      <div className={`signal-search ${query ? "is-open" : ""}`}>
        <label htmlFor="signal-search">{pt ? "Buscar indicadores" : "Search indicators"}</label>
        <div className="signal-search-input"><span aria-hidden="true">⌕</span><input ref={inputRef} id="signal-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={pt ? "IPCA, Selic, desemprego…" : "IPCA, Selic, unemployment…"} autoComplete="off" /><kbd>/</kbd></div>
        {query && <div className="signal-search-results" aria-live="polite">
          {results.map((indicator) => <a key={indicator.id} href={localized(locale, `/indicators/${indicator.id}`)}><span><b>{indicator.name}</b><small>{indicator.officialName}</small></span><code>{indicator.unitSymbol}</code></a>)}
          {!results.length && <p>{pt ? "Nenhuma série encontrada." : "No matching series."}</p>}
        </div>}
      </div>
      <div className="signal-hero-links"><a className="signal-button dark" href={localized(locale, "/catalog")}>{pt ? "Explorar todos os dados" : "Explore all data"}<span>↗</span></a><a className="signal-text-link" href={localized(locale, "/docs")}>{pt ? "Começar com a API" : "Start with the API"}<span>→</span></a></div>
    </div>
    <p className="signal-availability"><i aria-hidden="true" /> {pt ? "Dados conectados diretamente ao BCB e IBGE" : "Connected directly to BCB and IBGE"}</p>
  </section>;
}
