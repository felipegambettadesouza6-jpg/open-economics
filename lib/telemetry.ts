import { indicators } from "@/lib/catalog/indicators";

type TelemetryEvent =
  | {
      event: "page_view";
      path?: unknown;
      referrer?: unknown;
      session?: unknown;
    }
  | {
      event: "search";
      locale?: unknown;
      query?: unknown;
      results?: unknown;
      session?: unknown;
      surface?: unknown;
    }
  | {
      event: "browser_error";
      kind?: unknown;
      path?: unknown;
      session?: unknown;
    };

const SEARCH_SURFACES = new Set(["hero", "home", "atlas", "catalog", "docs", "playground"]);
const SEARCH_ENGINES = ["google.", "bing.", "duckduckgo.", "search.yahoo.", "ecosia.", "brave."];
const SOCIAL_SITES = ["linkedin.", "x.com", "twitter.", "facebook.", "instagram.", "reddit.", "youtube."];

function day() {
  return new Date().toISOString().slice(0, 10);
}

function stableDimension(values: Record<string, string | number>) {
  return JSON.stringify(Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b))));
}

async function increment(db: D1Database | undefined, event: string, values: Record<string, string | number>) {
  if (!db) return;
  const now = Date.now();
  await db.prepare(
    `INSERT INTO usage_counters (day, event, dimension, count, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(day, event, dimension)
     DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
  ).bind(day(), event, stableDimension(values), now).run();
}

async function recordUnique(db: D1Database | undefined, rawSession: unknown) {
  if (!db || typeof rawSession !== "string" || !/^[a-f0-9-]{16,64}$/i.test(rawSession)) return;
  const today = day();
  const bytes = new TextEncoder().encode(`${today}:${rawSession}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  await db.prepare(
    "INSERT OR IGNORE INTO usage_uniques (day, session_hash, created_at) VALUES (?, ?, ?)",
  ).bind(today, hash, Date.now()).run();
}

function cleanPath(value: unknown) {
  if (typeof value !== "string" || value.length > 180 || !value.startsWith("/")) return "/unknown";
  return value.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
}

function localeFromPath(path: string) {
  return path === "/pt-br" || path.startsWith("/pt-br/") ? "pt-br" : "en";
}

function referrer(value: unknown, ownHost: string) {
  if (typeof value !== "string" || !value || value.length > 180) return { channel: "direct", referrer: "direct" };
  const host = value.toLowerCase().replace(/^www\./, "");
  if (host === ownHost.toLowerCase().replace(/^www\./, "")) return { channel: "internal", referrer: "internal" };
  if (SEARCH_ENGINES.some((item) => host.includes(item))) return { channel: "organic", referrer: host };
  if (SOCIAL_SITES.some((item) => host.includes(item))) return { channel: "social", referrer: host };
  return { channel: "referral", referrer: host.replace(/[^a-z0-9.-]/g, "").slice(0, 100) || "unknown" };
}

function cleanQuery(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLocaleLowerCase().replace(/\s+/g, " ").slice(0, 80);
  if (normalized.length < 2 || normalized.includes("@") || /https?:|\d{7,}/i.test(normalized)) return "";
  return normalized.replace(/[^\p{L}\p{N}\s._/-]/gu, "");
}

export async function handleTelemetry(request: Request, db: D1Database | undefined) {
  const url = new URL(request.url);
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== url.origin) || (fetchSite && fetchSite !== "same-origin")) {
    return new Response(null, { status: 403 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2048) return new Response(null, { status: 413 });

  let payload: TelemetryEvent;
  try {
    const body = await request.text();
    if (body.length > 2048) return new Response(null, { status: 413 });
    payload = JSON.parse(body) as TelemetryEvent;
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    await recordUnique(db, payload.session);
    if (payload.event === "page_view") {
      const path = cleanPath(payload.path);
      const source = referrer(payload.referrer, url.hostname);
      await increment(db, "page_view", { path, locale: localeFromPath(path), ...source });
    } else if (payload.event === "search") {
      const query = cleanQuery(payload.query);
      const surface = typeof payload.surface === "string" && SEARCH_SURFACES.has(payload.surface) ? payload.surface : "unknown";
      const locale = payload.locale === "pt-br" ? "pt-br" : "en";
      const results = Number.isInteger(payload.results) ? Math.max(0, Math.min(5000, Number(payload.results))) : -1;
      if (query) await increment(db, "search", { surface, locale, query, results });
    } else if (payload.event === "browser_error") {
      const kind = payload.kind === "unhandledrejection" ? "unhandledrejection" : "error";
      await increment(db, "browser_error", { kind, path: cleanPath(payload.path) });
    } else {
      return new Response(null, { status: 400 });
    }
  } catch (error) {
    console.error(JSON.stringify({ telemetry: "write_failed", error: error instanceof Error ? error.name : "unknown" }));
  }

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function apiMetric(request: Request, status: number) {
  const url = new URL(request.url);
  const indicatorId = /^\/api\/v1\/indicators\/([^/]+)/.exec(url.pathname)?.[1] ?? "none";
  const indicator = indicators.find((item) => item.id === indicatorId);
  const route = url.pathname === "/api/v1/indicators"
    ? "catalog"
    : url.pathname.endsWith("/observations")
      ? "observations"
      : url.pathname.endsWith("/latest")
        ? "latest"
        : url.pathname === "/api/v1/health"
          ? "health"
          : url.pathname === "/api/v1/openapi.json"
            ? "openapi"
            : url.pathname === "/api/v1/sources"
              ? "sources"
              : indicator ? "indicator" : "discovery";
  return {
    route,
    indicator: indicator?.id ?? "none",
    source: indicator?.sourceAgency ?? "none",
    format: url.searchParams.get("format") === "csv" ? "csv" : "json",
    status,
  };
}

export async function recordApiRequest(db: D1Database | undefined, request: Request, status: number) {
  try {
    await increment(db, "api_request", apiMetric(request, status));
  } catch (error) {
    console.error(JSON.stringify({ telemetry: "api_write_failed", error: error instanceof Error ? error.name : "unknown" }));
  }
}

export async function recordApiSearch(db: D1Database | undefined, request: Request, results: number) {
  const query = cleanQuery(new URL(request.url).searchParams.get("q"));
  if (!query) return;
  try {
    await increment(db, "search", { surface: "api", locale: "unknown", query, results });
  } catch (error) {
    console.error(JSON.stringify({ telemetry: "search_write_failed", error: error instanceof Error ? error.name : "unknown" }));
  }
}
