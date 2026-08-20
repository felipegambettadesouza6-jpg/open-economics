"use client";

import { useEffect, useMemo, useState } from "react";

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

export function CatalogExplorer({ items }: { items: CatalogItem[] }) {
  const initialParameter = (name: string) =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get(name) ?? "";
  const [query, setQuery] = useState(() => initialParameter("q"));
  const [category, setCategory] = useState(() => initialParameter("category"));
  const [source, setSource] = useState(() => initialParameter("source"));
  const [frequency, setFrequency] = useState(() => initialParameter("frequency"));

  useEffect(() => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (category) search.set("category", category);
    if (source) search.set("source", source);
    if (frequency) search.set("frequency", frequency);
    const suffix = search.toString();
    window.history.replaceState({}, "", suffix ? `/catalog?${suffix}` : "/catalog");
  }, [query, category, source, frequency]);

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
        (!frequency || item.frequency === frequency)
      );
    });
  }, [items, query, category, source, frequency]);

  const hasFilters = Boolean(query || category || source || frequency);

  return (
    <div className="catalog-explorer">
      <div className="catalog-search-row">
        <label className="search-box">
          <span className="sr-only">Search indicators</span>
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="IPCA, Selic, unemployment, 433…"
            type="search"
          />
          <kbd>/</kbd>
        </label>
        <a className="button dark" href="/playground">Open playground →</a>
      </div>

      <div className="filter-bar" aria-label="Catalog filters">
        <label>
          <span>Area</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Source</span>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">All sources</option>
            <option value="IBGE">IBGE</option>
            <option value="BCB">BCB</option>
          </select>
        </label>
        <label>
          <span>Frequency</span>
          <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
            <option value="">All frequencies</option>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </label>
        {hasFilters && (
          <button
            className="clear-filters"
            type="button"
            onClick={() => { setQuery(""); setCategory(""); setSource(""); setFrequency(""); }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="results-summary">
        <strong>{results.length}</strong> {results.length === 1 ? "indicator" : "indicators"}
        <span>Search state is saved in the URL</span>
      </div>

      <div className="catalog-list">
        <div className="catalog-list-head">
          <span>Indicator</span><span>Area</span><span>Frequency</span><span>Source</span>
        </div>
        {results.map((item) => (
          <a className="catalog-result" href={`/indicators/${item.id}`} key={item.id}>
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
          </a>
        ))}
        {results.length === 0 && (
          <div className="empty-results">
            <strong>No indicators match these filters.</strong>
            <p>Try an official acronym, Portuguese name, source code, or a broader category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
