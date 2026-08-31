import { indicators, catalogSummary, categoryLabels } from "@/lib/catalog/indicators";
import { sources } from "@/lib/catalog/sources";
import { ApiError } from "@/lib/errors";
import { createOpenApiDocument } from "@/lib/api/openapi";
import { parseCatalogQuery, parseObservationQuery } from "@/lib/api/query";
import { publicIndicator, publicSource } from "@/lib/api/serialization";
import { getSeries } from "@/lib/services/series-service";
import type { IndicatorDefinition, Observation } from "@/lib/domain/types";
import { recordApiRequest, recordApiSearch } from "@/lib/telemetry";

export interface ApiEnv {
  DB?: D1Database;
}

interface ApiExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type, X-Request-Id",
  "Access-Control-Expose-Headers": "Cache-Control, Server-Timing, Warning, X-Request-Id",
  "Access-Control-Max-Age": "86400",
};

function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._-]{1,100}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

function commonHeaders(id: string, cacheControl = "public, max-age=60, s-maxage=300") {
  return {
    ...CORS_HEADERS,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": id,
    Vary: "Accept",
  };
}

function json(
  data: unknown,
  id: string,
  init: ResponseInit = {},
  cacheControl?: string,
) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  Object.entries(commonHeaders(id, cacheControl)).forEach(([key, value]) => headers.set(key, value));
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function problem(error: unknown, id: string, origin: string) {
  let apiError: ApiError;
  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof Error && error.name === "AbortError") {
    apiError = new ApiError(504, "UPSTREAM_TIMEOUT", "The official source did not respond in time.");
  } else {
    console.error(JSON.stringify({ request_id: id, error_code: "INTERNAL_ERROR" }));
    apiError = new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
  }

  const headers = new Headers(commonHeaders(id, "no-store"));
  headers.set("Content-Type", "application/problem+json; charset=utf-8");
  if (apiError.retryAfter) headers.set("Retry-After", String(apiError.retryAfter));
  return new Response(
    JSON.stringify(
      {
        type: `${origin}/docs/errors#${apiError.code.toLowerCase()}`,
        title: apiError.message,
        status: apiError.status,
        detail: apiError.detail ?? apiError.message,
        code: apiError.code,
        request_id: id,
      },
      null,
      2,
    ),
    { status: apiError.status, headers },
  );
}

function findIndicator(rawId: string) {
  if (!/^br-[a-z0-9-]+$/.test(rawId)) {
    throw new ApiError(400, "INVALID_INDICATOR_ID", "Indicator IDs use lowercase letters, numbers, and hyphens.");
  }
  const indicator = indicators.find((item) => item.id === rawId);
  if (!indicator) throw new ApiError(404, "INDICATOR_NOT_FOUND", `Indicator not found: ${rawId}`);
  return indicator;
}

function serializeObservation(observation: Observation) {
  return {
    date: observation.date,
    period: observation.period,
    source_date: observation.sourceDate,
    value: observation.value,
    raw_value: observation.rawValue,
    status: observation.status,
  };
}

