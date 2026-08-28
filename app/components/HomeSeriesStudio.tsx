"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/app/components/CopyButton";
import { DataChart } from "@/app/components/DataChart";
import { localized, type Locale } from "@/lib/i18n";

type Observation = { date: string; period: string; value: number | null };

function yearsAgo(years: number) {
  const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() - years); return date.toISOString().slice(0, 10);
}

export function HomeSeriesStudio({ locale }: { locale: Locale }) {
  const pt = locale === "pt-br";
  const [years, setYears] = useState(5);
  const [data, setData] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const start = useMemo(() => yearsAgo(years), [years]);
  const request = `/api/v1/indicators/br-ipca-12m/observations?start=${start}&order=asc`;
  useEffect(() => {
    const controller = new AbortController(); queueMicrotask(() => setLoading(true));
    fetch(request, { signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ data: Observation[] }>; }).then((body) => setData(body.data)).catch(() => setData([])).finally(() => setLoading(false));
    return () => controller.abort();
  }, [request]);
  const latest = data.filter((item) => item.value !== null).at(-1);
  return <div className="home-studio">
    <div className="home-studio-head"><div><span>IPCA · 12M</span><small>IBGE / SIDRA</small></div><strong>{latest?.value?.toLocaleString(locale, { maximumFractionDigits: 2 }) ?? "—"}<small>%</small></strong></div>
    <div className="home-studio-controls"><span>{pt ? "Histórico" : "History"}</span><div>{[1, 5, 10].map((value) => <button className={years === value ? "active" : ""} onClick={() => setYears(value)} type="button" key={value}>{value}Y</button>)}</div></div>
    <div className="home-studio-chart">{loading ? <div className="studio-loading">{pt ? "Buscando observações oficiais…" : "Fetching official observations…"}</div> : data.length > 1 ? <DataChart data={data} unit="%" decimals={2} locale={locale} /> : <div className="studio-loading">{pt ? "Fonte temporariamente indisponível" : "Source temporarily unavailable"}</div>}</div>
    <div className="home-request"><div><span><b>GET</b>{request}</span><CopyButton value={request} label={pt ? "Copiar" : "Copy"} successLabel={pt ? "Copiado" : "Copied"} /></div><pre><code>const response = await fetch(&quot;{request}&quot;);{`\n`}const &#123; data, meta &#125; = await response.json();</code></pre><a href={localized(locale, "/playground?indicator=br-ipca-12m")}>{pt ? "Abrir requisição real" : "Open the live request"}<span>↗</span></a></div>
  </div>;
}
