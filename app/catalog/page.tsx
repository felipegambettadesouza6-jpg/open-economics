import type { Metadata } from "next";
import { CatalogExplorer } from "@/app/components/CatalogExplorer";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { categoryLabels, indicators } from "@/lib/catalog/indicators";

export const metadata: Metadata = {
  title: "Data catalog | Open Economics API",
  description: "Search authoritative Brazilian economic indicators by topic, publisher, frequency, name, acronym, or source code.",
};

export default function CatalogPage() {
  const items = indicators.map((indicator) => ({
    id: indicator.id,
    name: indicator.name,
    officialName: indicator.officialName,
    description: indicator.description,
    category: indicator.category,
    categoryName: categoryLabels[indicator.category],
    frequency: indicator.frequency,
    unitSymbol: indicator.unitSymbol,
    sourceAgency: indicator.sourceAgency,
    seasonalAdjustment: indicator.seasonalAdjustment,
    aliases: indicator.aliases,
    upstreamCode: String(
      indicator.upstream.seriesCode ??
      `${indicator.upstream.aggregate}/${indicator.upstream.variable}`,
    ),
  }));

  return (
    <main>
      <SiteHeader />
      <section className="page-hero catalog-hero shell">
        <div>
          <p className="eyebrow"><span /> Data catalog</p>
          <h1>Find the series<br /><em>you actually need.</em></h1>
        </div>
        <p>
          Search official names, English labels, Portuguese aliases, acronyms, stable IDs,
          and upstream source codes. Every result keeps its unit, frequency, and provenance.
        </p>
      </section>
      <section className="catalog-page shell">
        <CatalogExplorer items={items} />
      </section>
      <SiteFooter />
    </main>
  );
}