function csvEscape(value: string | number | null) {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(
  indicator: IndicatorDefinition,
  upstreamUrl: string,
  observations: Observation[],
) {
  const rows = [
    ["indicator_id", "source_id", "source_url", "upstream_url", "date", "period", "value", "status", "source_date", "raw_value"],
    ...observations.map((item) => [
      indicator.id,
      indicator.sourceAgency.toLowerCase(),
      indicator.sourceUrl,
      upstreamUrl,
      item.date,
      item.period,
      item.value,
      item.status,
      item.sourceDate,
      item.rawValue,
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function filterCatalog(url: URL) {
  const query = parseCatalogQuery(url);
  const matches = indicators.filter((indicator) => {
    const haystack = [
      indicator.id,
      indicator.name,
      indicator.officialName,
      indicator.description,
      indicator.category,
      categoryLabels[indicator.category],
      indicator.sourceAgency,
      String(indicator.upstream.seriesCode ?? ""),
      String(indicator.upstream.aggregate ?? ""),
      String(indicator.upstream.variable ?? ""),
      ...indicator.aliases,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!query.q || haystack.includes(query.q)) &&
      (!query.category || indicator.category === query.category) &&
      (!query.frequency || indicator.frequency === query.frequency) &&
      (!query.source || indicator.sourceAgency.toLowerCase() === query.source)
    );
  });
  return { matches: matches.slice(0, query.limit), total: matches.length, query };
}

function apiBase(url: URL) {
  return `${url.origin}/api/v1`;
}

function catalogFilters() {
  return {
    categories: Object.entries(categoryLabels).map(([id, name]) => ({ id, name })),
    frequencies: ["daily", "monthly", "quarterly", "annual"],
    sources: sources.map((source) => ({ id: source.id, name: source.name, short_name: source.shortName })),
  };
}

function decodeIndicatorId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ApiError(400, "INVALID_INDICATOR_ID", "Indicator IDs use lowercase letters, numbers, and hyphens.");
  }
}

function seriesPayload(
  requestUrl: URL,
  indicator: IndicatorDefinition,
  observations: Observation[],
  series: Awaited<ReturnType<typeof getSeries>>,
  available: number,
  limit: number,
  truncated: boolean,
) {
  const base = apiBase(requestUrl);
  return {
    data: observations.map(serializeObservation),
    meta: {
      indicator: publicIndicator(indicator, base),
      source: publicSource(indicator.sourceAgency),
      provenance: {
        provider: indicator.provider,
        upstream_url: series.result.upstreamUrl,
        source_url: indicator.sourceUrl,
        retrieved_at: series.result.retrievedAt,
        source_updated_at: series.result.sourceUpdatedAt,
        license: indicator.license,
        license_url: indicator.licenseUrl,
      },
      transformations: indicator.transformations,
      cache: series.cache,
      stale: series.stale,
      returned: observations.length,
      available,
      limit,
      truncated,
    },
    links: {
      self: requestUrl.toString(),
      indicator: `${base}/indicators/${indicator.id}`,
    },
  };
}

async function observationsResponse(
  request: Request,
  env: ApiEnv,
  id: string,
  latestOnly = false,
) {
  const url = new URL(request.url);
  const indicatorId = decodeIndicatorId(url.pathname.split("/").filter(Boolean).at(-2) ?? "");
  const indicator = findIndicator(indicatorId);

  let query;
  if (latestOnly) {
    if ([...url.searchParams.keys()].length > 0) {
      throw new ApiError(400, "UNKNOWN_QUERY_PARAMETER", "The latest endpoint does not accept query parameters.");
    }
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    now.setUTCFullYear(now.getUTCFullYear() - (indicator.frequency === "daily" ? 1 : 5));
    query = { start: now.toISOString().slice(0, 10), end, order: "desc" as const, limit: 1, format: "json" as const };
  } else {
    query = parseObservationQuery(url, indicator.frequency);
  }

  const started = performance.now();
  const series = await getSeries(
    indicator,
    { start: query.start, end: query.end },
    {
      db: env.DB,
      // A rolling date range gives /latest a different range key every day.
      // Keep one stable snapshot so a brief publisher outage can still return
      // the most recently verified observation with stale=true.
      snapshotKey: latestOnly ? `v2:${indicator.id}:latest` : undefined,
    },
  );

  let ordered = [...series.result.observations];
  if (query.order === "desc") ordered.reverse();
  const available = ordered.length;
  const truncated = available > query.limit;
  ordered = ordered.slice(0, query.limit);

  const headers = new Headers();
  headers.set("Server-Timing", `total;dur=${(performance.now() - started).toFixed(1)}`);
  if (series.stale) headers.set("Warning", '110 - "Response is stale; official source refresh failed"');

  if (!latestOnly && query.format === "csv") {
    Object.entries(commonHeaders(id, `public, max-age=60, s-maxage=${indicator.cacheTtlSeconds}, stale-if-error=86400`))
      .forEach(([key, value]) => headers.set(key, value));
    headers.set("Content-Type", "text/csv; charset=utf-8");
    headers.set("Content-Disposition", `attachment; filename="${indicator.id}.csv"`);
    return new Response(toCsv(indicator, series.result.upstreamUrl, ordered), { headers });
  }

  return json(
    seriesPayload(url, indicator, ordered, series, available, query.limit, truncated),
    id,
    { headers },
    `public, max-age=60, s-maxage=${indicator.cacheTtlSeconds}, stale-if-error=86400`,
  );
}

async function routeGet(request: Request, env: ApiEnv, id: string, ctx: ApiExecutionContext) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");

  if (path === "/api/v1") {
    const base = apiBase(url);
    return json(
      {
        name: "Open Economics API",
        version: "v1",
        status: "ready",
        description: "Authoritative Brazilian economic data through one consistent interface.",
        data_policy: "Values are never fabricated. Source licenses and transformations are disclosed per series.",
        links: {
          self: base,
          indicators: `${base}/indicators`,
          sources: `${base}/sources`,
          openapi: `${base}/openapi.json`,
          health: `${base}/health`,
        },
      },
      id,
    );
  }

  if (path === "/api/v1/health") {
    return json(
      {
        status: "ok",
        version: "v1",
        catalog: catalogSummary,
        checks: { router: "ok", catalog: indicators.length > 0 ? "ok" : "error" },
        checked_at: new Date().toISOString(),
        note: "Readiness does not call upstream publishers.",
      },
      id,
      {},
      "no-store",
    );
  }

  if (path === "/api/v1/openapi.json") {
    return json(createOpenApiDocument(url.origin), id, {}, "public, max-age=300, s-maxage=3600");
  }

  if (path === "/api/v1/sources") {
    return json(
      {
        data: sources.map((source) => ({
          id: source.id,
          name: source.name,
          short_name: source.shortName,
          description: source.description,
          homepage: source.homepage,
          catalog_url: source.catalogUrl,
          license: source.license,
          license_url: source.licenseUrl,
          attribution: source.attribution,
          indicators: indicators.filter((indicator) => indicator.sourceAgency === source.shortName).length,
        })),
        meta: { count: sources.length },
        links: { self: url.toString() },
      },
      id,
    );
  }

  if (path === "/api/v1/indicators") {
    const { matches, total, query } = filterCatalog(url);
    ctx.waitUntil(recordApiSearch(env.DB, request, total));
    const base = apiBase(url);
    return json(
      {
        data: matches.map((indicator) => publicIndicator(indicator, base)),
        meta: {
          returned: matches.length,
          total,
          limit: query.limit,
          filters: {
            q: query.q || null,
            category: query.category,
            frequency: query.frequency,
            source: query.source,
          },
          available_filters: catalogFilters(),
        },
        links: { self: url.toString() },
      },
      id,
    );
  }

  const observationsMatch = /^\/api\/v1\/indicators\/([^/]+)\/observations$/.exec(path);
  if (observationsMatch) return observationsResponse(request, env, id);

  const latestMatch = /^\/api\/v1\/indicators\/([^/]+)\/latest$/.exec(path);
  if (latestMatch) return observationsResponse(request, env, id, true);

  const indicatorMatch = /^\/api\/v1\/indicators\/([^/]+)$/.exec(path);
  if (indicatorMatch) {
    const indicator = findIndicator(decodeIndicatorId(indicatorMatch[1]));
    return json(
      { data: publicIndicator(indicator, apiBase(url)), links: { self: url.toString() } },
      id,
    );
  }

  throw new ApiError(404, "ROUTE_NOT_FOUND", `API route not found: ${path}`);
}

export async function handleApi(
  request: Request,
  env: ApiEnv,
  ctx: ApiExecutionContext,
): Promise<Response> {
  const id = requestId(request);
  const origin = new URL(request.url).origin;
  const started = performance.now();

  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: commonHeaders(id, "public, max-age=86400") });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      const response = problem(new ApiError(405, "METHOD_NOT_ALLOWED", "Only GET, HEAD, and OPTIONS are supported."), id, origin);
      response.headers.set("Allow", "GET, HEAD, OPTIONS");
      return response;
    }

    const response = await routeGet(request, env, id, ctx);
    const output =
      request.method === "HEAD"
        ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers })
        : response;
    console.log(
      JSON.stringify({
        request_id: id,
        method: request.method,
        path: new URL(request.url).pathname,
        status: output.status,
        duration_ms: Number((performance.now() - started).toFixed(1)),
      }),
    );
    ctx.waitUntil(recordApiRequest(env.DB, request, output.status));
    return output;
  } catch (error) {
    const response = problem(error, id, origin);
    ctx.waitUntil(recordApiRequest(env.DB, request, response.status));
    return request.method === "HEAD"
      ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers })
      : response;
  }
}
