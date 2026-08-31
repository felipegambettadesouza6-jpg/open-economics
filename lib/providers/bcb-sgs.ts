import { ApiError } from "@/lib/errors";
import type { Frequency, Observation } from "@/lib/domain/types";
import type { ProviderAdapter } from "@/lib/providers/provider";

const MAX_RESPONSE_BYTES = 5_000_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([403, 408, 425, 429]);

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

function shouldRetry(status: number) {
  return RETRYABLE_STATUSES.has(status) || status >= 500;
}

async function retryDelay(attempt: number, signal: AbortSignal) {
  const delayMs = 50 * (2 ** attempt);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      const error = new Error("Upstream request aborted.");
      error.name = "AbortError";
      reject(error);
    }, { once: true });
  });
}

export function parseBcbRows(payload: unknown, frequency: Frequency): Observation[] {
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
      period: frequency === "daily" ? date : date.slice(0, 7),
      sourceDate: data,
      value,
      rawValue: valor,
      // SGS publishes numeric values without the distinct missing/suppression
      // symbols used by IBGE, so every parsed numeric zero is an observation.
      status: "observed",
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

    let response: Response | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        response = await context.fetcher(url, {
          headers: { Accept: "application/json", "User-Agent": "OpenEconomicsAPI/1.0" },
          signal: context.signal,
          cf: { cacheEverything: true, cacheTtl: definition.cacheTtlSeconds },
        } as RequestInit & { cf: Record<string, unknown> });
      } catch (error) {
        if (context.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
          throw error;
        }
        if (attempt === MAX_ATTEMPTS - 1) throw error;
        await retryDelay(attempt, context.signal);
        continue;
      }

      if (response.ok || !shouldRetry(response.status) || attempt === MAX_ATTEMPTS - 1) break;
      await retryDelay(attempt, context.signal);
    }

    if (!response) {
      throw new ApiError(502, "UPSTREAM_CONNECTION_ERROR", "Banco Central do Brasil is temporarily unavailable.");
    }

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
      observations: parseBcbRows(payload, definition.frequency).filter(
        (observation) => observation.date >= range.start && observation.date <= range.end,
      ),
      retrievedAt: new Date().toISOString(),
      upstreamUrl: url.toString(),
      sourceUpdatedAt: null,
    };
  },
};
