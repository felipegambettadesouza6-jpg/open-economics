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

  return (
    <svg
      className={compact ? "data-chart compact" : "data-chart"}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Time-series chart from ${data[0].date} to ${data.at(-1)!.date}, measured in ${unit}`}
      preserveAspectRatio="none"
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
        <path className="chart-line" d={path} fill="none" key={index} vectorEffect="non-scaling-stroke" />
      ))}
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

