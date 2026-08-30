import { localized, type Locale } from "@/lib/i18n";

export function SiteFooter({ locale = "en", dramatic = false }: { locale?: Locale; dramatic?: boolean }) {
  const pt = locale === "pt-br";

  if (dramatic) return (
    <footer className="signal-footer signal-footer-dramatic" data-nav-theme="dark">
      <a className="footer-build" href={localized(locale, "/playground")}>
        <span className="footer-build-copy"><small>{pt ? "PRONTO PARA USAR" : "READY TO USE"}</small><b>{pt ? "Construa com Open Economics" : "Build with Open Economics"}</b></span><span className="footer-build-arrow">→</span>
      </a>
      <div className="footer-directory">
        <div>
          <span>{pt ? "Dados" : "Data"}</span>
          <a href={localized(locale, "/catalog")}>{pt ? "Explorar catálogo" : "Explore catalog"}</a>
          <a href={localized(locale, "/indicators/br-ipca-monthly")}>IPCA</a>
          <a href={localized(locale, "/indicators/br-selic-target")}>Selic</a>
          <a href={localized(locale, "/sources")}>{pt ? "Fontes oficiais" : "Official sources"}</a>
        </div>
        <div>
          <span>{pt ? "Indicadores" : "Indicators"}</span>
          <a href={localized(locale, "/indicators/br-ipca-monthly")}>IPCA monthly</a>
          <a href={localized(locale, "/indicators/br-ipca-12m")}>IPCA 12 months</a>
          <a href={localized(locale, "/indicators/br-unemployment-rate")}>{pt ? "Desemprego" : "Unemployment"}</a>
          <a href={localized(locale, "/indicators/br-ibc-br")}>IBC-Br</a>
        </div>
        <div>
          <span>{pt ? "Construa" : "Build"}</span>
          <a href={localized(locale, "/playground")}>Playground</a>
          <a href={localized(locale, "/docs")}>Quickstart</a>
          <a href={localized(locale, "/guides")}>{pt ? "Exemplos práticos" : "Practical examples"}</a>
          <a href={localized(locale, "/guides/spreadsheets")}>{pt ? "IPCA e Selic em planilhas" : "IPCA & Selic in spreadsheets"}</a>
          <a href={localized(locale, "/guides/selic-api")}>{pt ? "API da Selic" : "Selic API"}</a>
          <a href={localized(locale, "/guides/ipca-api")}>{pt ? "API do IPCA" : "IPCA API"}</a>
          <a href={localized(locale, "/docs/api-reference")}>API reference</a>
          <a href="/api/v1/openapi.json">OpenAPI 3.1</a>
        </div>
        <div>
          <span>{pt ? "Integridade" : "Integrity"}</span>
          <a href={localized(locale, "/sources")}>{pt ? "Origem e licenças" : "Provenance & licenses"}</a>
          <a href={`${localized(locale, "/docs")}#revisions`}>{pt ? "Revisões" : "Revisions"}</a>
          <a href={localized(locale, "/status")}>Live status</a>
        </div>
        <div>
          <span>{pt ? "Projeto" : "Project"}</span>
          <a href={localized(locale, "/docs")}>Documentation</a>
          <a href={localized(locale, "/docs/attribution")}>{pt ? "Atribuição" : "Attribution"}</a>
          <a href={localized("pt-br")}>Português</a>
        </div>
        <div>
          <span>{pt ? "Acesso" : "Access"}</span>
          <a href={localized(locale, "/catalog")}>{pt ? "Pesquisar dados" : "Search data"}</a>
          <a href={localized(locale, "/playground")}>{pt ? "Testar uma chamada" : "Run a request"}</a>
          <a href={localized(locale, "/status")}>API health</a>
          <a href={localized("en")}>English</a>
        </div>
      </div>
      <div className="footer-wordmark" aria-hidden="true">Open Economics</div>
      <div className="signal-footer-bottom">
        <span>© 2026 Open Economics · MIT</span>
        <span>{pt ? "As licenças dos dados de origem se aplicam" : "Upstream data licenses apply"}</span>
        <span>São Paulo · Brazil</span>
      </div>
    </footer>
  );

  return (
    <footer className="signal-footer">
      <div className="signal-footer-main">
        <a className="signal-brand" href={localized(locale)}>
          <span className="signal-mark" aria-hidden="true"><i /><i /><i /></span><span>Open Economics</span>
        </a>
        <p>{pt ? "Dados econômicos oficiais, mais fáceis de encontrar, entender e usar." : "Official economic data, made easier to find, understand, and use."}</p>
        <nav>
          <div>
            <span>{pt ? "Produto" : "Product"}</span>
            <a href={localized(locale, "/catalog")}>{pt ? "Explorar dados" : "Explore data"}</a>
            <a href={localized(locale, "/playground")}>Playground</a>
            <a href={localized(locale, "/status")}>Status</a>
          </div>
          <div>
            <span>{pt ? "Recursos" : "Resources"}</span>
            <a href={localized(locale, "/docs")}>Documentation</a>
            <a href={localized(locale, "/guides")}>{pt ? "Exemplos práticos" : "Practical examples"}</a>
            <a href={localized(locale, "/guides/spreadsheets")}>{pt ? "IPCA e Selic em planilhas" : "IPCA & Selic in spreadsheets"}</a>
            <a href={localized(locale, "/sources")}>{pt ? "Fontes e licenças" : "Sources & licenses"}</a>
            <a href="/api/v1/openapi.json">OpenAPI 3.1</a>
          </div>
        </nav>
      </div>
      <div className="signal-footer-bottom">
        <span>© 2026 Open Economics · MIT</span>
        <span>{pt ? "As licenças dos dados de origem se aplicam" : "Upstream data licenses apply"}</span>
        <span>São Paulo · Brazil</span>
      </div>
    </footer>
  );
}
