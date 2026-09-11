/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleApi } from "../lib/api/router";
import { handleTelemetry, recordMcpRequest } from "../lib/telemetry";
import { handleMcp } from "../lib/mcp/server";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  OPENAI_APPS_CHALLENGE?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function productionResponse(request: Request, response: Response) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Strict-Transport-Security", "max-age=31536000");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");

  if (url.pathname.startsWith("/_next/static/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (["/og.png", "/icon.svg"].includes(url.pathname)) {
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
  } else if ((request.method === "GET" || request.method === "HEAD") && headers.get("content-type")?.startsWith("text/html") && response.ok) {
    headers.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  }

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/.well-known/openai-apps-challenge") {
      const token = env.OPENAI_APPS_CHALLENGE?.trim();
      return token
        ? new Response(token, { headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } })
        : new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/_events") {
      return handleTelemetry(request, env.DB);
    }

    if (url.pathname === "/mcp" || url.pathname === "/api/mcp") {
      const telemetryRequest = request.clone();
      const response = await handleMcp(request);
      ctx.waitUntil(recordMcpRequest(env.DB, telemetryRequest, response.clone()));
      return response;
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api") {
        return Response.redirect(new URL("/api/v1", request.url), 308);
      }
      return handleApi(request, env, ctx);
    }

    return productionResponse(request, await handler.fetch(request, env, ctx));
  },
};

export default worker;
