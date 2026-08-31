"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LanguageSwitch } from "@/app/components/LanguageSwitch";
import { localized, type Locale, ui } from "@/lib/i18n";

export function SiteHeader({ locale = "en" }: { locale?: Locale }) {
  const copy = ui[locale];
  const pathname = usePathname();
  const darkRef = useRef(false);
  const [scrolled, setScrolled] = useState(false);
  const [compact, setCompact] = useState(false);
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [morph, setMorph] = useState(0);

  const isCurrent = (path: string) => {
    const href = localized(locale, path);
    return pathname === href || (path !== "" && pathname.startsWith(`${href}/`));
  };

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const nextMorph = Math.min(1, Math.max(0, window.scrollY / 220));
      setScrolled(window.scrollY > 8);
      setCompact(nextMorph > .42);
      setMorph(nextMorph);
      setProgress(Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)));
      const nav = document.querySelector<HTMLElement>(".signal-nav");
      const navHeight = Math.max(48, nav?.getBoundingClientRect().height ?? 58);
      const darkCoverage = [...document.querySelectorAll<HTMLElement>("[data-nav-theme='dark']")].reduce((maximum, section) => {
        const bounds = section.getBoundingClientRect();
        const overlap = Math.max(0, Math.min(navHeight, bounds.bottom) - Math.max(0, bounds.top));
        return Math.max(maximum, overlap / navHeight);
      }, 0);
      const nextDark = darkRef.current ? darkCoverage > .48 : darkCoverage >= .64;
      if (nextDark !== darkRef.current) {
        darkRef.current = nextDark;
        setDark(nextDark);
      }
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  const open = 1 - morph;
  const headerStyle = {
    "--scroll-progress": progress,
    "--header-morph": morph,
    "--nav-height": `${92 - morph * 34}px`,
    "--nav-left": `${50 - morph * 28}%`,
    "--nav-shift": `${-50 + morph * 50}%`,
    "--nav-gap": `${40 - morph * 14}px`,
    "--nav-font-size": `${12 - morph * .6}px`,
    "--action-gap": `${18 - morph * 8}px`,
    "--brand-copy-opacity": .78 + open * .22,
    "--brand-copy-shift": `${-2 * morph}px`,
    "--brand-hit-width": "152px",
    "--brand-font-size": `${15 - morph}px`,
    "--brand-mark-scale": 1 - morph * .08,
    "--language-size": `${42 - morph * 6}px`,
    "--cta-x": `${16 - morph * 3}px`,
    "--cta-y": `${11 - morph * 2}px`,
  } as CSSProperties;

  return <header className={`signal-header ${scrolled ? "is-scrolled" : ""} ${compact ? "is-compact" : ""} ${dark ? "is-dark" : ""}`} style={headerStyle}><div className="signal-nav">
    <a className="signal-brand" href={localized(locale)} aria-label={locale === "pt-br" ? "Página inicial da Open Economics" : "Open Economics home"}><span className="signal-mark" aria-hidden="true"><i /><i /><i /></span><span>Open Economics</span></a>
    <nav className="signal-nav-links" aria-label={locale === "pt-br" ? "Navegação principal" : "Primary navigation"}>
      <a aria-current={isCurrent("/catalog") ? "page" : undefined} href={localized(locale, "/catalog")}>{copy.nav.explore}</a><a aria-current={isCurrent("/docs") ? "page" : undefined} href={localized(locale, "/docs")}>{copy.nav.docs}</a><a aria-current={isCurrent("/sources") ? "page" : undefined} href={localized(locale, "/sources")}>{copy.nav.sources}</a><a aria-current={isCurrent("/status") ? "page" : undefined} className="signal-status" href={localized(locale, "/status")}><i aria-hidden="true" />{copy.nav.status}</a>
    </nav>
    <div className="signal-nav-actions"><LanguageSwitch locale={locale} /><a aria-current={isCurrent("/playground") ? "page" : undefined} className="signal-nav-cta" href={localized(locale, "/playground")}>{copy.nav.playground}<span>↗</span></a></div>
    <details className="signal-mobile-menu" onToggle={(event) => setMenuOpen(event.currentTarget.open)}><summary aria-label={menuOpen ? (locale === "pt-br" ? "Fechar navegação" : "Close navigation") : (locale === "pt-br" ? "Abrir navegação" : "Open navigation")}><i aria-hidden="true" /><i aria-hidden="true" /></summary><div><a aria-current={isCurrent("/catalog") ? "page" : undefined} href={localized(locale, "/catalog")}>{copy.nav.explore}</a><a aria-current={isCurrent("/docs") ? "page" : undefined} href={localized(locale, "/docs")}>{copy.nav.docs}</a><a aria-current={isCurrent("/playground") ? "page" : undefined} href={localized(locale, "/playground")}>{copy.nav.playground}</a><a aria-current={isCurrent("/sources") ? "page" : undefined} href={localized(locale, "/sources")}>{copy.nav.sources}</a><a aria-current={isCurrent("/status") ? "page" : undefined} href={localized(locale, "/status")}>{copy.nav.status}</a></div></details>
    <span className="signal-nav-progress" aria-hidden="true" />
  </div></header>;
}
