"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { localized, type Locale } from "@/lib/i18n";

type Point = { date: string; period: string; value: number | null };

const chapters = [
  { id: "br-ipca-12m", code: "IPCA", source: "IBGE", unit: "%", tone: "coral" },
  { id: "br-selic-target", code: "SELIC", source: "BCB", unit: "%", tone: "blue" },
  { id: "br-unemployment-rate", code: "PNAD", source: "IBGE", unit: "%", tone: "lime" },
] as const;

const rasterColors = {
  coral: [204, 83, 69],
  blue: [72, 116, 137],
  lime: [147, 118, 62],
} as const;

export function DataAtlas({ locale }: { locale: Locale }) {
  const pt = locale === "pt-br";
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState<"settled" | "leaving" | "arriving">("settled");
  const [data, setData] = useState<Record<string, Point[]>>({});
  const [visible, setVisible] = useState(false);
  const [stale, setStale] = useState<Record<string, boolean>>({});
  const chapter = chapters[active];

  const changeChapter = useCallback((next: number) => {
    if (next === activeRef.current || phase !== "settled") return;
    setPhase("leaving");
    const swap = window.setTimeout(() => {
      activeRef.current = next;
      setActive(next);
      setPhase("arriving");
    }, 280);
    const settle = window.setTimeout(() => setPhase("settled"), 820);
    timersRef.current.push(swap, settle);
  }, [phase]);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: .24 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    chapters.forEach((item) => {
      fetch(`/api/v1/indicators/${item.id}/observations?start=2023-01-01&order=asc`, { signal: controller.signal })
        .then(async (response) => response.ok ? response.json() as Promise<{ data: Point[]; meta?: { stale?: boolean } }> : Promise.reject(new Error()))
        .then((result) => { setData((current) => ({ ...current, [item.id]: result.data })); setStale((current) => ({ ...current, [item.id]: result.meta?.stale === true })); })
        .catch((error: Error) => { if (error.name !== "AbortError") setData((current) => ({ ...current, [item.id]: [] })); });
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const source = (data[chapter.id] ?? []).filter((point): point is Point & { value: number } => point.value !== null).slice(-72);
    const values = source.map((point) => point.value);
    let progress = 0;
    let frame = 0;

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
      if (values.length < 2) return;
      const low = Math.min(...values);
      const high = Math.max(...values);
      const span = high - low || 1;
      const [red, green, blue] = rasterColors[chapter.tone];
      const cell = width < 700 ? 9 : 11;
      for (let cellX = 0; cellX < width; cellX += cell) {
        const xRatio = cellX / Math.max(width, 1);
        const sourcePosition = xRatio * (values.length - 1);
        const sourceIndex = Math.min(values.length - 2, Math.max(0, Math.floor(sourcePosition)));
        const mix = sourcePosition - sourceIndex;
        const interpolated = values[sourceIndex] * (1 - mix) + values[sourceIndex + 1] * mix;
        const lineY = height * .12 + ((high - interpolated) / span) * height * .72;
        const edgeFade = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, xRatio))), .68);
        for (let cellY = 0; cellY < height; cellY += cell) {
          const distance = Math.abs(cellY + cell / 2 - lineY);
          const density = Math.max(0, 1 - distance / (height * .31)) * edgeFade;
          const stepped = Math.floor(density * 6) / 6;
          if (stepped < .04) continue;
          context.fillStyle = `rgba(${red},${green},${blue},${(.05 + stepped * .42).toFixed(3)})`;
          context.fillRect(cellX + 1, cellY + 1, cell - 2, cell - 2);
        }
      }
      context.strokeStyle = "rgba(15,15,15,.12)";
      context.lineWidth = 1;
      for (let column = 0; column <= 8; column += 1) {
        const x = width * column / 8;
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
      }
      for (let row = 0; row <= 4; row += 1) {
        const y = height * row / 4;
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
      }
      const reveal = Math.min(1, progress);
      const mapped = values.map((value, index) => ({
        x: (index / (values.length - 1)) * width,
        y: height * .12 + ((high - value) / span) * height * .72,
      }));
      context.beginPath();
      mapped.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.strokeStyle = "#101010";
      context.lineWidth = 2.4;
      context.globalAlpha = .18 + reveal * .82;
      context.stroke();
      const last = mapped.at(-1);
      if (last) {
        context.beginPath(); context.arc(last.x, last.y, 5, 0, Math.PI * 2); context.fillStyle = "#101010"; context.fill();
        context.beginPath(); context.arc(last.x, last.y, 10, 0, Math.PI * 2); context.strokeStyle = "rgba(15,15,15,.28)"; context.stroke();
      }
      context.globalAlpha = 1;
      progress += .022;
      if (progress < 1.05) frame = window.requestAnimationFrame(draw);
    };
    draw();
    return () => window.cancelAnimationFrame(frame);
  }, [active, chapter.id, chapter.tone, data, visible]);

  const observations = (data[chapter.id] ?? []).filter((point): point is Point & { value: number } => point.value !== null);
  const latest = observations.at(-1);

  const first = observations.at(0);

  return <div className={`oe-atlas tone-${chapter.tone} atlas-phase-${phase}`} ref={rootRef}>
    <div className="oe-atlas-top">
      <div><span>{pt ? "SÉRIE EM FOCO" : "SERIES IN FOCUS"}</span><b>{chapter.code}</b></div>
      <strong key={chapter.id}>{latest?.value?.toLocaleString(locale, { maximumFractionDigits: 2 }) ?? "—"}<small>{chapter.unit}</small></strong>
      <div><span>{pt ? "OBSERVAÇÃO" : "OBSERVATION"}</span><b>{latest?.period ?? (data[chapter.id] ? (pt ? "Indisponível" : "Unavailable") : (pt ? "Consultando…" : "Loading…"))}{stale[chapter.id] ? (pt ? " · snapshot anterior" : " · stale snapshot") : ""}</b></div>
    </div>
    <div className="oe-atlas-canvas"><canvas ref={canvasRef} aria-label={pt ? `Histórico da série ${chapter.code}` : `${chapter.code} series history`} /></div>
    <div className="oe-atlas-axis" aria-hidden="true"><span>{first?.period ?? "—"}</span><span>{chapter.source} · {chapter.id}</span><span>{latest?.period ?? "—"}</span></div>
    <div className="oe-atlas-bottom">
      <div className="oe-atlas-tabs">{chapters.map((item, index) => <button className={index === active ? "active" : ""} onClick={() => changeChapter(index)} aria-pressed={index === active} key={item.id}><span>0{index + 1}</span>{item.code}<i>{item.source}</i></button>)}</div>
      <a href={localized(locale, `/indicators/${chapter.id}`)}>{pt ? "Abrir série e metodologia" : "Open series and methodology"}<span>↗</span></a>
    </div>
  </div>;
}
