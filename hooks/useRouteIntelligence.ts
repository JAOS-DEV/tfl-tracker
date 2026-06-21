"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLineArrivals } from "@/hooks/useLineArrivals";
import { usePredictionTracking } from "@/hooks/usePredictionTracking";
import { useRouteSequence } from "@/hooks/useRouteSequence";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getLoopLayout } from "@/lib/constants";
import { useRouteTimetable } from "@/hooks/useRouteTimetable";
import { useRouteSchedule, getRouteScheduleFromQuery, getRouteScheduleSelectionFromQuery } from "@/hooks/useRouteSchedule";
import { loadIbusManifestClient } from "@/lib/ibusRouteSchedules";
import { resolveLiveRunningDetailsForPredictions } from "@/lib/ibusLookup";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import { buildRouteIntelligence } from "@/lib/routeIntelligence";
import { MAX_ACTIVE_ROUTES, POLL_INTERVAL_MS } from "@/lib/storage";
import type { ActiveRoute, RouteIntelligenceResult } from "@/lib/tfl/types";

export interface UseRouteIntelligenceOptions {
  includeScheduleMatching?: boolean;
  fetchTimetable?: boolean;
  showScheduleGhosts?: boolean;
  includeLowConfidenceScheduleGhosts?: boolean;
  enrichLiveIbusDetails?: boolean;
  collectRegistrationDiagnostics?: boolean;
  showRegistrationEnabled?: boolean;
}

interface UseRouteIntelligenceResult {
  route: ReturnType<typeof useRouteSequence>["data"];
  sequenceQuery: ReturnType<typeof useRouteSequence>;
  arrivalsQuery: ReturnType<typeof useLineArrivals>;
  intelligence: RouteIntelligenceResult | null;
  routeSchedule: IbusRouteSchedule | undefined;
  now: Date;
  isCheckingSchedule: boolean;
}

export interface ResolvedRouteIntelligenceOptions {
  includeScheduleMatching: boolean;
  fetchTimetable: boolean;
  showScheduleGhosts: boolean;
  includeLowConfidenceScheduleGhosts: boolean;
  enrichLiveIbusDetails: boolean;
  collectRegistrationDiagnostics: boolean;
  showRegistrationEnabled: boolean;
}

export function resolveRouteIntelligenceOptions(
  options: UseRouteIntelligenceOptions = {},
): ResolvedRouteIntelligenceOptions {
  const includeScheduleMatching = options.includeScheduleMatching ?? true;
  const fetchTimetable = options.fetchTimetable ?? false;
  const showScheduleGhosts = options.showScheduleGhosts ?? true;
  const includeLowConfidenceScheduleGhosts =
    options.includeLowConfidenceScheduleGhosts ?? false;
  const enrichLiveIbusDetails =
    options.enrichLiveIbusDetails ??
    (includeScheduleMatching || includeLowConfidenceScheduleGhosts);
  const collectRegistrationDiagnostics =
    options.collectRegistrationDiagnostics ?? false;
  const showRegistrationEnabled = options.showRegistrationEnabled ?? true;

  return {
    includeScheduleMatching,
    fetchTimetable,
    showScheduleGhosts,
    includeLowConfidenceScheduleGhosts,
    enrichLiveIbusDetails,
    collectRegistrationDiagnostics,
    showRegistrationEnabled,
  };
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
  const {
    includeScheduleMatching,
    fetchTimetable,
    showScheduleGhosts,
    includeLowConfidenceScheduleGhosts,
    enrichLiveIbusDetails,
    collectRegistrationDiagnostics,
    showRegistrationEnabled,
  } = resolveRouteIntelligenceOptions(options);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const sequenceQuery = useRouteSequence(routeId);
  const arrivalsQuery = useLineArrivals(routeId);
  const route = sequenceQuery.data;
  const { timetables } = useRouteTimetable(routeId, route, fetchTimetable);

  const predictions = useMemo(
    () => arrivalsQuery.data?.predictions ?? [],
    [arrivalsQuery.data?.predictions],
  );

  const liveBaseVersionFromPredictions = useMemo(
    () =>
      predictions.find((prediction) => prediction.baseVersion)?.baseVersion,
    [predictions],
  );

  const routeScheduleQuery = useRouteSchedule(
    routeId,
    includeScheduleMatching && Boolean(route),
    liveBaseVersionFromPredictions,
  );
  const routeSchedule = getRouteScheduleFromQuery(routeScheduleQuery.data);
  const routeScheduleSelection = getRouteScheduleSelectionFromQuery(
    routeScheduleQuery.data,
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
      enrichLiveIbusDetails ? "ibus" : "no-ibus",
      includeScheduleMatching ? timetables.outbound?.journeys.length : null,
      includeScheduleMatching ? timetables.inbound?.journeys.length : null,
      includeScheduleMatching ? routeScheduleQuery.dataUpdatedAt : null,
      includeScheduleMatching ? routeScheduleQuery.status : null,
      includeScheduleMatching ? routeSchedule?.journeys.length : null,
      includeScheduleMatching ? routeScheduleSelection?.selectedBaseVersion : null,
      debugScheduleRunningNos.join(","),
    ],
    queryFn: async () => {
      const needsIbusManifest =
        enrichLiveIbusDetails ||
        (includeScheduleMatching && showScheduleGhosts);
      const manifest = needsIbusManifest ? await loadIbusManifestClient() : null;
      const liveBaseVersion =
        liveBaseVersionFromPredictions ?? manifest?.activeBaseVersionFromXml ?? manifest?.baseVersion;

      const liveIbusRunningDetails = enrichLiveIbusDetails
        ? await resolveLiveRunningDetailsForPredictions(
            predictions.map((prediction) => ({
              vehicleId: prediction.vehicleId,
              tripId: prediction.tripId,
              baseVersion: prediction.baseVersion,
            })),
            {
              routeScheduleBaseVersion: routeSchedule?.baseVersion,
              selectedBaseVersion:
                routeScheduleSelection?.selectedBaseVersion ?? undefined,
            },
          )
        : undefined;

      const samplePrediction = predictions.find(
        (prediction) => prediction.tripId || prediction.baseVersion,
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
        routeSchedule,
        showScheduleGhosts:
          showScheduleGhosts && Boolean(routeSchedule),
        includeLowConfidenceScheduleGhosts,
        liveBaseVersion,
        liveIbusRunningDetails,
        collectScheduleGhostDiagnostics: includeLowConfidenceScheduleGhosts,
        debugScheduleRunningNo: debugScheduleRunningNos[0],
        debugScheduleRunningNos,
        collectRegistrationDiagnostics,
        showRegistrationEnabled,
        enrichmentLoaded: enrichLiveIbusDetails,
        routeScheduleLoading:
          includeScheduleMatching &&
          routeScheduleQuery.isFetching &&
          !routeSchedule,
        staticManifestBaseVersion: manifest?.baseVersion,
        activeBaseVersionFromXml: manifest?.activeBaseVersionFromXml,
        baseVersionSelection: routeScheduleSelection,
        sampleLivePrediction: samplePrediction
          ? {
              rawTripId: samplePrediction.tripId,
              rawBaseVersion: samplePrediction.baseVersion,
              normalizedTripId: samplePrediction.tripId?.trim(),
              normalizedBaseVersion: samplePrediction.baseVersion?.trim(),
              fieldsUsedForBaseVersion: "prediction.baseVersion",
            }
          : undefined,
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
    routeSchedule: includeScheduleMatching ? routeSchedule : undefined,
    now: new Date(),
    isCheckingSchedule:
      includeScheduleMatching && routeScheduleQuery.isFetching,
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
