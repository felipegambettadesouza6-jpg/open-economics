import { indicators } from "@/lib/catalog/indicators";
import { locales, localized } from "@/lib/i18n";
import { SITE_ORIGIN } from "@/lib/metadata";

const pages = ["", "/catalog", "/playground", "/docs", "/docs/api-reference", "/docs/errors", "/docs/attribution", "/sources", "/status"] as const;

function entry(path: string, priority: number, frequency: "weekly" | "monthly") {
  const alternates = locales.map((locale) => `    <xhtml:link rel="alternate" hreflang="${locale === "pt-br" ? "pt-BR" : "en"}" href="${SITE_ORIGIN}${localized(locale, path)}" />`).join("\n");
  return locales.map((locale) => `  <url>\n    <loc>${SITE_ORIGIN}${localized(locale, path)}</loc>\n${alternates}\n    <changefreq>${frequency}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`).join("\n");
}

export function GET() {
  const urls = [
    ...pages.map((path) => entry(path, path === "" ? 1 : path === "/catalog" || path === "/docs" ? .8 : .6, path === "" ? "weekly" : "monthly")),
    ...indicators.map((indicator) => entry(`/indicators/${indicator.id}`, .7, "weekly")),
  ].join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400", "Content-Type": "application/xml; charset=utf-8" } });
}
