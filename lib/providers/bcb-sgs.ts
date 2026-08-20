import { ApiError } from "@/lib/errors";
import type { Observation } from "@/lib/domain/types";
import type { ProviderAdapter } from "@/lib/providers/provider";

const MAX_RESPONSE_BYTES = 5_000_000;

interface BcbRow {
  data?: unknown;
  valor?: unknown;
}

function isoToBcbDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function bcbDateToIso(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB returned an invalid date.");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function parseBcbRows(payload: unknown): Observation[] {
  if (!Array.isArray(payload)) {
    throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB returned an unexpected response shape.");
  }

  const observations = payload.map((row): Observation => {
    if (!row || typeof row !== "object") {
      throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB returned an invalid observation.");
    }
    const { data, valor } = row as BcbRow;
    if (typeof data !== "string" || typeof valor !== "string") {
      throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB returned an invalid observation.");
    }
    const date = bcbDateToIso(data);
    const value = Number(valor.replace(",", "."));
    if (!Number.isFinite(value)) {
      throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB returned a non-numeric value.");
    }
    return {
      date,
      period: date.slice(0, 7),
      sourceDate: data,
      value,
      rawValue: valor,
      status: valor === "0" || valor === "0.0" || valor === "0.00" ? "rounded-zero" : "observed",
    };
  });

  const deduplicated = new Map(observations.map((item) => [item.date, item]));
  return [...deduplicated.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export const bcbSgsProvider: ProviderAdapter = {
  id: "bcb-sgs",
  async fetchSeries(definition, range, context) {
    const code = definition.upstream.seriesCode;
    if (!code) throw new ApiError(500, "CATALOG_ERROR", "The indicator is missing its SGS code.");

    const url = new URL(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados`);
    url.searchParams.set("formato", "json");
    url.searchParams.set("dataInicial", isoToBcbDate(range.start));
    url.searchParams.set("dataFinal", isoToBcbDate(range.end));

    const response = await context.fetcher(url, {
      headers: { Accept: "application/json", "User-Agent": "OpenEconomicsAPI/1.0" },
      signal: context.signal,
      cf: { cacheEverything: true, cacheTtl: definition.cacheTtlSeconds },
    } as RequestInit & { cf: Record<string, unknown> });

    if (!response.ok) {
      throw new ApiError(
        response.status === 429 ? 503 : 502,
        response.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_ERROR",
        "Banco Central do Brasil is temporarily unavailable.",
        `BCB SGS responded with HTTP ${response.status}.`,
        response.status === 429 ? 60 : undefined,
      );
    }

    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_RESPONSE_BYTES) {
      throw new ApiError(502, "UPSTREAM_RESPONSE_TOO_LARGE", "BCB returned too much data.");
    }
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new ApiError(502, "UPSTREAM_RESPONSE_TOO_LARGE", "BCB returned too much data.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(502, "UPSTREAM_SCHEMA_ERROR", "BCB returned invalid JSON.");
    }

    return {
      observations: parseBcbRows(payload),
      retrievedAt: new Date().toISOString(),
      upstreamUrl: url.toString(),
      sourceUpdatedAt: null,
    };
  },
};
