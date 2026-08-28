"use client";

import { useState } from "react";

export function CopyButton({
  value,
  label = "Copy",
  successLabel = "Copied",
  className = "",
}: {
  value: string;
  label?: string;
  successLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className={`copy-button ${className}`} type="button" onClick={copy} aria-live="polite">
      {copied ? successLabel : label}
    </button>
  );
}
