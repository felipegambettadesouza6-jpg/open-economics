"use client";
import { useState } from "react";
import { type Locale, localized } from "@/lib/i18n";

const entries = [
  ["quickstart", "Quickstart · Início rápido"], ["model", "Data model · Modelo de dados"], ["dates", "Dates and periods · Datas e períodos"], ["revisions", "Revisions · Revisões"], ["api-reference", "API reference · Referência"], ["errors", "Errors · Erros"], ["attribution", "Attribution · Atribuição"],
];
export function DocsSearch({ locale }: { locale: Locale }) {
  const [query, setQuery] = useState(""); const shown = entries.filter(([, label]) => label.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  return <div className="docs-search"><label htmlFor="docs-search">{locale === "pt-br" ? "Buscar na documentação" : "Search documentation"}</label><input id="docs-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "pt-br" ? "datas, CSV, erros…" : "dates, CSV, errors…"} />{query && <div>{shown.map(([id, label]) => <a key={id} href={id === "quickstart" || id === "model" || id === "dates" || id === "revisions" ? `#${id}` : localized(locale, `/docs/${id}`)}>{label}<span>↗</span></a>)}</div>}</div>;
}

