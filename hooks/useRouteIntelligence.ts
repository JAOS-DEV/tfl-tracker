"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLineArrivals } from "@/hooks/useLineArrivals";
import { usePredictionTracking } from "@/hooks/usePredictionTracking";
import { useRouteSequence } from "@/hooks/useRouteSequence";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getLoopLayout } from "@/lib/constants";
import { useRouteTimetable } from "@/hooks/useRouteTimetable";
import { useRouteSchedule } from "@/hooks/useRouteSchedule";
import { loadIbusManifestClient } from "@/lib/ibusRouteSchedules";
import { resolveLiveRunningDetailsForPredictions } from "@/lib/ibusLookup";
import { buildRouteIntelligence } from "@/lib/routeIntelligence";
import { MAX_ACTIVE_ROUTES, POLL_INTERVAL_MS } from "@/lib/storage";
import type { ActiveRoute, RouteIntelligenceResult } from "@/lib/tfl/types";

export interface UseRouteIntelligenceOptions {
  includeScheduleMatching?: boolean;
  fetchTimetable?: boolean;
  showScheduleGhosts?: boolean;
  includeLowConfidenceScheduleGhosts?: boolean;
}

interface UseRouteIntelligenceResult {
  route: ReturnType<typeof useRouteSequence>["data"];
  sequenceQuery: ReturnType<typeof useRouteSequence>;
  arrivalsQuery: ReturnType<typeof useLineArrivals>;
  intelligence: RouteIntelligenceResult | null;
  now: Date;
  isCheckingSchedule: boolean;
}

function parseDebugScheduleRunningNos(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const params = new URLSearchParams(window.location.search);
  const single = params.get("debugRun")?.trim();
  const many = params.get("debugRuns")?.trim();
  return Array.from(
    new Set(
      [single]
        .concat(many ? many.split(",") : [])
        .map((run) => run?.trim())
        .filter((run): run is string => Boolean(run)),
    ),
  );
}

export function useRouteIntelligence(
  routeId: string,
  options: UseRouteIntelligenceOptions = {},
): UseRouteIntelligenceResult {
  const includeScheduleMatching = options.includeScheduleMatching ?? true;
  const fetchTimetable = options.fetchTimetable ?? includeScheduleMatching;
  const showScheduleGhosts = options.showScheduleGhosts ?? true;
  const includeLowConfidenceScheduleGhosts =
    options.includeLowConfidenceScheduleGhosts ?? false;
  const isMobile = useMediaQuery("(max-width: 640px)");
  const sequenceQuery = useRouteSequence(routeId);
  const arrivalsQuery = useLineArrivals(routeId);
  const route = sequenceQuery.data;
  const { timetables } = useRouteTimetable(routeId, route, fetchTimetable);
  const routeScheduleQuery = useRouteSchedule(
    routeId,
    includeScheduleMatching && showScheduleGhosts && Boolean(route),
  );

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
  const debugScheduleRunningNos = useMemo(
    () =>
      includeLowConfidenceScheduleGhosts
        ? parseDebugScheduleRunningNos()
        : [],
    [includeLowConfidenceScheduleGhosts],
  );

  const intelligenceQuery = useQuery({
    queryKey: [
      "route-intelligence",
      routeId,
      includeScheduleMatching ? "full" : "lite",
      arrivalsQuery.dataUpdatedAt,
      predictions.length,
      loopLayout.orientation,
      includeScheduleMatching ? timetables.outbound?.journeys.length : null,
      includeScheduleMatching ? timetables.inbound?.journeys.length : null,
      showScheduleGhosts ? routeScheduleQuery.dataUpdatedAt : null,
      showScheduleGhosts ? routeScheduleQuery.status : null,
      showScheduleGhosts ? routeScheduleQuery.data?.journeys.length : null,
      debugScheduleRunningNos.join(","),
    ],
    queryFn: async () => {
      const manifest = await loadIbusManifestClient();
      const liveBaseVersion =
        predictions.find((prediction) => prediction.baseVersion)?.baseVersion ??
        manifest?.baseVersion;

      const liveIbusRunningDetails = await resolveLiveRunningDetailsForPredictions(
        predictions.map((prediction) => ({
          vehicleId: prediction.vehicleId,
          tripId: prediction.tripId,
          baseVersion: prediction.baseVersion,
        })),
      );

      return buildRouteIntelligence({
        routeId,
        route: route!,
        predictions,
        layout: loopLayout,
        dataUpdatedAt: arrivalsQuery.dataUpdatedAt,
        now: Date.now(),
        trackingStates: predictionTracking.states,
        timetables: includeScheduleMatching ? timetables : {},
        includeScheduleMatching,
        routeSchedule: routeScheduleQuery.data,
        showScheduleGhosts:
          showScheduleGhosts && Boolean(routeScheduleQuery.data),
        includeLowConfidenceScheduleGhosts,
        liveBaseVersion,
        liveIbusRunningDetails,
        collectScheduleGhostDiagnostics: includeLowConfidenceScheduleGhosts,
        debugScheduleRunningNo: debugScheduleRunningNos[0],
        debugScheduleRunningNos,
      });
    },
    enabled: Boolean(routeId && route),
    staleTime: POLL_INTERVAL_MS,
    placeholderData: keepPreviousData,
  });

  return {
    route,
    sequenceQuery,
    arrivalsQuery,
    intelligence: intelligenceQuery.data ?? null,
    now: new Date(),
    isCheckingSchedule:
      includeScheduleMatching &&
      showScheduleGhosts &&
      routeScheduleQuery.isFetching,
  };
}

export interface RouteIntelligenceSnapshot {
  routeId: string;
  intelligence: RouteIntelligenceResult | null;
}

export function useActiveRouteIntelligences(
  activeRoutes: ActiveRoute[],
  options: UseRouteIntelligenceOptions = {},
): RouteIntelligenceSnapshot[] {
  const slotIds = Array.from({ length: MAX_ACTIVE_ROUTES }, (_, index) =>
    activeRoutes[index]?.routeId ?? "",
  );

  const first = useRouteIntelligence(slotIds[0] ?? "", options);
  const second = useRouteIntelligence(slotIds[1] ?? "", options);
  const third = useRouteIntelligence(slotIds[2] ?? "", options);
  const intelligences = [first, second, third];

  return activeRoutes.map((route, index) => ({
    routeId: route.routeId,
    intelligence: intelligences[index]?.intelligence ?? null,
  }));
}
