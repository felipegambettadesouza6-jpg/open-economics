import { categoryLabels } from "@/lib/catalog/indicators";
import { getSource } from "@/lib/catalog/sources";
import type { IndicatorDefinition } from "@/lib/domain/types";

export function publicIndicator(indicator: IndicatorDefinition) {
  return {
    id: indicator.id,
    name: indicator.name,
    official_name: indicator.officialName,
    description: indicator.description,
    country: "BR",
    geography: indicator.geography,
    category: indicator.category,
    category_name: categoryLabels[indicator.category],
    frequency: indicator.frequency,
    unit: indicator.unit,
    unit_symbol: indicator.unitSymbol,
    decimals: indicator.decimals,
    seasonal_adjustment: indicator.seasonalAdjustment,
    date_semantics: indicator.dateSemantics,
    coverage_start: indicator.startDate,
    status: "active",
    provider: indicator.provider,
    source_agency: indicator.sourceAgency,
    upstream: {
      ...indicator.upstream,
    },
    aliases: indicator.aliases,
    notes: indicator.notes ?? null,
    transformations: indicator.transformations,
    source_url: indicator.sourceUrl,
    license: indicator.license,
    license_url: indicator.licenseUrl,
    links: {
      self: `/api/v1/indicators/${indicator.id}`,
      observations: `/api/v1/indicators/${indicator.id}/observations`,
      latest: `/api/v1/indicators/${indicator.id}/latest`,
      page: `/indicators/${indicator.id}`,
    },
  };
}

export function publicSource(sourceAgency: "BCB" | "IBGE") {
  const source = getSource(sourceAgency.toLowerCase());
  if (!source) return null;
  return {
    id: source.id,
    name: source.name,
    short_name: source.shortName,
    description: source.description,
    homepage: source.homepage,
    catalog_url: source.catalogUrl,
    license: source.license,
    license_url: source.licenseUrl,
    attribution: source.attribution,
  };
}

