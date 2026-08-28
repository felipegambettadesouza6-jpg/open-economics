"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DataChart } from "@/app/components/DataChart";
import { localized, type Locale } from "@/lib/i18n";

type DiscoveryItem = {
  id: string;
  name: string;
  officialName: string;
  description: string;
  sourceAgency: string;
  unitSymbol: string;
  aliases: string[];
};

type Point = { date: string; period: string; value: number | null };

export function HomeDiscovery({ items, locale }: { items: DiscoveryItem[]; locale: Locale }) {
  const pt = locale === "pt-br";
  const scenarios = useMemo(() => pt ? [
    { query: "inflação", id: "br-ipca-monthly", state: "priorizando séries de preços" },
    { query: "selic", id: "br-selic-target", state: "comparando taxas oficiais" },
    { query: "desemprego", id: "br-unemployment-rate", state: "entendendo o mercado de trabalho" },
  ] : [
    { query: "inflation", id: "br-ipca-monthly", state: "ranking official price series" },
    { query: "selic", id: "br-selic-target", state: "comparing official rates" },
    { query: "unemployment", id: "br-unemployment-rate", state: "understanding the labor market" },
  ], [pt]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [userEdited, setUserEdited] = useState(false);
  const [visible, setVisible] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting">("typing");
  const results = useMemo(() => {
    const tokens = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return items.map((item) => {
      const text = [item.name, item.officialName, item.description, item.id, ...item.aliases].join(" ").toLocaleLowerCase();
      const score = tokens.reduce((total, token) => total + (text.includes(token) ? 1 : 0), 0);
      return { item, score };
    }).filter(({ score }) => !tokens.length || score === tokens.length).sort((a, b) => b.score - a.score).slice(0, 5).map(({ item }) => item);
  }, [items, query]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeSelection = userEdited ? selectedId : scenarios[scenarioIndex].id;
  const selected = results.find((item) => item.id === activeSelection) ?? results[0] ?? items[0];
  const [data, setData] = useState<Point[] | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: .3 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || userEdited) return;
    const target = scenarios[scenarioIndex].query;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      queueMicrotask(() => setQuery(target));
      return;
    }
    if (phase === "typing") {
      if (query.length < target.length) {
        const timer = window.setTimeout(() => setQuery(target.slice(0, query.length + 1)), query.length ? 68 : 420);
        return () => window.clearTimeout(timer);
      }
      const timer = window.setTimeout(() => setPhase("holding"), 950);
      return () => window.clearTimeout(timer);
    }
    if (phase === "holding") {
      const timer = window.setTimeout(() => setPhase("deleting"), 1500);
      return () => window.clearTimeout(timer);
    }
    if (query.length) {
      const timer = window.setTimeout(() => setQuery(query.slice(0, -1)), 34);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setScenarioIndex((current) => (current + 1) % scenarios.length);
      setPhase("typing");
    }, 120);
    return () => window.clearTimeout(timer);
  }, [phase, query, scenarioIndex, scenarios, userEdited, visible]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    queueMicrotask(() => setData(null));
    fetch(`/api/v1/indicators/${selected.id}/observations?order=desc&limit=36`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ data: Point[] }> : Promise.reject(new Error()))
      .then(({ data: observations }) => setData([...observations].reverse()))
      .catch((error: Error) => { if (error.name !== "AbortError") setData([]); });
    return () => controller.abort();
  }, [selected]);

  const latest = data?.filter((point) => point.value !== null).at(-1);
  return <div className="home-discovery-tool" ref={rootRef}>
    <div className="home-discovery-search"><span className="data-search-mark" aria-hidden="true" /><input aria-label={pt ? "Buscar o catálogo" : "Search the catalog"} value={query} onChange={(event) => { setUserEdited(true); setQuery(event.target.value); }} /><kbd>/</kbd><small aria-live="polite"><i />{userEdited ? `${results.length} ${pt ? "resultados" : "results"}` : scenarios[scenarioIndex].state}</small></div>
    <div className="home-discovery-body">
      <div className="home-discovery-results">{results.map((item, index) => <button className={selected?.id === item.id ? "active" : ""} type="button" onClick={() => { setUserEdited(true); setSelectedId(item.id); }} key={item.id}><span>0{index + 1}</span><b>{item.name}</b><small>{item.sourceAgency}</small><i>→</i></button>)}{!results.length && <p>{pt ? "Tente um conceito, sigla ou código oficial." : "Try a concept, acronym, or official code."}</p>}</div>
      {selected && <div className="home-discovery-preview"><div><span>{selected.sourceAgency} · {selected.id}</span><strong>{latest?.value?.toLocaleString(locale, { maximumFractionDigits: 2 }) ?? "—"}<i>{selected.unitSymbol}</i></strong><small>{latest?.period ?? (pt ? "Buscando observação oficial" : "Fetching official observation")}</small></div>{data && data.length > 1 ? <DataChart data={data} unit={selected.unitSymbol} decimals={2} compact /> : <div className="discovery-loading">{pt ? "Carregando histórico…" : "Loading history…"}</div>}<a href={localized(locale, `/indicators/${selected.id}`)}>{pt ? "Abrir ficha da série" : "Open data sheet"}<span>↗</span></a></div>}
    </div>
  </div>;
}
