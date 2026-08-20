import { ApiError } from "@/lib/errors";
import type { Category, Frequency } from "@/lib/domain/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validIsoDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function yearsAgo(iso: string, years: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

export interface ObservationQuery {
  start: string;
  end: string;
  order: "asc" | "desc";
  limit: number;
  format: "json" | "csv";
}

const CATEGORIES: Category[] = [
  "inflation",
  "interest-rates",
  "currencies",
  "activity",
  "labor",
  "credit",
  "fiscal",
  "external",
  "markets",
];

const FREQUENCIES: Frequency[] = ["daily", "monthly", "quarterly", "annual"];
const SOURCES = ["bcb", "ibge"] as const;

export function parseObservationQuery(url: URL, frequency: Frequency): ObservationQuery {
  const allowed = new Set(["start", "end", "order", "limit", "format"]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) {
      throw new ApiError(400, "UNKNOWN_QUERY_PARAMETER", `Unknown query parameter: ${key}`);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const defaultYears = frequency === "daily" ? 3 : frequency === "monthly" ? 10 : 20;
  const end = url.searchParams.get("end") ?? today;
  const start = url.searchParams.get("start") ?? yearsAgo(end, defaultYears);
  if (!validIsoDate(start) || !validIsoDate(end)) {
    throw new ApiError(400, "INVALID_DATE", "start and end must use the YYYY-MM-DD format.");
  }
  if (start > end) {
    throw new ApiError(400, "INVALID_DATE_RANGE", "start must be on or before end.");
  }
  if (end > today) {
    throw new ApiError(400, "DATE_IN_FUTURE", "end cannot be later than today.");
  }

  if (frequency === "daily") {
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const days = (endDate.valueOf() - startDate.valueOf()) / 86_400_000;
    if (days > 3660) {
      throw new ApiError(
        400,
        "DATE_RANGE_TOO_LARGE",
        "Daily BCB series are limited to ten years per request.",
        "This mirrors the official SGS upstream limit.",
      );
    }
  }

  const orderValue = url.searchParams.get("order") ?? "asc";
  if (orderValue !== "asc" && orderValue !== "desc") {
    throw new ApiError(400, "INVALID_ORDER", "order must be asc or desc.");
  }

  const limitValue = url.searchParams.get("limit") ?? "5000";
  if (!/^\d+$/.test(limitValue)) {
    throw new ApiError(400, "INVALID_LIMIT", "limit must be an integer from 1 to 5000.");
  }
  const limit = Number(limitValue);
  if (limit < 1 || limit > 5000) {
    throw new ApiError(400, "INVALID_LIMIT", "limit must be an integer from 1 to 5000.");
  }

  const formatValue = url.searchParams.get("format") ?? "json";
  if (formatValue !== "json" && formatValue !== "csv") {
    throw new ApiError(400, "INVALID_FORMAT", "format must be json or csv.");
  }

  return { start, end, order: orderValue, limit, format: formatValue };
}

export function parseCatalogQuery(url: URL) {
  const allowed = new Set(["q", "category", "frequency", "source", "limit"]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) {
      throw new ApiError(400, "UNKNOWN_QUERY_PARAMETER", `Unknown query parameter: ${key}`);
    }
  }
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length > 200) {
    throw new ApiError(400, "INVALID_SEARCH_QUERY", "q must be 200 characters or fewer.");
  }

  const categoryValue = url.searchParams.get("category");
  const category = categoryValue?.trim().toLowerCase() || null;
  if (category && !CATEGORIES.includes(category as Category)) {
    throw new ApiError(400, "INVALID_CATEGORY", `category must be one of: ${CATEGORIES.join(", ")}.`);
  }

  const frequencyValue = url.searchParams.get("frequency");
  const frequency = frequencyValue?.trim().toLowerCase() || null;
  if (frequency && !FREQUENCIES.includes(frequency as Frequency)) {
    throw new ApiError(400, "INVALID_FREQUENCY", `frequency must be one of: ${FREQUENCIES.join(", ")}.`);
  }

  const sourceValue = url.searchParams.get("source");
  const source = sourceValue?.trim().toLowerCase() || null;
  if (source && !SOURCES.includes(source as (typeof SOURCES)[number])) {
    throw new ApiError(400, "INVALID_SOURCE", `source must be one of: ${SOURCES.join(", ")}.`);
  }

  const limitValue = url.searchParams.get("limit") ?? "100";
  if (!/^\d+$/.test(limitValue)) throw new ApiError(400, "INVALID_LIMIT", "limit must be an integer.");
  const limit = Number(limitValue);
  if (limit < 1 || limit > 500) throw new ApiError(400, "INVALID_LIMIT", "limit must be from 1 to 500.");
  return {
    q,
    category: category as Category | null,
    frequency: frequency as Frequency | null,
    source: source as (typeof SOURCES)[number] | null,
    limit,
  };
}
