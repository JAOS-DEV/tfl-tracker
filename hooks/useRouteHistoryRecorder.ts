"use client";

import { useEffect, useRef } from "react";
import { appendRouteSnapshot } from "@/lib/localRouteHistory";
import type { RouteIntelligenceResult } from "@/lib/tfl/types";

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
    appendRouteSnapshot(routeId, routeName, intelligence, dataUpdatedAt);
  }, [routeId, routeName, intelligence, dataUpdatedAt]);
}
