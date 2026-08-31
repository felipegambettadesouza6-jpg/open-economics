import type { IndicatorDefinition, SeriesResult } from "@/lib/domain/types";
import { ApiError } from "@/lib/errors";
import { getProvider } from "@/lib/providers/registry";
import type { DateRange } from "@/lib/providers/provider";
import { createSnapshotRepository } from "@/lib/cache/snapshot-repository";

export interface SeriesServiceContext {
  db?: D1Database;
  fetcher?: typeof fetch;
  snapshotKey?: string;
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
  // Incrementing this key version cleanly separates snapshots whenever
  // normalization semantics change, without making cache migration a runtime risk.
  const cacheKey = context.snapshotKey ?? `v2:${definition.id}:${range.start}:${range.end}`;
  const repository = createSnapshotRepository(context.db);
  let snapshot: Awaited<ReturnType<typeof repository.get>> = null;
  try {
    snapshot = await repository.get(cacheKey);
  } catch {
    console.warn(JSON.stringify({ indicator_id: definition.id, cache: "read_failed" }));
  }

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
    try {
      await repository.put(cacheKey, definition.id, result, definition.cacheTtlSeconds);
    } catch {
      // A cache must never turn a successful official-source read into an API failure.
      console.warn(JSON.stringify({ indicator_id: definition.id, cache: "write_failed" }));
    }
    return { result, cache: "miss", stale: false };
  } catch (error) {
    if (snapshot) {
      return { result: snapshot.payload, cache: "stale", stale: true };
    }
    if (error instanceof ApiError || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
    console.warn(JSON.stringify({
      indicator_id: definition.id,
      upstream_error: error instanceof Error ? error.name : "UnknownError",
    }));
    throw new ApiError(
      502,
      "UPSTREAM_CONNECTION_ERROR",
      "The official source could not be reached.",
      "The request did not receive a usable response from the upstream publisher.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
