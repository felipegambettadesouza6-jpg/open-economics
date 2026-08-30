"use client";

import { useEffect } from "react";

type SearchTelemetry = {
  locale: "en" | "pt-br";
  query: string;
  results: number;
  surface: "hero" | "home" | "atlas" | "catalog" | "docs" | "playground";
};

function sessionId() {
  try {
    const key = "oe-session";
    const current = sessionStorage.getItem(key);
    if (current) return current;
    const next = crypto.randomUUID();
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

export function sendTelemetry(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  void fetch("/_events", {
    method: "POST",
    body: JSON.stringify({ ...payload, session: sessionId() }),
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    credentials: "omit",
    keepalive: true,
  }).catch(() => undefined);
}

export function useSearchTelemetry({ locale, query, results, surface }: SearchTelemetry) {
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    const timer = window.setTimeout(() => {
      sendTelemetry({ event: "search", locale, query: normalized, results, surface });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [locale, query, results, surface]);
}

export function Telemetry() {
  useEffect(() => {
    let referrer = "";
    try { referrer = document.referrer ? new URL(document.referrer).hostname : ""; } catch { referrer = ""; }
    sendTelemetry({ event: "page_view", path: window.location.pathname, referrer });

    const reportPerformance = () => window.setTimeout(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!navigation || navigation.loadEventEnd <= 0) return;
      sendTelemetry({
        event: "performance",
        path: window.location.pathname,
        device: window.innerWidth < 640 ? "mobile" : "desktop",
        load_ms: Math.round(navigation.loadEventEnd - navigation.startTime),
        ttfb_ms: Math.round(navigation.responseStart - navigation.requestStart),
      });
    }, 0);
    if (document.readyState === "complete") reportPerformance();
    else window.addEventListener("load", reportPerformance, { once: true });

    const error = () => sendTelemetry({ event: "browser_error", kind: "error", path: window.location.pathname });
    const rejection = () => sendTelemetry({ event: "browser_error", kind: "unhandledrejection", path: window.location.pathname });
    window.addEventListener("error", error);
    window.addEventListener("unhandledrejection", rejection);
    return () => {
      window.removeEventListener("load", reportPerformance);
      window.removeEventListener("error", error);
      window.removeEventListener("unhandledrejection", rejection);
    };
  }, []);
  return null;
}
