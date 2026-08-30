"use client";

import { useEffect } from "react";

const selectors = [
  ".oe-manifesto",
  ".oe-confluence",
  ".oe-data-section",
  ".oe-discover",
  ".oe-api",
  ".signal-footer-dramatic",
];

export function HomeMotion() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".signal-page");
    if (!page) return;
    const sections = selectors.flatMap((selector) => [...page.querySelectorAll<HTMLElement>(selector)]);
    page.classList.add("home-motion-ready");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sections.forEach((section) => section.classList.add("is-home-visible"));
      return () => page.classList.remove("home-motion-ready");
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("is-home-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -12%", threshold: .12 });

    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
      page.classList.remove("home-motion-ready");
    };
  }, []);

  return null;
}
