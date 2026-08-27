"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { LanguageSwitch } from "@/app/components/LanguageSwitch";
import { localized, type Locale, ui } from "@/lib/i18n";

export function SiteHeader({ locale = "en" }: { locale?: Locale }) {
  const copy = ui[locale];
  const [scrolled, setScrolled] = useState(false);
  const [compact, setCompact] = useState(false);
  const [deep, setDeep] = useState(false);
  const [dark, setDark] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 24);
      setCompact(window.scrollY > 440);
      setDeep(window.scrollY > 1450);
      setProgress(Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)));
      const navLine = window.scrollY > 24 ? 46 : 42;
      setDark([...document.querySelectorAll<HTMLElement>("[data-nav-theme='dark']")].some((section) => {
        const bounds = section.getBoundingClientRect();
        return bounds.top <= navLine && bounds.bottom >= navLine;
      }));
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  return <header className={`signal-header ${scrolled ? "is-scrolled" : ""} ${compact ? "is-compact" : ""} ${deep ? "is-deep" : ""} ${dark ? "is-dark" : ""}`} style={{ "--scroll-progress": progress } as CSSProperties}><div className="signal-nav">
    <a className="signal-brand" href={localized(locale)} aria-label="Open Economics home"><span className="signal-mark" aria-hidden="true"><i /><i /><i /></span><span>Open Economics</span></a>
    <nav className="signal-nav-links" aria-label="Primary navigation">
      <a href={localized(locale, "/catalog")}>{copy.nav.explore}</a><a href={localized(locale, "/docs")}>{copy.nav.docs}</a><a href={localized(locale, "/sources")}>{copy.nav.sources}</a><a className="signal-status" href={localized(locale, "/status")}><i aria-hidden="true" />{copy.nav.status}</a>
    </nav>
    <div className="signal-nav-actions"><LanguageSwitch locale={locale} /><a className="signal-nav-cta" href={localized(locale, "/playground")}>{copy.nav.playground}<span>↗</span></a></div>
    <details className="signal-mobile-menu"><summary aria-label={locale === "pt-br" ? "Abrir navegação" : "Open navigation"}><i /><i /></summary><div><a href={localized(locale, "/catalog")}>{copy.nav.explore}</a><a href={localized(locale, "/docs")}>{copy.nav.docs}</a><a href={localized(locale, "/playground")}>{copy.nav.playground}</a><a href={localized(locale, "/sources")}>{copy.nav.sources}</a><a href={localized(locale, "/status")}>{copy.nav.status}</a></div></details>
    <span className="signal-nav-progress" aria-hidden="true" />
  </div></header>;
}
