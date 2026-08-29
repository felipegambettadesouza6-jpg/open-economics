"use client";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitch({ locale }: { locale: Locale }) {
  const nextLocale = locale === "en" ? "pt-br" : "en";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const path = pathname.replace(/^\/(en|pt-br)(?=\/|$)/, `/${nextLocale}`);
  const query = searchParams.toString();
  const href = `${path}${query ? `?${query}` : ""}`;

  return <a className="atlas-language" href={href} onClick={(event) => {
    if (window.location.hash) event.currentTarget.href = `${href}${window.location.hash}`;
  }} aria-label={locale === "en" ? "Mudar para português" : "Switch to English"}>{nextLocale === "en" ? "EN" : "PT"}</a>;
}
