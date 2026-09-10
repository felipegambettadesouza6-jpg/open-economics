export const locales = ["en", "pt-br"] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function localized(locale: Locale, path = "") {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean}`;
}

export const ui = {
  en: {
    nav: { ask: "Ask data", explore: "Explore", docs: "Docs", mcp: "MCP", playground: "Playground", sources: "Sources", status: "Status" },
    searchLabel: "Search the economic atlas", searchPlaceholder: "Try IPCA, unemployment, 432, inflação…",
    searchHint: "Search in English, Portuguese, acronyms, or official series codes",
    headline: "Brazil’s economy, made readable.", intro: "Find and query official Brazilian economic data through one free API and MCP server. BCB, IBGE, Tesouro, MTE, ANP and more, with source provenance.",
    explore: "Explore data", build: "Build with the API", pulse: "Live economic pulse", pulseTitle: "Four signals. One connected economy.",
    pulseCopy: "Current official observations from IBGE and Banco Central do Brasil. Select any line to inspect the complete series.",
    analyst: "For analysis", developer: "For development", useTitle: "One series, two ways to work.",
    useCopy: "Change the range once. The chart, request URL, and code stay in sync.", provenance: "A visible source trail", provenanceTitle: "Normalized, never anonymized.",
  },
  "pt-br": {
    nav: { ask: "Perguntar", explore: "Explorar", docs: "Docs", mcp: "MCP", playground: "Playground", sources: "Fontes", status: "Status" },
    searchLabel: "Busque no atlas econômico", searchPlaceholder: "Tente IPCA, desemprego, 432, inflation…",
    searchHint: "Busque em português, inglês, por siglas ou códigos oficiais",
    headline: "A economia do Brasil, agora legível.", intro: "Encontre e consulte dados econômicos oficiais do Brasil por uma API gratuita e um servidor MCP. BCB, IBGE, Tesouro, MTE, ANP e outras fontes, com proveniência.",
    explore: "Explorar dados", build: "Usar a API", pulse: "Pulso econômico ao vivo", pulseTitle: "Quatro sinais. Uma economia conectada.",
    pulseCopy: "Observações oficiais atuais do IBGE e do Banco Central do Brasil. Selecione uma linha para ver a série completa.",
    analyst: "Para análise", developer: "Para desenvolvimento", useTitle: "Uma série, duas formas de trabalhar.",
    useCopy: "Altere o período uma vez. O gráfico, a URL e o código continuam sincronizados.", provenance: "A origem sempre visível", provenanceTitle: "Normalizado, nunca anonimizado.",
  },
} as const;
