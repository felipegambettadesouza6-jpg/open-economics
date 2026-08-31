"use client";

import { useEffect } from "react";

type SearchTelemetry = {
  locale: "en" | "pt-br";
  query: string;
  results: number;
  surface: "hero" | "home" | "atlas" | "catalog" | "docs" | "playground";
};

export type ActivationAction =
  | "api_url_copy"
  | "code_copy"
  | "csv_download"
  | "playground_run"
  | "raw_response_open"
  | "response_copy";

function telemetryDisabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("oe_internal") === "1") sessionStorage.setItem("oe-internal", "1");
    return sessionStorage.getItem("oe-internal") === "1";
  } catch {
    return false;
  }
}

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

function actorId() {
  try {
    const key = "oe-actor";
    const current = localStorage.getItem(key);
    if (current) return current;
    const next = crypto.randomUUID();
    localStorage.setItem(key, next);
    return next;
  } catch {
    return sessionId();
  }
}

export function sendTelemetry(payload: Record<string, unknown>) {
  if (typeof window === "undefined" || telemetryDisabled()) return;
  void fetch("/_events", {
    method: "POST",
    body: JSON.stringify({ ...payload, actor: actorId(), session: sessionId() }),
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    credentials: "omit",
    keepalive: true,
  }).catch(() => undefined);
}

export function recordActivation(action: ActivationAction) {
  sendTelemetry({ event: "activation", action, path: window.location.pathname });
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
    const params = new URLSearchParams(window.location.search);
    sendTelemetry({
      event: "page_view",
      path: window.location.pathname,
      referrer,
      campaign: params.get("utm_campaign") ?? "",
      medium: params.get("utm_medium") ?? "",
      source: params.get("utm_source") ?? "",
    });

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
    const activation = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-activation]") : null;
      const action = element?.dataset.activation as ActivationAction | undefined;
      if (action) recordActivation(action);
    };
    window.addEventListener("error", error);
    window.addEventListener("unhandledrejection", rejection);
    document.addEventListener("click", activation);
    return () => {
      window.removeEventListener("load", reportPerformance);
      window.removeEventListener("error", error);
      window.removeEventListener("unhandledrejection", rejection);
      document.removeEventListener("click", activation);
    };
  }, []);
  return null;
}
