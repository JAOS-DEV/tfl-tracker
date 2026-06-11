"use client";

import { useEffect, useMemo, useState } from "react";
import { useLineArrivals } from "@/hooks/useLineArrivals";
import { usePredictionTracking } from "@/hooks/usePredictionTracking";
import { useRouteSequence } from "@/hooks/useRouteSequence";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getLoopLayout } from "@/lib/constants";
import { useRouteTimetable } from "@/hooks/useRouteTimetable";
import { buildRouteIntelligence } from "@/lib/routeIntelligence";
import type { RouteIntelligenceResult } from "@/lib/tfl/types";

interface UseRouteIntelligenceResult {
  route: ReturnType<typeof useRouteSequence>["data"];
  sequenceQuery: ReturnType<typeof useRouteSequence>;
  arrivalsQuery: ReturnType<typeof useLineArrivals>;
  intelligence: RouteIntelligenceResult | null;
  now: Date;
}

export function useRouteIntelligence(routeId: string): UseRouteIntelligenceResult {
  const [now, setNow] = useState(() => new Date());
  const isMobile = useMediaQuery("(max-width: 640px)");
  const sequenceQuery = useRouteSequence(routeId);
  const arrivalsQuery = useLineArrivals(routeId);
  const route = sequenceQuery.data;
  const { timetables } = useRouteTimetable(routeId, route);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const predictions = useMemo(
    () => arrivalsQuery.data?.predictions ?? [],
    [arrivalsQuery.data?.predictions],
  );

  const predictionTracking = usePredictionTracking(
    routeId,
    predictions,
    arrivalsQuery.dataUpdatedAt,
  );

  const loopLayout = useMemo(
    () => getLoopLayout(isMobile, route),
    [isMobile, route],
  );

  const intelligence = useMemo(() => {
    if (!route) {
      return null;
    }

    return buildRouteIntelligence({
      routeId,
      route,
      predictions,
      layout: loopLayout,
      dataUpdatedAt: arrivalsQuery.dataUpdatedAt,
      now: now.getTime(),
      trackingStates: predictionTracking.states,
      timetables,
    });
  }, [
    routeId,
    route,
    predictions,
    loopLayout,
    arrivalsQuery.dataUpdatedAt,
    now,
    predictionTracking.states,
    timetables,
  ]);

  return {
    route,
    sequenceQuery,
    arrivalsQuery,
    intelligence,
    now,
  };
}
