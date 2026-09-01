import type { SeriesResult } from "@/lib/domain/types";
import type { DateRange } from "@/lib/providers/provider";
import bundledSeries from "@/lib/cache/bundled-series.generated.json";

// Last-known official observations bundled only for the two Selic acquisition
// paths. They are used with stale=true when the worker cannot reach BCB and are
// replaced by a fresh D1 snapshot after the next successful publisher read.
const BUNDLED_LATEST: Record<string, SeriesResult> = {
  "br-selic-target": {
    observations: [{
      date: "2026-08-31",
      period: "2026-08-31",
      sourceDate: "31/08/2026",
      value: 14,
      rawValue: "14.00",
      status: "observed",
    }],
    retrievedAt: "2026-08-31T18:20:00.000Z",
    upstreamUrl: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=31%2F08%2F2026&dataFinal=31%2F08%2F2026",
    sourceUpdatedAt: null,
  },
  "br-selic-effective": {
    observations: [{
      date: "2026-08-28",
      period: "2026-08-28",
      sourceDate: "28/08/2026",
      value: 13.9,
      rawValue: "13.90",
      status: "observed",
    }],
    retrievedAt: "2026-08-31T18:20:00.000Z",
    upstreamUrl: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados?formato=json&dataInicial=28%2F08%2F2026&dataFinal=31%2F08%2F2026",
    sourceUpdatedAt: null,
  },
};

export function getBundledFallback(indicatorId: string, range: DateRange): SeriesResult | null {
  const bundled = BUNDLED_LATEST[indicatorId]
    ?? (bundledSeries as Record<string, SeriesResult>)[indicatorId];
  if (!bundled) return null;
  const observations = bundled.observations.filter(
    (observation) => observation.date >= range.start && observation.date <= range.end,
  );
  return observations.length > 0 ? { ...bundled, observations } : null;
}
