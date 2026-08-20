import { LanguageSwitch } from "@/app/components/LanguageSwitch";
import { localized, type Locale, ui } from "@/lib/i18n";

export function SiteHeader({ locale = "en" }: { locale?: Locale }) {
  const copy = ui[locale];
  return <header className="atlas-header"><div className="atlas-shell atlas-nav">
    <a className="atlas-brand" href={localized(locale)} aria-label="Open Economics home"><span className="axis-mark" aria-hidden="true"><i>O</i><b>E</b></span><span>Open Economics</span></a>
    <nav className="atlas-nav-links" aria-label="Primary navigation">
      <a href={localized(locale, "/catalog")}>{copy.nav.explore}</a><a href={localized(locale, "/docs")}>{copy.nav.docs}</a><a href={localized(locale, "/playground")}>{copy.nav.playground}</a><a href={localized(locale, "/sources")}>{copy.nav.sources}</a><a className="atlas-status" href={localized(locale, "/status")}><i aria-hidden="true" />{copy.nav.status}</a>
    </nav><LanguageSwitch locale={locale} />
  </div></header>;
}
