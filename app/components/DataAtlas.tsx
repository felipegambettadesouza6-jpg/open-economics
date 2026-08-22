"use client";

import { useEffect, useRef, useState } from "react";
import { localized, type Locale } from "@/lib/i18n";

type Point = { date: string; period: string; value: number | null };

const chapters = [
  { id: "br-ipca-12m", code: "IPCA", source: "IBGE", unit: "%", fallback: 4.44, tone: "coral" },
  { id: "br-selic-target", code: "SELIC", source: "BCB", unit: "%", fallback: 10.5, tone: "blue" },
  { id: "br-unemployment-rate", code: "PNAD", source: "IBGE", unit: "%", fallback: 6.2, tone: "lime" },
] as const;

export function DataAtlas({ locale }: { locale: Locale }) {
  const pt = locale === "pt-br";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(0);
  const [data, setData] = useState<Record<string, Point[]>>({});
  const chapter = chapters[active];

  useEffect(() => {
    const controller = new AbortController();
    chapters.forEach((item) => {
      fetch(`/api/v1/indicators/${item.id}/observations?start=2019-01-01&order=asc`, { signal: controller.signal })
        .then(async (response) => response.ok ? response.json() as Promise<{ data: Point[] }> : Promise.reject(new Error()))
        .then((result) => setData((current) => ({ ...current, [item.id]: result.data })))
        .catch((error: Error) => { if (error.name !== "AbortError") setData((current) => ({ ...current, [item.id]: [] })); });
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const source = (data[chapter.id] ?? []).filter((point): point is Point & { value: number } => point.value !== null).slice(-72);
    const values = source.length > 1 ? source.map((point) => point.value) : Array.from({ length: 48 }, (_, index) => Math.sin(index * .24 + active) * 6 + index * .12 + 30);
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
      const low = Math.min(...values);
      const high = Math.max(...values);
      const span = high - low || 1;
      const count = Math.max(2, Math.floor(values.length * Math.min(1, progress)));
      const mapped = values.slice(0, count).map((value, index) => ({
        x: (index / (values.length - 1)) * width,
        y: height * .12 + ((high - value) / span) * height * .72,
      }));
      context.beginPath();
      mapped.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.strokeStyle = "#101010";
      context.lineWidth = 2.4;
      context.stroke();
      const last = mapped.at(-1);
      if (last) {
        context.beginPath(); context.arc(last.x, last.y, 5, 0, Math.PI * 2); context.fillStyle = "#101010"; context.fill();
        context.beginPath(); context.arc(last.x, last.y, 10, 0, Math.PI * 2); context.strokeStyle = "rgba(15,15,15,.28)"; context.stroke();
      }
      progress += .022;
      if (progress < 1.05) frame = window.requestAnimationFrame(draw);
    };
    draw();
    return () => window.cancelAnimationFrame(frame);
  }, [active, chapter.id, data]);

  const observations = (data[chapter.id] ?? []).filter((point): point is Point & { value: number } => point.value !== null);
  const latest = observations.at(-1);

  return <div className={`oe-atlas tone-${chapter.tone}`}>
    <div className="oe-atlas-top">
      <div><span>{pt ? "SÉRIE EM FOCO" : "SERIES IN FOCUS"}</span><b>{chapter.code}</b></div>
      <strong>{(latest?.value ?? chapter.fallback).toLocaleString(locale, { maximumFractionDigits: 2 })}<small>{chapter.unit}</small></strong>
      <div><span>{pt ? "OBSERVAÇÃO" : "OBSERVATION"}</span><b>{latest?.period ?? (pt ? "Mais recente" : "Latest")}</b></div>
    </div>
    <div className="oe-atlas-canvas"><canvas ref={canvasRef} aria-label={pt ? `Histórico da série ${chapter.code}` : `${chapter.code} series history`} /></div>
    <div className="oe-atlas-bottom">
      <div className="oe-atlas-tabs">{chapters.map((item, index) => <button className={index === active ? "active" : ""} onClick={() => setActive(index)} key={item.id}><span>0{index + 1}</span>{item.code}<i>{item.source}</i></button>)}</div>
      <a href={localized(locale, `/indicators/${chapter.id}`)}>{pt ? "Abrir série e metodologia" : "Open series and methodology"}<span>↗</span></a>
    </div>
  </div>;
}
