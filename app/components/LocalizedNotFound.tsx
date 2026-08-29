"use client";

import { usePathname } from "next/navigation";
import { localized, type Locale } from "@/lib/i18n";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";

export function LocalizedNotFound() {
  const pathname = usePathname();
  const locale: Locale = pathname.startsWith("/pt-br") ? "pt-br" : "en";
  const pt = locale === "pt-br";

  return (
    <main lang={pt ? "pt-BR" : "en"}>
      <SiteHeader locale={locale} />
      <section className="not-found shell">
        <span>404</span>
        <h1>{pt ? <>Esta série<br /><em>não está no catálogo.</em></> : <>This series<br /><em>isn&apos;t in the catalog.</em></>}</h1>
        <p>{pt ? "Busque nos IDs, nomes, aliases e códigos oficiais disponíveis no catálogo atual." : "Search the current indicator IDs, names, Portuguese aliases, and official source codes."}</p>
        <div>
          <a className="button primary" href={localized(locale, "/catalog")}>{pt ? "Buscar no catálogo" : "Search the catalog"} →</a>
          <a className="button secondary" href={localized(locale, "/docs/api-reference")}>{pt ? "Referência da API" : "API reference"}</a>
        </div>
      </section>
      <SiteFooter locale={locale} />
    </main>
  );
}
