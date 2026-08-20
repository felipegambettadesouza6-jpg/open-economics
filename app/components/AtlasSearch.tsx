"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IndicatorDefinition } from "@/lib/domain/types";
import { localized, type Locale, ui } from "@/lib/i18n";

export function AtlasSearch({ indicators, locale }: { indicators: IndicatorDefinition[]; locale: Locale }) {
  const copy = ui[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return indicators.filter((indicator) => indicator.featured).slice(0, 4);
    return indicators.filter((indicator) => [indicator.name, indicator.officialName, indicator.id, ...indicator.aliases].join(" ").toLocaleLowerCase().includes(normalized)).slice(0, 6);
  }, [indicators, query]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) { event.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return <div className="atlas-command">
    <label htmlFor="atlas-search">{copy.searchLabel}</label>
    <div className="atlas-search-row"><span aria-hidden="true">⌕</span><input ref={inputRef} id="atlas-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} autoComplete="off" /><kbd>/</kbd></div>
    <div className="atlas-results" aria-live="polite">
      {results.map((indicator) => <a href={localized(locale, `/indicators/${indicator.id}`)} key={indicator.id}><span><b>{indicator.name}</b><small>{indicator.officialName}</small></span><code>{indicator.unitSymbol} · {indicator.frequency}</code></a>)}
      {query && results.length === 0 && <p>{locale === "pt-br" ? "Nenhuma série encontrada." : "No matching series."}</p>}
    </div><small className="atlas-search-hint">{copy.searchHint}</small>
  </div>;
}
