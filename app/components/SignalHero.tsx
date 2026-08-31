"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchTelemetry } from "@/app/components/Telemetry";
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

const rasterColors = {
  coral: [205, 78, 65],
  blue: [72, 116, 137],
  sand: [151, 119, 62],
  clay: [122, 74, 66],
} as const;

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
  const activeRef = useRef(0);
  const transitionRef = useRef(false);
  const transitionTimersRef = useRef<number[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(true);
  const [fieldPhase, setFieldPhase] = useState<"settled" | "leaving" | "arriving">("settled");
  const [series, setSeries] = useState<SeriesState>(() => Object.fromEntries(featured.map((item) => [item.id, { status: "loading" }])));
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return indicators.filter((indicator) => [indicator.name, indicator.officialName, indicator.id, ...indicator.aliases].join(" ").toLocaleLowerCase().includes(needle)).slice(0, 5);
  }, [indicators, query]);
  useSearchTelemetry({ surface: "hero", query, results: results.length, locale });

  const changeSeries = useCallback((next: number) => {
    if (next === activeRef.current || transitionRef.current) return;
    transitionRef.current = true;
    setFieldPhase("leaving");
    const swapTimer = window.setTimeout(() => {
      activeRef.current = next;
      setActive(next);
      setFieldPhase("arriving");
    }, 220);
    const settleTimer = window.setTimeout(() => setFieldPhase("settled"), 660);
    const unlockTimer = window.setTimeout(() => { transitionRef.current = false; }, 720);
    transitionTimersRef.current.push(swapTimer, settleTimer, unlockTimer);
  }, []);

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
    if (query || !autoPlaying || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => changeSeries((activeRef.current + 1) % featured.length), 7200);
    return () => window.clearInterval(interval);
  }, [autoPlaying, changeSeries, query]);

  useEffect(() => () => transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

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
  const currentPoints = useMemo(() => numericValues(series[current.id]?.data), [current.id, series]);
  const fallbackPoints = useMemo(() => Array.from({ length: 42 }, (_, index) => ({
    date: `${2023 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`,
    period: `${2023 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
    value: current.fallback + Math.sin(index * .46 + active) * (active === 3 ? 2.8 : .55) + index * .012,
  })), [active, current.fallback]);
  const plotted = useMemo(() => currentPoints.length > 1 ? currentPoints : fallbackPoints, [currentPoints, fallbackPoints]);
  const values = plotted.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animation = 0;
    const started = performance.now();

    const draw = (timestamp = performance.now()) => {
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
      const [red, green, blue] = rasterColors[current.tone];
      const cell = width < 620 ? 7 : 8;
      const chartTop = height * .17;
      const chartHeight = height * .64;
      const reveal = Math.min(1, (timestamp - started) / 880);
      const easedReveal = 1 - Math.pow(1 - reveal, 3);
      for (let cellX = 0; cellX < width; cellX += cell) {
        const xRatio = cellX / Math.max(width, 1);
        const sourcePosition = xRatio * (plotted.length - 1);
        const sourceIndex = Math.min(plotted.length - 2, Math.max(0, Math.floor(sourcePosition)));
        const mix = sourcePosition - sourceIndex;
        const interpolated = plotted[sourceIndex].value * (1 - mix) + plotted[sourceIndex + 1].value * mix;
        const lineY = chartTop + (1 - (interpolated - low) / span) * chartHeight;
        const edgeFade = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, xRatio))), .72);
        for (let cellY = 0; cellY < height; cellY += cell) {
          const distance = Math.abs(cellY + cell / 2 - lineY);
          const ribbon = Math.exp(-Math.pow(distance / (height * .115), 2) * 1.7);
          const material = .72 + Math.sin(cellX * .047 + cellY * .021 + active * 1.9) * .18;
          const density = ribbon * edgeFade * material;
          const stepped = Math.floor(density * 6) / 6;
          if (stepped < .12) continue;
          const arrival = .18 + easedReveal * .82;
          context.fillStyle = `rgba(${red},${green},${blue},${((.025 + stepped * .31) * arrival).toFixed(3)})`;
          context.fillRect(cellX + 1, cellY + 1, cell - 2, cell - 2);
        }
      }
      context.strokeStyle = "rgba(17,17,17,.075)";
      context.lineWidth = 1;
      for (let row = 0; row <= 4; row += 1) {
        const gridY = chartTop + chartHeight * row / 4;
        context.beginPath(); context.moveTo(0, gridY + .5); context.lineTo(width, gridY + .5); context.stroke();
      }
      for (let column = 0; column <= 6; column += 1) {
        const gridX = width * column / 6;
        context.beginPath(); context.moveTo(gridX + .5, chartTop); context.lineTo(gridX + .5, chartTop + chartHeight); context.stroke();
      }
      context.lineCap = "round";
      context.lineJoin = "round";
      const count = plotted.length;
      context.beginPath();
      plotted.slice(0, count).forEach((point, index) => {
        const x = (index / Math.max(plotted.length - 1, 1)) * width;
        const normalized = (point.value - low) / span;
        const y = chartTop + (1 - normalized) * chartHeight;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.strokeStyle = "#111";
      context.lineWidth = 2.15;
      context.globalAlpha = .18 + easedReveal * .82;
      context.stroke();
      const lastIndex = count - 1;
      const lastPoint = plotted[lastIndex];
      if (lastPoint) {
        const x = (lastIndex / Math.max(plotted.length - 1, 1)) * width;
        const y = chartTop + (1 - (lastPoint.value - low) / span) * chartHeight;
        context.beginPath();
        context.arc(x, y, 3.5, 0, Math.PI * 2);
        context.fillStyle = "#111";
        context.fill();
      }
      context.globalAlpha = 1;
      if (reveal < 1) animation = window.requestAnimationFrame(draw);
    };
    draw();
    return () => window.cancelAnimationFrame(animation);
  }, [active, current.tone, high, low, plotted, span]);

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
        <p>{pt ? "Uma interface consistente para produtos que combinam séries do Banco Central e do IBGE." : "One consistent interface for products that combine Central Bank and IBGE series."}</p>
        <div className="signal-hero-actions"><a className="signal-button dark" href={localized(locale, "/catalog")}>{pt ? "Explorar dados" : "Explore data"}<span>↗</span></a><a className="signal-text-link" href={localized(locale, "/docs")}>{pt ? "Começar a construir" : "Start building"}<span>→</span></a></div>
      </div>
    </div>

    <div className={`economic-field field-phase-${fieldPhase} ${autoPlaying ? "is-playing" : "is-paused"}`} onPointerMove={moveField} style={{ "--field-x": "0", "--field-y": "0" } as CSSProperties}>
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
        {featured.map((item, index) => <button className={active === index ? "active" : ""} key={item.id} onClick={() => { setAutoPlaying(false); changeSeries(index); }} aria-label={item.short} aria-pressed={active === index}><span>0{index + 1}</span>{item.short}<i>{item.source}</i></button>)}
        <button className="field-autoplay" type="button" onClick={() => setAutoPlaying((playing) => !playing)} aria-label={autoPlaying ? (pt ? "Pausar rotação das séries" : "Pause series rotation") : (pt ? "Retomar rotação das séries" : "Resume series rotation")}><span aria-hidden="true">{autoPlaying ? "Ⅱ" : "▶"}</span></button>
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
