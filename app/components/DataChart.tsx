"use client";

import { useState } from "react";

interface ChartObservation {
  date: string;
  value: number | null;
}

function formatValue(value: number, decimals: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: Math.min(decimals, 1),
  }).format(value);
}

export function DataChart({
  data,
  unit,
  decimals,
  compact = false,
}: {
  data: ChartObservation[];
  unit: string;
  decimals: number;
  compact?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const valid = data.filter((item): item is ChartObservation & { value: number } => item.value !== null);
  if (valid.length < 2) {
    return <div className="chart-empty">Not enough observations for a chart.</div>;
  }

  const width = 760;
  const height = compact ? 188 : 300;
  const padding = compact
    ? { top: 12, right: 12, bottom: 25, left: 12 }
    : { top: 18, right: 18, bottom: 38, left: 58 };
  const values = valid.map((item) => item.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.1, 1);
  const min = rawMin - spread * 0.08;
  const max = rawMax + spread * 0.08;
  const x = (index: number) =>
    padding.left + (index / Math.max(data.length - 1, 1)) * (width - padding.left - padding.right);
  const y = (value: number) =>
    padding.top + ((max - value) / (max - min)) * (height - padding.top - padding.bottom);

  const segments: string[] = [];
  let current = "";
  data.forEach((item, index) => {
    if (item.value === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    const command = current ? "L" : "M";
    current += `${command}${x(index).toFixed(2)},${y(item.value).toFixed(2)} `;
  });
  if (current) segments.push(current);

  const ticks = [0, 0.5, 1].map((fraction) => {
    const value = max - (max - min) * fraction;
    return { value, y: padding.top + (height - padding.top - padding.bottom) * fraction };
  });
  const dateTicks = [data[0], data[Math.floor((data.length - 1) / 2)], data.at(-1)!];
  const active = activeIndex === null ? null : data[activeIndex];

  function moveSelection(delta: number) {
    setActiveIndex((current) => Math.max(0, Math.min(data.length - 1, (current ?? data.length - 1) + delta)));
  }

  return (
    <svg
      className={compact ? "data-chart compact" : "data-chart"}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Time-series chart from ${data[0].date} to ${data.at(-1)!.date}, measured in ${unit}`}
      preserveAspectRatio="none"
      tabIndex={0}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        setActiveIndex(Math.round(ratio * (data.length - 1)));
      }}
      onPointerLeave={() => setActiveIndex(null)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); moveSelection(-1); }
        if (event.key === "ArrowRight") { event.preventDefault(); moveSelection(1); }
        if (event.key === "Escape") setActiveIndex(null);
      }}
    >
      {!compact &&
        ticks.map((tick) => (
          <g key={tick.y}>
            <line x1={padding.left} x2={width - padding.right} y1={tick.y} y2={tick.y} className="chart-gridline" />
            <text x={padding.left - 10} y={tick.y + 4} textAnchor="end" className="chart-axis-label">
              {formatValue(tick.value, decimals)}
            </text>
          </g>
        ))}
      {segments.map((path, index) => (
        <path className="chart-line" d={path} fill="none" pathLength="1" key={index} vectorEffect="non-scaling-stroke" />
      ))}
      {active && active.value !== null && <g className="chart-crosshair">
        <line x1={x(activeIndex!)} x2={x(activeIndex!)} y1={padding.top} y2={height - padding.bottom} vectorEffect="non-scaling-stroke" />
        <circle cx={x(activeIndex!)} cy={y(active.value)} r={compact ? 4 : 5} vectorEffect="non-scaling-stroke" />
        {!compact && <g className="chart-tooltip" transform={`translate(${Math.min(width - 150, Math.max(66, x(activeIndex!) - 70))},${Math.max(8, y(active.value) - 62)})`}><rect width="140" height="48" /><text x="10" y="18">{active.date}</text><text className="chart-tooltip-value" x="10" y="36">{formatValue(active.value, decimals)} {unit}</text></g>}
      </g>}
      {dateTicks.map((item, index) => (
        <text
          key={`${item.date}-${index}`}
          x={x(index === 0 ? 0 : index === 1 ? Math.floor((data.length - 1) / 2) : data.length - 1)}
          y={height - 7}
          textAnchor={index === 0 ? "start" : index === 2 ? "end" : "middle"}
          className="chart-axis-label"
        >
          {item.date.slice(0, 7)}
        </text>
      ))}
    </svg>
  );
}
