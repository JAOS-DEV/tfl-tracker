"use client";

import { useEffect, useRef } from "react";
import { appendRouteSnapshot } from "@/lib/localRouteHistory";
import type { RouteIntelligenceResult } from "@/lib/tfl/types";

function runWhenIdle(callback: () => void): () => void {
  if (
    typeof window !== "undefined" &&
    "requestIdleCallback" in window
  ) {
    const idleId = window.requestIdleCallback(callback, { timeout: 2_000 });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = globalThis.setTimeout(callback, 0);
  return () => globalThis.clearTimeout(timeoutId);
}

export function useRouteHistoryRecorder(
  routeId: string,
  routeName: string,
  intelligence: RouteIntelligenceResult | null,
  dataUpdatedAt: number,
): void {
  const lastRecordedAtRef = useRef(0);

  useEffect(() => {
    if (!intelligence || !dataUpdatedAt) {
      return;
    }

    if (dataUpdatedAt === lastRecordedAtRef.current) {
      return;
    }

    lastRecordedAtRef.current = dataUpdatedAt;
    return runWhenIdle(() => {
      appendRouteSnapshot(routeId, routeName, intelligence, dataUpdatedAt);
    });
  }, [routeId, routeName, intelligence, dataUpdatedAt]);
}
