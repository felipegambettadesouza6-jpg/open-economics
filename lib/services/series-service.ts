import type { IndicatorDefinition, SeriesResult } from "@/lib/domain/types";
import { getProvider } from "@/lib/providers/registry";
import type { DateRange } from "@/lib/providers/provider";
import { createSnapshotRepository } from "@/lib/cache/snapshot-repository";

export interface SeriesServiceContext {
  db?: D1Database;
  fetcher?: typeof fetch;
}

export interface SeriesServiceResult {
  result: SeriesResult;
  cache: "hit" | "miss" | "stale";
  stale: boolean;
}

export async function getSeries(
  definition: IndicatorDefinition,
  range: DateRange,
  context: SeriesServiceContext = {},
): Promise<SeriesServiceResult> {
  const cacheKey = `v1:${definition.id}:${range.start}:${range.end}`;
  const repository = createSnapshotRepository(context.db);
  const snapshot = await repository.get(cacheKey);

  if (snapshot && snapshot.expiresAt > Date.now()) {
    return { result: snapshot.payload, cache: "hit", stale: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const provider = getProvider(definition.provider);
    const result = await provider.fetchSeries(definition, range, {
      fetcher: context.fetcher ?? fetch,
      signal: controller.signal,
    });
    await repository.put(cacheKey, definition.id, result, definition.cacheTtlSeconds);
    return { result, cache: "miss", stale: false };
  } catch (error) {
    if (snapshot) {
      return { result: snapshot.payload, cache: "stale", stale: true };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

