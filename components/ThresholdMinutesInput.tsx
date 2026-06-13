"use client";

import { useEffect, useRef, useState } from "react";

interface ThresholdMinutesInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel: string;
}

function clampThreshold(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = cleaned.split(".");
  if (decimalParts.length === 0) {
    return whole;
  }

  return `${whole}.${decimalParts.join("")}`;
}

export function ThresholdMinutesInput({
  value,
  onChange,
  min = 0.1,
  max = 60,
  className = "w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-right dark:border-zinc-700 dark:bg-zinc-900",
  ariaLabel,
}: ThresholdMinutesInputProps): React.ReactElement {
  const [draft, setDraft] = useState(String(value));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  const commitDraft = () => {
    const parsed = Number.parseFloat(draft);
    const next = Number.isFinite(parsed)
      ? clampThreshold(parsed, min, max)
      : value;

    setDraft(String(next));

    if (next !== value) {
      onChange(next);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.]?[0-9]*"
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        commitDraft();
      }}
      onChange={(event) => {
        setDraft(sanitizeDecimalInput(event.target.value));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
}
