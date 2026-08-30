"use client";

import { useState } from "react";
import { recordActivation, type ActivationAction } from "@/app/components/Telemetry";

export function CopyButton({
  value,
  label = "Copy",
  successLabel = "Copied",
  className = "",
  activation,
}: {
  value: string;
  label?: string;
  successLabel?: string;
  className?: string;
  activation?: ActivationAction;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (activation) recordActivation(activation);
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
