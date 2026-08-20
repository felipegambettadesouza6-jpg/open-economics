import { ApiError } from "@/lib/errors";
import { bcbSgsProvider } from "@/lib/providers/bcb-sgs";
import { ibgeAggregatesProvider } from "@/lib/providers/ibge-aggregates";
import type { ProviderAdapter } from "@/lib/providers/provider";

const registry = new Map<string, ProviderAdapter>([
  [bcbSgsProvider.id, bcbSgsProvider],
  [ibgeAggregatesProvider.id, ibgeAggregatesProvider],
]);

export function getProvider(id: string): ProviderAdapter {
  const provider = registry.get(id);
  if (!provider) throw new ApiError(500, "PROVIDER_NOT_FOUND", "The indicator provider is not configured.");
  return provider;
}

