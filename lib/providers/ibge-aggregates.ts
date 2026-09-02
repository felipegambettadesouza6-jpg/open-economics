import { ApiError } from "@/lib/errors";
import type { Frequency, IndicatorDefinition, Observation } from "@/lib/domain/types";
import type { ProviderAdapter } from "@/lib/providers/provider";

const MAX_RESPONSE_BYTES = 5_000_000;

interface IbgeSeries {
  serie?: Record<string, unknown>;
}

interface IbgeResult {
  series?: IbgeSeries[];
}

interface IbgeVariable {
  resultados?: IbgeResult[];
}

function startOfMonth(value: string) {
  return new Date(`${value.slice(0, 7)}-01T00:00:00Z`);
}

function quarterStart(value: string) {
  const date = startOfMonth(value);
  date.setUTCMonth(Math.floor(date.getUTCMonth() / 3) * 3, 1);
  return date;
}

function maxIso(left: string, right: string) {
  return left > right ? left : right;
}

/**
 * IBGE accepts an explicit pipe-delimited list of official period IDs. Building
 * that list avoids a broad `-1000` history request and makes the upstream URL
 * in provenance reproduce the requested coverage.
 */
export function ibgePeriodIds(definition: IndicatorDefinition, range: { start: string; end: string }) {
  const start = maxIso(range.start, definition.startDate);
  const end = range.end;
  if (start > end) return [];

  if (definition.frequency === "annual") {
    const periods: string[] = [];
    for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year += 1) periods.push(String(year));
    return periods;
  }

  const cursor = definition.frequency === "quarterly" ? quarterStart(start) : startOfMonth(start);
  const last = definition.frequency === "quarterly" ? quarterStart(end) : startOfMonth(end);
  const periods: string[] = [];
  while (cursor <= last) {
    const year = cursor.getUTCFullYear();
    if (definition.frequency === "quarterly") {
      periods.push(`${year}${String(Math.floor(cursor.getUTCMonth() / 3) + 1).padStart(2, "0")}`);
    } else {
      periods.push(`${year}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + (definition.frequency === "quarterly" ? 3 : 1), 1);
  }
  return periods;
}

function periodDetails(key: string, frequency: Frequency) {
  if (frequency === "annual" && /^\d{4}$/.test(key)) {
    return { date: `${key}-01-01`, period: key };
  }
  if (!/^\d{6}$/.test(key)) {
    throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "IBGE returned an invalid period.");
  }
  const year = key.slice(0, 4);
  const position = Number(key.slice(4));
  if (frequency === "quarterly") {
    if (position < 1 || position > 4) {
      throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "IBGE returned an invalid quarter.");
    }
    const month = String((position - 1) * 3 + 1).padStart(2, "0");
    return { date: `${year}-${month}-01`, period: `${year}-Q${position}` };
  }
  if (position < 1 || position > 12) {
    throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "IBGE returned an invalid month.");
  }
  const month = String(position).padStart(2, "0");
  return { date: `${year}-${month}-01`, period: `${year}-${month}` };
}

export function parseIbgeValue(rawValue: string) {
  if (rawValue === "-") return { value: 0, status: "absolute-zero" as const };
  if (rawValue === "0") return { value: 0, status: "rounded-zero" as const };
  if (rawValue === "X") return { value: null, status: "suppressed" as const };
  if (rawValue === "..") return { value: null, status: "not-applicable" as const };
  if (rawValue === "...") return { value: null, status: "unavailable" as const };
  if (/^[A-WYZ]$/i.test(rawValue)) return { value: null, status: "quality-flag" as const };
  if (!/^-?\d+(?:[.,]\d+)?$/.test(rawValue)) {
    return { value: null, status: "missing" as const };
  }
  const value = Number(rawValue.replace(",", "."));
  if (!Number.isFinite(value)) return { value: null, status: "missing" as const };
  return { value, status: "observed" as const };
}

export function parseIbgeResponse(
  payload: unknown,
  definition: IndicatorDefinition,
): Observation[] {
  const variables = Array.isArray(payload) ? payload : [payload];
  const variable = variables.find(
    (item) => item && typeof item === "object" && String((item as { id?: unknown }).id) === String(definition.upstream.variable),
  ) as IbgeVariable | undefined;

  const series = variable?.resultados?.flatMap((result) => result.series ?? []) ?? [];
  const rawSeries = series[0]?.serie;
  if (!rawSeries || typeof rawSeries !== "object") {
    throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "IBGE returned no usable national series.");
  }

  return Object.entries(rawSeries)
    .map(([key, raw]): Observation => {
      const rawValue = String(raw);
      const { date, period } = periodDetails(key, definition.frequency);
      const parsed = parseIbgeValue(rawValue);
      return {
        date,
        period,
        sourceDate: key,
        rawValue,
        ...parsed,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const ibgeAggregatesProvider: ProviderAdapter = {
  id: "ibge-aggregates",
  async fetchSeries(definition, range, context) {
    const { aggregate, variable, classification } = definition.upstream;
    if (!aggregate || !variable) {
      throw new ApiError(500, "CATALOG_ERROR", "The indicator is missing its IBGE identifiers.");
    }

    const periods = ibgePeriodIds(definition, range);
    if (periods.length === 0) {
      return {
        observations: [],
        retrievedAt: new Date().toISOString(),
        upstreamUrl: definition.sourceUrl,
        sourceUpdatedAt: null,
      };
    }
    const url = new URL(
      `https://servicodados.ibge.gov.br/api/v3/agregados/${aggregate}/periodos/${periods.join("|")}/variaveis/${variable}`,
    );
    url.searchParams.set("localidades", "BR");
    if (classification) url.searchParams.set("classificacao", classification);

    const response = await context.fetcher(url, {
      headers: { Accept: "application/json", "User-Agent": "OpenEconomicsAPI/1.0" },
      signal: context.signal,
      // Range-aware D1 snapshots provide the application cache. Avoid the
      // platform fetch cache here because period-specific IBGE URLs must never
      // reuse a response produced for another period set.
      cache: "no-store",
    });

    if (!response.ok) {
      throw new ApiError(
        response.status === 429 ? 503 : 502,
        response.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_ERROR",
        "IBGE is temporarily unavailable.",
        `IBGE Aggregates responded with HTTP ${response.status}.`,
        response.status === 429 ? 60 : undefined,
      );
    }

    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_RESPONSE_BYTES) {
      throw new ApiError(502, "UPSTREAM_RESPONSE_TOO_LARGE", "IBGE returned too much data.");
    }
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new ApiError(502, "UPSTREAM_RESPONSE_TOO_LARGE", "IBGE returned too much data.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "IBGE returned invalid JSON.");
    }

    const observations = parseIbgeResponse(payload, definition).filter(
      (observation) => observation.date >= range.start && observation.date <= range.end,
    );

    return {
      observations,
      retrievedAt: new Date().toISOString(),
      upstreamUrl: url.toString(),
      sourceUpdatedAt: null,
    };
  },
};
