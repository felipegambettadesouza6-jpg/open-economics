"use client";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitch({ locale }: { locale: Locale }) {
  const nextLocale = locale === "en" ? "pt-br" : "en";
  return <a className="atlas-language" href={`/${nextLocale}`} onClick={(event) => {
    const path = window.location.pathname.replace(/^\/(en|pt-br)(?=\/|$)/, `/${nextLocale}`);
    event.currentTarget.href = `${path}${window.location.search}${window.location.hash}`;
  }} aria-label={locale === "en" ? "Mudar para português" : "Switch to English"}>{nextLocale === "en" ? "EN" : "PT"}</a>;
}
