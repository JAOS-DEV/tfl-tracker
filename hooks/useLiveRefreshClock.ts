"use client";

import { useEffect, useState } from "react";

/** UI-only clock for relative "Xs ago" labels. Does not fetch data. */
export function useLiveRefreshClock(enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [enabled]);

  return now;
}
