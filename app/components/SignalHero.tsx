"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IndicatorDefinition } from "@/lib/domain/types";
import { localized, type Locale } from "@/lib/i18n";

type Point = { date: string; period: string; value: number | null };
type SeriesState = Record<string, { status: "loading" | "ready" | "error"; data?: Point[] }>;

const featured = [
  { id: "br-ipca-12m", short: "IPCA", source: "IBGE", fallback: 4.44, unit: "%" },
  { id: "br-selic-target", short: "Selic", source: "BCB", fallback: 10.5, unit: "%" },
  { id: "br-unemployment-rate", short: "Unemployment", source: "IBGE", fallback: 6.2, unit: "%" },
  { id: "br-ibc-br", short: "IBC-Br", source: "BCB", fallback: 148.7, unit: "" },
] as const;

function startDate(years: number) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function numericValues(data: Point[] | undefined) {
  return (data ?? []).filter((point): point is Point & { value: number } => point.value !== null).slice(-42);
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
    const interval = window.setInterval(() => setActive((current) => (current + 1) % featured.length), 4800);
    return () => window.clearInterval(interval);
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
      context.strokeStyle = "rgba(255,255,255,.22)";
      context.lineWidth = 1;
      for (let row = 1; row < 6; row += 1) {
        context.beginPath();
        context.moveTo(0, (height / 6) * row + .5);
        context.lineTo(width, (height / 6) * row + .5);
        context.stroke();
      }
      featured.slice(0, 3).forEach((item, index) => {
        const points = numericValues(series[item.id]?.data);
        const values = points.length > 1 ? points.map((point) => point.value) : Array.from({ length: 24 }, (_, point) => Math.sin(point * .45 + index) * 3 + point * .08);
        const low = Math.min(...values);
        const high = Math.max(...values);
        const span = high - low || 1;
        const reveal = Math.min(1, frame / (50 + index * 16));
        const count = Math.max(2, Math.floor(values.length * reveal));
        context.beginPath();
        values.slice(0, count).forEach((value, pointIndex) => {
          const x = (pointIndex / (values.length - 1)) * (width + 80) - 40;
          const normalized = (value - low) / span;
          const y = height * (.3 + index * .18) - normalized * height * .2 + Math.sin(frame * .012 + index) * 2;
          if (pointIndex === 0) context.moveTo(x, y); else context.lineTo(x, y);
        });
        context.strokeStyle = index === active % 3 ? "rgba(255,255,255,.98)" : "rgba(255,255,255,.38)";
        context.lineWidth = index === active % 3 ? 2.2 : 1;
        context.stroke();
      });
      frame += 1;
      animation = window.requestAnimationFrame(draw);
    };
    draw();
    return () => window.cancelAnimationFrame(animation);
  }, [active, series]);

  const current = featured[active];
  const currentPoints = numericValues(series[current.id]?.data);
  const latest = currentPoints.at(-1);
  const previous = currentPoints.at(-2);
  const value = latest?.value ?? current.fallback;
  const movement = latest && previous ? latest.value - previous.value : 0;

  const moveField = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - .5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - .5) * 2;
    event.currentTarget.style.setProperty("--field-x", x.toFixed(3));
    event.currentTarget.style.setProperty("--field-y", y.toFixed(3));
  };

  return <section className="signal-hero">
    <div className="signal-hero-copy">
      <p className="signal-eyebrow">{pt ? "A CAMADA ABERTA PARA DADOS OFICIAIS" : "THE OPEN LAYER FOR OFFICIAL DATA"}</p>
      <h1>{pt ? <>Dados oficiais,<br />feitos para <span>fluir.</span></> : <>Official data,<br />made to <span>flow.</span></>}</h1>
      <div className="signal-hero-intro">
        <p>{pt ? "Descubra, entenda e use dados econômicos e financeiros por meio de uma API consistente." : "Discover, understand, and use economic and financial data through one consistent API."}</p>
        <div className="signal-hero-actions"><a className="signal-button dark" href={localized(locale, "/catalog")}>{pt ? "Explorar dados" : "Explore data"}<span>↗</span></a><a className="signal-text-link" href={localized(locale, "/docs")}>{pt ? "Começar a construir" : "Start building"}<span>→</span></a></div>
      </div>
    </div>

    <div className="economic-field" onPointerMove={moveField} style={{ "--field-x": "0", "--field-y": "0" } as CSSProperties}>
      <div className="field-color" aria-hidden="true"><i /><i /><i /></div>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="field-coordinate" aria-hidden="true">23°33′S<br />46°38′W</div>
      <div className="field-value" key={current.id}>
        <span>{current.short}</span>
        <strong>{value.toLocaleString(locale, { maximumFractionDigits: 2 })}{current.unit}</strong>
        <small>{latest?.period ?? (pt ? "última observação" : "latest observation")} · {movement > 0 ? "+" : ""}{movement.toFixed(2)}</small>
      </div>
      <div className="field-source">{pt ? "FONTE OFICIAL" : "OFFICIAL SOURCE"}<b>{current.source}</b></div>
      <div className="field-index" aria-label={pt ? "Escolher série em destaque" : "Choose featured series"}>
        {featured.map((item, index) => <button className={active === index ? "active" : ""} key={item.id} onClick={() => setActive(index)} aria-label={item.short}><i />{item.short}</button>)}
      </div>
      <div className="field-document" aria-hidden="true"><span>OPEN ECONOMICS / SERIES 001</span><b>{current.id}</b><i /><i /><small>Observation stream<br />Normalized · Traceable · Open</small></div>
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
