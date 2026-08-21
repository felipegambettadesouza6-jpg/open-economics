import { LanguageSwitch } from "@/app/components/LanguageSwitch";
import { localized, type Locale, ui } from "@/lib/i18n";

export function SiteHeader({ locale = "en" }: { locale?: Locale }) {
  const copy = ui[locale];
  return <header className="signal-header"><div className="signal-nav">
    <a className="signal-brand" href={localized(locale)} aria-label="Open Economics home"><span className="signal-mark" aria-hidden="true"><i /><i /><i /></span><span>Open Economics</span></a>
    <nav className="signal-nav-links" aria-label="Primary navigation">
      <a href={localized(locale, "/catalog")}>{copy.nav.explore}</a><a href={localized(locale, "/docs")}>{copy.nav.docs}</a><a href={localized(locale, "/sources")}>{copy.nav.sources}</a><a className="signal-status" href={localized(locale, "/status")}><i aria-hidden="true" />{copy.nav.status}</a>
    </nav>
    <div className="signal-nav-actions"><LanguageSwitch locale={locale} /><a className="signal-nav-cta" href={localized(locale, "/playground")}>{copy.nav.playground}<span>↗</span></a></div>
    <details className="signal-mobile-menu"><summary aria-label={locale === "pt-br" ? "Abrir navegação" : "Open navigation"}><i /><i /></summary><div><a href={localized(locale, "/catalog")}>{copy.nav.explore}</a><a href={localized(locale, "/docs")}>{copy.nav.docs}</a><a href={localized(locale, "/playground")}>{copy.nav.playground}</a><a href={localized(locale, "/sources")}>{copy.nav.sources}</a><a href={localized(locale, "/status")}>{copy.nav.status}</a></div></details>
  </div></header>;
}
