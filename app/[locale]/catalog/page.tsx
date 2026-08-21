import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogExplorer } from "@/app/components/CatalogExplorer";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { categoryLabels, indicators } from "@/lib/catalog/indicators";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Economic data catalog | Open Economics", description: "Search Brazilian economic indicators in English or Portuguese, then inspect or use the series." };

export default async function CatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params; if (!isLocale(value)) notFound(); const locale = value; const pt = locale === "pt-br";
  const items = indicators.map((indicator) => ({ id: indicator.id, name: indicator.name, officialName: indicator.officialName, description: indicator.description, category: indicator.category, categoryName: categoryLabels[indicator.category], frequency: indicator.frequency, unitSymbol: indicator.unitSymbol, sourceAgency: indicator.sourceAgency, seasonalAdjustment: indicator.seasonalAdjustment, aliases: indicator.aliases, upstreamCode: String(indicator.upstream.seriesCode ?? `${indicator.upstream.aggregate}/${indicator.upstream.variable}`) }));
  return <main className="atlas-page"><SiteHeader locale={locale} /><section className="atlas-page-hero atlas-shell"><p className="atlas-kicker">{pt ? "CATÁLOGO ECONÔMICO" : "ECONOMIC DATA CATALOG"}</p><div><h1>{pt ? "Encontre a série certa. Entenda antes de usar." : "Find the right series. Understand it before you use it."}</h1><p>{pt ? "Busque nomes oficiais, rótulos em inglês, siglas, IDs estáveis e códigos da fonte. Cada resultado mantém unidade, frequência e origem." : "Search official names, Portuguese aliases, acronyms, stable IDs, and source codes. Every result keeps its unit, frequency, and provenance."}</p></div></section><section className="atlas-catalog atlas-shell"><CatalogExplorer items={items} locale={locale} /></section><SiteFooter locale={locale} /></main>;
}
