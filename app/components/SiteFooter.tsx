import { localized, type Locale } from "@/lib/i18n";

export function SiteFooter({ locale = "en" }: { locale?: Locale }) {
  const pt = locale === "pt-br";
  return <footer className="atlas-footer"><div className="atlas-shell atlas-footer-grid"><div><a className="atlas-brand" href={localized(locale)}><span className="axis-mark" aria-hidden="true"><i>O</i><b>E</b></span><span>Open Economics</span></a><p>{pt ? "Uma interface aberta para dados econômicos oficiais." : "An open interface for authoritative economic data."}</p></div><div className="atlas-footer-links"><a href={localized(locale, "/catalog")}>{pt ? "Dados" : "Data"}</a><a href={localized(locale, "/docs")}>Docs</a><a href={localized(locale, "/playground")}>Playground</a><a href={localized(locale, "/sources")}>{pt ? "Fontes" : "Sources"}</a><a href="/api/v1/openapi.json">OpenAPI</a></div></div><div className="atlas-shell atlas-footer-bottom"><span>MIT · {pt ? "Licenças dos dados de origem se aplicam" : "Upstream data licenses apply"}</span><span>BCB / IBGE · Brazil</span></div></footer>;
}
