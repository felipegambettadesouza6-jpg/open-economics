import type { IndicatorDefinition, SeriesResult } from "@/lib/domain/types";

export interface DateRange {
  start: string;
  end: string;
}

export interface ProviderContext {
  fetcher: typeof fetch;
  signal?: AbortSignal;
}

export interface ProviderAdapter {
  readonly id: IndicatorDefinition["provider"];
  fetchSeries(
    definition: IndicatorDefinition,
    range: DateRange,
    context: ProviderContext,
  ): Promise<SeriesResult>;
}

