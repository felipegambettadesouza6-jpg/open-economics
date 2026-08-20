"use client";

import { useEffect, useMemo, useState } from "react";
import { DataChart } from "@/app/components/DataChart";
import { localized, type Locale } from "@/lib/i18n";

export interface CatalogItem {
  id: string;
  name: string;
  officialName: string;
  description: string;
  category: string;
  categoryName: string;
  frequency: string;
  unitSymbol: string;
  sourceAgency: string;
  seasonalAdjustment: boolean;
  aliases: string[];
  upstreamCode: string;
}

const categoryOptions = [
  ["", "All areas"],
  ["inflation", "Inflation"],
  ["interest-rates", "Interest rates"],
  ["currencies", "Currencies"],
  ["activity", "Economic activity"],
  ["labor", "Labor"],
  ["credit", "Credit"],
  ["fiscal", "Fiscal"],
  ["external", "External sector"],
  ["markets", "Markets"],
];

export function CatalogExplorer({ items, locale = "en" }: { items: CatalogItem[]; locale?: Locale }) {
  const pt = locale === "pt-br";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [frequency, setFrequency] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const [preview, setPreview] = useState<CatalogItem | null>(null);
  const [previewData, setPreviewData] = useState<{ date: string; value: number | null }[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setQuery(params.get("q") ?? ""); setCategory(params.get("category") ?? ""); setSource(params.get("source") ?? ""); setFrequency(params.get("frequency") ?? ""); setAdjustment(params.get("adjustment") ?? ""); setUrlReady(true);
    });
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (category) search.set("category", category);
    if (source) search.set("source", source);
    if (frequency) search.set("frequency", frequency);
    if (adjustment) search.set("adjustment", adjustment);
    const suffix = search.toString();
    const base = localized(locale, "/catalog");
    window.history.replaceState({}, "", suffix ? `${base}?${suffix}` : base);
  }, [query, category, source, frequency, adjustment, locale, urlReady]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const searchText = [
        item.id,
        item.name,
        item.officialName,
        item.description,
        item.categoryName,
        item.sourceAgency,
        item.upstreamCode,
        ...item.aliases,
      ].join(" ").toLowerCase();
      return (
        (!needle || searchText.includes(needle)) &&
        (!category || item.category === category) &&
        (!source || item.sourceAgency === source) &&
        (!frequency || item.frequency === frequency) &&
        (!adjustment || (adjustment === "adjusted") === item.seasonalAdjustment)
      );
    });
  }, [items, query, category, source, frequency, adjustment]);

  const hasFilters = Boolean(query || category || source || frequency || adjustment);

  useEffect(() => {
    if (!preview) { queueMicrotask(() => setPreviewData(null)); return; }
    const controller = new AbortController();
    queueMicrotask(() => setPreviewData(null));
    fetch(`/api/v1/indicators/${preview.id}/observations?order=desc&limit=24`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ data: { date: string; value: number | null }[] }>; })
      .then(({ data }) => setPreviewData([...data].reverse()))
      .catch(() => setPreviewData([]));
    return () => controller.abort();
  }, [preview]);

  return (
    <div className="catalog-explorer">
      <div className="catalog-search-row">
        <label className="search-box">
          <span className="sr-only">{pt ? "Buscar indicadores" : "Search indicators"}</span>
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="IPCA, Selic, unemployment, 433…"
            type="search"
          />
          <kbd>/</kbd>
        </label>
        <a className="button dark" href={localized(locale, "/playground")}>{pt ? "Abrir playground" : "Open playground"} →</a>
      </div>

      <div className="filter-bar" aria-label="Catalog filters">
        <label>
          <span>{pt ? "Tema" : "Topic"}</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>{pt ? "Fonte" : "Source"}</span>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">All sources</option>
            <option value="IBGE">IBGE</option>
            <option value="BCB">BCB</option>
          </select>
        </label>
        <label>
          <span>{pt ? "Frequência" : "Frequency"}</span>
          <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
            <option value="">All frequencies</option>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </label>
        <label>
          <span>{pt ? "Ajuste" : "Adjustment"}</span>
          <select value={adjustment} onChange={(event) => setAdjustment(event.target.value)}>
            <option value="">{pt ? "Todos" : "All"}</option><option value="adjusted">{pt ? "Ajustado" : "Adjusted"}</option><option value="raw">{pt ? "Não ajustado" : "Not adjusted"}</option>
          </select>
        </label>
        {hasFilters && (
          <button
            className="clear-filters"
            type="button"
            onClick={() => { setQuery(""); setCategory(""); setSource(""); setFrequency(""); setAdjustment(""); }}
          >
            {pt ? "Limpar filtros" : "Clear filters"}
          </button>
        )}
      </div>

      <div className="results-summary">
        <strong>{results.length}</strong> {pt ? (results.length === 1 ? "indicador" : "indicadores") : (results.length === 1 ? "indicator" : "indicators")}
        <span>{pt ? "A busca fica salva na URL" : "Search state is saved in the URL"}</span>
      </div>

      <div className="catalog-list">
        <div className="catalog-list-head">
          <span>Indicator</span><span>Area</span><span>Frequency</span><span>Source</span>
        </div>
        {results.map((item) => (
          <div className="catalog-result" key={item.id}>
            <a className="result-hit" href={localized(locale, `/indicators/${item.id}`)}>
            <span className="result-main">
              <strong>{item.name}</strong>
              <small>{item.description}</small>
              <code>{item.id}</code>
            </span>
            <span>{item.categoryName}</span>
            <span className="result-frequency">
              {item.frequency}
              <small>{item.unitSymbol}{item.seasonalAdjustment ? " · SA" : ""}</small>
            </span>
            <span className="result-source">
              <b>{item.sourceAgency}</b>
              <i aria-hidden="true">↗</i>
            </span>
            </a><button className="preview-trigger" type="button" aria-label={`Preview ${item.name}`} onClick={() => setPreview(preview?.id === item.id ? null : item)}>{preview?.id === item.id ? "×" : "⌁"}</button>
            {preview?.id === item.id && <div className="catalog-preview"><div><span>{pt ? "Prévia da série" : "Series preview"}</span><strong>{item.officialName}</strong><small>{item.id} · {item.unitSymbol} · {item.sourceAgency}</small></div><div>{previewData === null ? <span className="preview-state">{pt ? "Buscando observações…" : "Fetching observations…"}</span> : previewData.length > 1 ? <DataChart data={previewData} unit={item.unitSymbol} decimals={2} compact /> : <span className="preview-state">{pt ? "Fonte indisponível — nenhum valor substituído" : "Source unavailable — no value substituted"}</span>}</div><div><a href={localized(locale, `/indicators/${item.id}`)}>{pt ? "Abrir ficha" : "Open data sheet"} →</a><a href={localized(locale, `/playground?indicator=${item.id}`)}>API ↗</a></div></div>}
          </div>
        ))}
        {results.length === 0 && (
          <div className="empty-results">
            <strong>{pt ? "Nenhum indicador corresponde a esses filtros." : "No indicators match these filters."}</strong>
            <p>{pt ? "Tente uma sigla, nome em inglês, código de fonte ou tema mais amplo." : "Try an official acronym, Portuguese name, source code, or a broader category."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
