"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";

const records = [
  {
    format: "JSON",
    publisher: "BCB · SGS 432",
    raw: ['"data": "23/08/2026"', '"valor": "15.00"'],
    id: "br-selic-target",
    date: "2026-08-23",
    period: "2026-08-23",
    value: "15.00",
    unit: "% p.a.",
    source: "BCB",
  },
  {
    format: "CSV",
    publisher: "IBGE · SIDRA 7060",
    raw: ["periodo;variavel;valor", "202607;63;0.07"],
    id: "br-ipca-monthly",
    date: "2026-07-01",
    period: "2026-07",
    value: "0.07",
    unit: "%",
    source: "IBGE",
  },
  {
    format: "SERIES",
    publisher: "BCB · SGS 24364",
    raw: ["ref=202606", "code=24364 · value=148.70"],
    id: "br-ibc-br",
    date: "2026-06-01",
    period: "2026-06",
    value: "148.70",
    unit: "index",
    source: "BCB",
  },
] as const;

export function NormalizationScene({ locale }: { locale: Locale }) {
  const pt = locale === "pt-br";
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .35 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => setActive((current) => (current + 1) % records.length), 2600);
    return () => window.clearInterval(interval);
  }, [visible]);

  const record = records[active];

  return <div className="normalization-scene" ref={rootRef}>
    <div className="normalization-stage-head">
      <span>{pt ? "ESTRUTURAS DE ORIGEM" : "UPSTREAM STRUCTURES"}</span>
      <span>{pt ? "CONTRATO NORMALIZADO" : "NORMALIZED CONTRACT"}</span>
    </div>
    <div className="normalization-stage">
      <div className="normalization-inputs">
        {records.map((item, index) => <button className={active === index ? "active" : ""} type="button" onClick={() => setActive(index)} key={item.id}>
          <span><i>{item.format}</i>{item.publisher}</span>
          <code>{item.raw.map((line) => <b key={line}>{line}</b>)}</code>
        </button>)}
      </div>
      <div className="normalization-lane" aria-hidden="true">
        <span>{pt ? "NORMALIZAR" : "NORMALIZE"}</span>
        <i key={active} />
        <b>→</b>
      </div>
      <div className="normalization-output" key={record.id}>
        <header><span>Open Economics</span><b>200 · observed</b></header>
        <dl>
          <div><dt>id</dt><dd>{record.id}</dd></div>
          <div><dt>date</dt><dd>{record.date}</dd></div>
          <div><dt>period</dt><dd>{record.period}</dd></div>
          <div><dt>value</dt><dd>{record.value}</dd></div>
          <div><dt>unit</dt><dd>{record.unit}</dd></div>
          <div><dt>source</dt><dd>{record.source}</dd></div>
        </dl>
        <footer><span>raw_value preserved</span><span>provenance linked</span></footer>
      </div>
    </div>
    <div className="normalization-schema"><span>date</span><span>period</span><span>value</span><span>raw_value</span><span>status</span><span>provenance</span></div>
  </div>;
}
