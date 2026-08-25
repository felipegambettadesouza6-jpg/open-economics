"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IndicatorDefinition } from "@/lib/domain/types";
import { localized, type Locale } from "@/lib/i18n";

type Point = { date: string; period: string; value: number | null };
type SeriesState = Record<string, { status: "loading" | "ready" | "error"; data?: Point[] }>;

const featured = [
  { id: "br-ipca-12m", short: "IPCA", source: "IBGE", fallback: 4.44, unit: "%", tone: "coral" },
  { id: "br-selic-target", short: "Selic", source: "BCB", fallback: 10.5, unit: "%", tone: "blue" },
  { id: "br-unemployment-rate", short: "Unemployment", source: "IBGE", fallback: 6.2, unit: "%", tone: "sand" },
  { id: "br-ibc-br", short: "IBC-Br", source: "BCB", fallback: 148.7, unit: "", tone: "clay" },
] as const;

function startDate(years: number) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function numericValues(data: Point[] | undefined) {
  return (data ?? []).filter((point): point is Point & { value: number } => point.value !== null).slice(-56);
}

export function SignalHero({ indicators, locale }: { indicators: IndicatorDefinition[]; locale: Locale }) {
  const pt = locale === "pt-br";
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [series, setSeries] = useState<SeriesState>(() => Object.fromEntries(featured.map((item) => [item.id, { status: "loading" }])));
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return indicators.filter((indicator) => [indicator.name, indicator.officialName, indicator.id, ...indicator.aliases].join(" ").toLocaleLowerCase().includes(needle)).slice(0, 5);
  }, [indicators, query]);

  useEffect(() => {
    const controller = new AbortController();
    featured.forEach((item) => {
      fetch(`/api/v1/indicators/${item.id}/observations?start=${startDate(item.id === "br-ibc-br" ? 5 : 3)}&order=asc`, { signal: controller.signal })
        .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ data: Point[] }>; })
        .then(({ data }) => setSeries((current) => ({ ...current, [item.id]: { status: "ready", data } })))
        .catch((error: Error) => { if (error.name !== "AbortError") setSeries((current) => ({ ...current, [item.id]: { status: "error" } })); });
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (query) return;
    const interval = window.setInterval(() => setActive((current) => (current + 1) % featured.length), 6200);
    return () => window.clearInterval(interval);
  }, [query]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const current = featured[active];
  const currentPoints = numericValues(series[current.id]?.data);
  const fallbackPoints = Array.from({ length: 42 }, (_, index) => ({
    date: `${2023 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`,
    period: `${2023 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
    value: current.fallback + Math.sin(index * .46 + active) * (active === 3 ? 2.8 : .55) + index * .012,
  }));
  const plotted = currentPoints.length > 1 ? currentPoints : fallbackPoints;
  const values = plotted.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let animation = 0;

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(bounds.width * ratio) || canvas.height !== Math.round(bounds.height * ratio)) {
        canvas.width = Math.round(bounds.width * ratio);
        canvas.height = Math.round(bounds.height * ratio);
      }
      const width = bounds.width;
      const height = bounds.height;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      context.lineJoin = "round";
      const reveal = Math.min(1, frame / 62);
      const count = Math.max(2, Math.floor(plotted.length * reveal));
      context.beginPath();
      plotted.slice(0, count).forEach((point, index) => {
        const x = (index / Math.max(plotted.length - 1, 1)) * width;
        const normalized = (point.value - low) / span;
        const y = height * .14 + (1 - normalized) * height * .69;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.strokeStyle = "#111";
      context.lineWidth = 2.15;
      context.stroke();
      const lastIndex = count - 1;
      const lastPoint = plotted[lastIndex];
      if (lastPoint) {
        const x = (lastIndex / Math.max(plotted.length - 1, 1)) * width;
        const y = height * .14 + (1 - (lastPoint.value - low) / span) * height * .69;
        context.beginPath();
        context.arc(x, y, 3.5, 0, Math.PI * 2);
        context.fillStyle = "#111";
        context.fill();
      }
      frame += 1;
      if (reveal < 1) animation = window.requestAnimationFrame(draw);
    };
    draw();
    return () => window.cancelAnimationFrame(animation);
  }, [active, high, low, plotted, span]);

  const latest = currentPoints.at(-1);
  const previous = currentPoints.at(-2);
  const value = latest?.value ?? current.fallback;
  const movement = latest && previous ? latest.value - previous.value : 0;
  const tickTop = high.toLocaleString(locale, { maximumFractionDigits: 2 });
  const tickMiddle = ((high + low) / 2).toLocaleString(locale, { maximumFractionDigits: 2 });
  const tickBottom = low.toLocaleString(locale, { maximumFractionDigits: 2 });
  const firstPeriod = plotted[0]?.period ?? "2023-01";
  const middlePeriod = plotted[Math.floor(plotted.length / 2)]?.period ?? "2024-07";
  const lastPeriod = plotted.at(-1)?.period ?? "2026-07";

  const moveField = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - .5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - .5) * 2;
    event.currentTarget.style.setProperty("--field-x", x.toFixed(3));
    event.currentTarget.style.setProperty("--field-y", y.toFixed(3));
  };

  return <section className={`signal-hero hero-tone-${current.tone}`}>
    <div className="signal-hero-copy">
      <p className="signal-eyebrow">{pt ? "A CAMADA ABERTA PARA DADOS OFICIAIS" : "THE OPEN LAYER FOR OFFICIAL DATA"}</p>
      <h1>{pt ? <>Dados oficiais,<br />feitos para <span>fluir.</span></> : <>Official data,<br />made to <span>flow.</span></>}</h1>
      <div className="signal-hero-intro">
        <p>{pt ? "Descubra, entenda e use dados econômicos e financeiros por meio de uma API consistente." : "Discover, understand, and use economic and financial data through one consistent API."}</p>
        <div className="signal-hero-actions"><a className="signal-button dark" href={localized(locale, "/catalog")}>{pt ? "Explorar dados" : "Explore data"}<span>↗</span></a><a className="signal-text-link" href={localized(locale, "/docs")}>{pt ? "Começar a construir" : "Start building"}<span>→</span></a></div>
      </div>
    </div>

    <div className="economic-field" onPointerMove={moveField} style={{ "--field-x": "0", "--field-y": "0" } as CSSProperties}>
      <div className="field-raster" aria-hidden="true" />
      <div className="field-grid" aria-hidden="true" />
      <canvas ref={canvasRef} aria-label={`${current.short} historical series`} />
      <div className="field-axis-y" aria-hidden="true"><span>{tickTop}</span><span>{tickMiddle}</span><span>{tickBottom}</span></div>
      <div className="field-axis-x" aria-hidden="true"><span>{firstPeriod}</span><span>{middlePeriod}</span><span>{lastPeriod}</span></div>
      <div className="field-value" key={current.id}>
        <span>{current.short} · {current.source}</span>
        <strong>{value.toLocaleString(locale, { maximumFractionDigits: 2 })}<i>{current.unit}</i></strong>
        <small>{latest?.period ?? (pt ? "última observação" : "latest observation")} · {movement > 0 ? "+" : ""}{movement.toFixed(2)}</small>
      </div>
      <div className="field-series-id"><span>{pt ? "ID ESTÁVEL" : "STABLE SERIES ID"}</span><code>{current.id}</code></div>
      <div className="field-provenance"><span>{pt ? "FONTE OFICIAL" : "OFFICIAL SOURCE"}</span><b>{current.source}</b><small>{pt ? "unidade e período preservados" : "unit and period preserved"}</small></div>
      <div className="field-index" aria-label={pt ? "Escolher série em destaque" : "Choose featured series"}>
        {featured.map((item, index) => <button className={active === index ? "active" : ""} key={item.id} onClick={() => setActive(index)} aria-label={item.short}><span>0{index + 1}</span>{item.short}<i>{item.source}</i></button>)}
      </div>
    </div>

    <div className={`signal-search ${query ? "is-open" : ""}`}>
      <label htmlFor="signal-search">{pt ? "Buscar indicadores" : "Search indicators"}</label>
      <div className="signal-search-input"><span>{pt ? "Encontre qualquer série" : "Find any series"}</span><input ref={inputRef} id="signal-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={pt ? "IPCA, Selic, desemprego…" : "IPCA, Selic, unemployment…"} autoComplete="off" /><kbd>/</kbd><b aria-hidden="true">↗</b></div>
      {query && <div className="signal-search-results" aria-live="polite">
        {results.map((indicator) => <a key={indicator.id} href={localized(locale, `/indicators/${indicator.id}`)}><span><b>{indicator.name}</b><small>{indicator.officialName}</small></span><code>{indicator.unitSymbol}</code></a>)}
        {!results.length && <p>{pt ? "Nenhuma série encontrada." : "No matching series."}</p>}
      </div>}
    </div>
  </section>;
}
