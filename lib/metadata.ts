import type { Metadata } from "next";
import { localized, type Locale } from "@/lib/i18n";

export const SITE_ORIGIN = "https://open-economics-data.knbf982hkn.chatgpt.site";

export function localizedMetadata({
  locale,
  path = "",
  title,
  description,
}: {
  locale: Locale;
  path?: string;
  title: string;
  description: string;
}): Metadata {
  const canonical = localized(locale, path);
  const english = localized("en", path);
  const portuguese = localized("pt-br", path);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { en: english, "pt-BR": portuguese, "x-default": english },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "pt-br" ? "pt_BR" : "en_US",
      alternateLocale: locale === "pt-br" ? ["en_US"] : ["pt_BR"],
      url: canonical,
      siteName: "Open Economics",
      images: [{ url: "/og.png", width: 1774, height: 887, alt: "Open Economics — Official data, made to flow" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}
