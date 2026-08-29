import type { MetadataRoute } from "next";
import { indicators } from "@/lib/catalog/indicators";
import { locales, localized } from "@/lib/i18n";
import { SITE_ORIGIN } from "@/lib/metadata";

const pages = [
  "",
  "/catalog",
  "/playground",
  "/docs",
  "/docs/api-reference",
  "/docs/errors",
  "/docs/attribution",
  "/sources",
  "/status",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const pageEntries = locales.flatMap((locale) => pages.map((path) => ({
    url: `${SITE_ORIGIN}${localized(locale, path)}`,
    changeFrequency: path === "" ? "weekly" as const : "monthly" as const,
    priority: path === "" ? 1 : path === "/catalog" || path === "/docs" ? .8 : .6,
  })));
  const indicatorEntries = locales.flatMap((locale) => indicators.map((indicator) => ({
    url: `${SITE_ORIGIN}${localized(locale, `/indicators/${indicator.id}`)}`,
    changeFrequency: "weekly" as const,
    priority: .7,
  })));

  return [...pageEntries, ...indicatorEntries];
}
