"use client";
import { useState } from "react";
import { type Locale, localized } from "@/lib/i18n";

const entries = [
  ["quickstart", "Quickstart", "Início rápido"], ["model", "Data model", "Modelo de dados"], ["dates", "Dates and periods", "Datas e períodos"], ["revisions", "Revisions", "Revisões"], ["api-reference", "API reference", "Referência da API"], ["errors", "Errors", "Erros"], ["attribution", "Attribution", "Atribuição"],
] as const;
export function DocsSearch({ locale }: { locale: Locale }) {
  const pt = locale === "pt-br";
  const [query, setQuery] = useState(""); const shown = entries.filter(([, en, portuguese]) => `${en} ${portuguese}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  return <div className="docs-search"><label htmlFor="docs-search">{pt ? "Buscar na documentação" : "Search documentation"}</label><input id="docs-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={pt ? "datas, CSV, erros…" : "dates, CSV, errors…"} />{query && <div>{shown.map(([id, en, portuguese]) => <a key={id} href={id === "quickstart" || id === "model" || id === "dates" || id === "revisions" ? `#${id}` : localized(locale, `/docs/${id}`)}>{pt ? portuguese : en}<span aria-hidden="true">↗</span></a>)}{shown.length === 0 && <p role="status">{pt ? "Nenhuma seção encontrada." : "No documentation section found."}</p>}</div>}</div>;
}
