import { indicators } from "@/lib/catalog/indicators";

type TelemetryEvent =
  | {
      event: "page_view";
      actor?: unknown;
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
    }
  | {
      event: "performance";
      device?: unknown;
      load_ms?: unknown;
      path?: unknown;
      session?: unknown;
      ttfb_ms?: unknown;
    }
  | {
      action?: unknown;
      actor?: unknown;
      event: "activation";
      path?: unknown;
      session?: unknown;
    };

const SEARCH_SURFACES = new Set(["hero", "home", "atlas", "catalog", "docs", "playground"]);
const ACTIVATION_ACTIONS = new Set([
  "api_url_copy",
  "code_copy",
  "csv_download",
  "indicator_view",
  "playground_run",
  "raw_response_open",
  "response_copy",
]);
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

async function actorHash(rawActor: unknown) {
  if (typeof rawActor !== "string" || !/^[a-f0-9-]{16,64}$/i.test(rawActor)) return "";
  const bytes = new TextEncoder().encode(`open-economics-actor-v1:${rawActor}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function recordActor(db: D1Database | undefined, rawActor: unknown, activation: string | null = null) {
  if (!db) return;
  const hash = await actorHash(rawActor);
  if (!hash) return;
  const today = day();
  const now = Date.now();
  const activatedAt = activation ? now : null;
  await db.prepare(
    `INSERT INTO usage_actors (
       actor_hash, first_seen_day, last_seen_day, active_days,
       first_activated_at, last_activated_at, activation_type, activation_count,
       created_at, updated_at
     ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(actor_hash) DO UPDATE SET
       active_days = usage_actors.active_days + CASE WHEN usage_actors.last_seen_day <> excluded.last_seen_day THEN 1 ELSE 0 END,
       last_seen_day = excluded.last_seen_day,
       first_activated_at = COALESCE(usage_actors.first_activated_at, excluded.first_activated_at),
       last_activated_at = COALESCE(excluded.last_activated_at, usage_actors.last_activated_at),
       activation_type = COALESCE(usage_actors.activation_type, excluded.activation_type),
       activation_count = usage_actors.activation_count + excluded.activation_count,
       updated_at = excluded.updated_at`,
  ).bind(hash, today, today, activatedAt, activatedAt, activation, activation ? 1 : 0, now, now).run();
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

function timingBucket(value: unknown) {
  const milliseconds = typeof value === "number" && Number.isFinite(value) ? value : -1;
  if (milliseconds < 0) return "unknown";
  if (milliseconds < 500) return "under_500ms";
  if (milliseconds < 1000) return "500_999ms";
  if (milliseconds < 2000) return "1_2s";
  if (milliseconds < 4000) return "2_4s";
  return "over_4s";
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
      const indicatorId = /^\/(?:en|pt-br)\/indicators\/([^/]+)$/.exec(path)?.[1];
      const activation = indicatorId && indicators.some((item) => item.id === indicatorId) ? "indicator_view" : null;
      await recordActor(db, payload.actor, activation);
      await increment(db, "page_view", { path, locale: localeFromPath(path), ...source });
      if (activation) await increment(db, "activation", { action: activation, path, locale: localeFromPath(path) });
    } else if (payload.event === "search") {
      const query = cleanQuery(payload.query);
      const surface = typeof payload.surface === "string" && SEARCH_SURFACES.has(payload.surface) ? payload.surface : "unknown";
      const locale = payload.locale === "pt-br" ? "pt-br" : "en";
      const results = Number.isInteger(payload.results) ? Math.max(0, Math.min(5000, Number(payload.results))) : -1;
      if (query) await increment(db, "search", { surface, locale, query, results });
    } else if (payload.event === "browser_error") {
      const kind = payload.kind === "unhandledrejection" ? "unhandledrejection" : "error";
      await increment(db, "browser_error", { kind, path: cleanPath(payload.path) });
    } else if (payload.event === "performance") {
      await increment(db, "performance", {
        path: cleanPath(payload.path),
        device: payload.device === "mobile" ? "mobile" : "desktop",
        load: timingBucket(payload.load_ms),
        ttfb: timingBucket(payload.ttfb_ms),
      });
    } else if (payload.event === "activation") {
      const action = typeof payload.action === "string" && ACTIVATION_ACTIONS.has(payload.action) ? payload.action : "";
      if (!action) return new Response(null, { status: 400 });
      const path = cleanPath(payload.path);
      await recordActor(db, payload.actor, action);
      await increment(db, "activation", { action, path, locale: localeFromPath(path) });
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
