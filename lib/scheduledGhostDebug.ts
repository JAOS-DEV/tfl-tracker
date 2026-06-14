import { normalizeRunningNumber } from "@/lib/runningNumber";
import { LOOP_LAYOUT } from "@/lib/constants";
import {
  buildLiveVehicleMatchContext,
  findCurrentScheduledStop,
  getScheduledGhostCandidates,
  hasPlausibleLiveMatch,
  isJourneyActiveAtTime,
  isJourneyScheduledForServiceWindow,
  mapIbusDirectionToRouteDirection,
  resolveScheduledGhostPosition,
} from "@/lib/scheduledGhostBuses";
import type { IbusRouteSchedule, IbusScheduledJourney } from "@/lib/ibus/scheduleTypes";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
} from "@/lib/tfl/types";

export interface ScheduledRunLiveMatchDebug {
  vehicleId: string;
  routeId: string;
  direction: string;
  tripId?: string;
  baseVersion?: string;
  runningNo?: string;
  blockNo?: string;
  nextStopNaptanId?: string;
  expectedArrival?: string;
  matched: boolean;
  reasons: string[];
}

export interface ScheduledRunJourneyDebug {
  tripId: string;
  blockNo: string;
  garageNo: string | null;
  operatorCode: string | null;
  direction: string;
  startSeconds: number;
  endSeconds: number;
  startTime: string;
  endTime: string;
  serviceDays: number[];
  destination: string | null;
  firstStop: string | null;
  finalStop: string | null;
  isServiceDayValid: boolean;
  isActive: boolean;
  inactiveReason: string | null;
  currentStopIndex: number;
  currentStopName: string | null;
  currentStopCode: string | null;
  currentStopNaptanId: string | null;
  routeStopIndex: number;
  routeDirection: string | null;
  positionSource: string | null;
  positionStatus: string | null;
  positionReason: string | null;
  interpolationFraction: number | null;
  confidence: string | null;
  candidateCreated: boolean;
  hiddenByConfidence: boolean;
  liveMatches: ScheduledRunLiveMatchDebug[];
}

export interface ScheduledRunDebugResult {
  routeId: string;
  runningNo: string;
  scheduleLoaded: boolean;
  foundInSchedule: boolean;
  journeyCount: number;
  activeJourneyCount: number;
  displayedCandidateCount: number;
  currentLondonTime: string;
  currentLondonSeconds: number;
  baseVersionMatched: boolean;
  baseVersionReason: string | null;
  routeDataStale: boolean;
  staleReason: string | null;
  journeys: ScheduledRunJourneyDebug[];
}

function londonDaySeconds(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const second = Number(parts.find((part) => part.type === "second")?.value ?? 0);
  return hour * 3600 + minute * 60 + second;
}

function formatSeconds(seconds: number): string {
  const normalized = ((seconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function currentLondonTime(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

function liveMatchReasons(
  journey: IbusScheduledJourney,
  live: ReturnType<typeof buildLiveVehicleMatchContext>,
  route: NormalizedRoute,
  scheduleBaseVersion: string,
  currentStop: ReturnType<typeof findCurrentScheduledStop>,
): string[] {
  const reasons: string[] = [];
  const journeyRunning = normalizeRunningNumber(journey.runningNo);
  const liveRunning = normalizeRunningNumber(live.runningNo);
  const sameRoute = live.routeId === route.routeId;
  const sameDirection =
    mapIbusDirectionToRouteDirection(journey.direction, journey, route) ===
    live.direction;

  if (
    live.tripId &&
    live.baseVersion === scheduleBaseVersion &&
    live.tripId === journey.tripId
  ) {
    reasons.push("tripId/baseVersion");
  }

  if (
    sameRoute &&
    journeyRunning &&
    liveRunning &&
    journeyRunning === liveRunning &&
    journey.blockNo.trim() &&
    live.blockNo?.trim() &&
    journey.blockNo.trim() === live.blockNo.trim()
  ) {
    reasons.push("runningNo/blockNo");
  }

  if (sameRoute && journeyRunning && liveRunning && journeyRunning === liveRunning) {
    reasons.push("same-route/runningNo");
  }

  if (
    sameRoute &&
    journeyRunning &&
    liveRunning &&
    journeyRunning === liveRunning &&
    sameDirection
  ) {
    reasons.push("runningNo/direction");
  }

  if (
    sameRoute &&
    sameDirection &&
    currentStop?.naptanId &&
    live.nextStopNaptanId &&
    currentStop.naptanId === live.nextStopNaptanId
  ) {
    reasons.push("next-stop/time-window");
  }

  return reasons;
}

export function debugScheduledJourneyForRun({
  routeSchedule,
  routeId,
  runningNo,
  now,
  liveVehicles,
  route,
  liveBaseVersion,
  dataUpdatedAt,
  includeLowConfidence = false,
}: {
  routeSchedule: IbusRouteSchedule | null | undefined;
  routeId: string;
  runningNo: string;
  now: Date;
  liveVehicles: EstimatedVehiclePosition[];
  route: NormalizedRoute;
  liveBaseVersion?: string;
  dataUpdatedAt?: number;
  includeLowConfidence?: boolean;
}): ScheduledRunDebugResult {
  const normalizedTarget = normalizeRunningNumber(runningNo);
  const nowSeconds = londonDaySeconds(now);
  const isRouteDataStale =
    dataUpdatedAt !== undefined ? now.getTime() - dataUpdatedAt > 90_000 : false;

  if (!routeSchedule || !normalizedTarget) {
    return {
      routeId,
      runningNo,
      scheduleLoaded: Boolean(routeSchedule),
      foundInSchedule: false,
      journeyCount: 0,
      activeJourneyCount: 0,
      displayedCandidateCount: 0,
      currentLondonTime: currentLondonTime(now),
      currentLondonSeconds: nowSeconds,
      baseVersionMatched: true,
      baseVersionReason: null,
      routeDataStale: isRouteDataStale,
      staleReason: isRouteDataStale ? "route data is stale" : null,
      journeys: [],
    };
  }

  const journeys = routeSchedule.journeys.filter(
    (journey) => normalizeRunningNumber(journey.runningNo) === normalizedTarget,
  );
  const baseVersionMatched =
    !liveBaseVersion || liveBaseVersion === routeSchedule.baseVersion;
  const liveContexts = liveVehicles.map(buildLiveVehicleMatchContext);

  const journeyDebug = journeys.map((journey) => {
    const isServiceDayValid = isJourneyScheduledForServiceWindow(
      journey,
      now,
      nowSeconds,
    );
    const isActive = isJourneyActiveAtTime(journey, nowSeconds);
    const routeDirection = mapIbusDirectionToRouteDirection(
      journey.direction,
      journey,
      route,
    );
    const position =
      isServiceDayValid && isActive && routeDirection
        ? resolveScheduledGhostPosition({
            routeId,
            journey,
            nowSeconds,
            direction: routeDirection,
            route,
            layout: LOOP_LAYOUT,
          })
        : null;
    const currentStop =
      position?.expectedStop ?? findCurrentScheduledStop(journey, nowSeconds);
    const routeStopIndex = position?.routeStopIndex ?? -1;
    const confidence = position?.confidence ?? null;

    const candidates = getScheduledGhostCandidates({
      routeId,
      now,
      liveVehicles,
      scheduledJourneys: [journey],
      route,
      layout: LOOP_LAYOUT,
      liveBaseVersion,
      scheduleBaseVersion: routeSchedule.baseVersion,
      isRouteDataStale,
      includeLowConfidence,
    });

    const liveMatches = liveContexts.map((live, index) => {
      const reasons = liveMatchReasons(
        journey,
        live,
        route,
        routeSchedule.baseVersion,
        currentStop,
      );
      return {
        vehicleId: liveVehicles[index]?.vehicleId ?? "unknown",
        routeId: live.routeId,
        direction: live.direction,
        tripId: live.tripId,
        baseVersion: live.baseVersion,
        runningNo: live.runningNo,
        blockNo: live.blockNo,
        nextStopNaptanId: live.nextStopNaptanId,
        expectedArrival: live.expectedArrival,
        matched: hasPlausibleLiveMatch(
          journey,
          live,
          currentStop,
          now,
          route,
          routeSchedule.baseVersion,
        ),
        reasons,
      };
    });

    let inactiveReason: string | null = null;
    if (!baseVersionMatched) {
      inactiveReason = "baseVersion mismatch";
    } else if (isRouteDataStale) {
      inactiveReason = "route data is stale";
    } else if (!isServiceDayValid) {
      inactiveReason = "not scheduled for current London service day";
    } else if (!isActive) {
      inactiveReason =
        nowSeconds < journey.startSeconds
          ? "current time is before active window"
          : "current time is after active window";
    } else if (!routeDirection) {
      inactiveReason = "could not map iBus direction to route direction";
    } else if (position?.status === "unavailable") {
      inactiveReason =
        position.diagnostics.reason ?? "scheduled position unavailable";
    } else if (liveMatches.some((match) => match.matched)) {
      inactiveReason = "suppressed by plausible live match";
    } else if (confidence === "low" && !includeLowConfidence) {
      inactiveReason = "low confidence hidden";
    }

    return {
      tripId: journey.tripId,
      blockNo: journey.blockNo,
      garageNo: journey.garageNo,
      operatorCode: journey.operatorCode,
      direction: journey.direction,
      startSeconds: journey.startSeconds,
      endSeconds: journey.endSeconds,
      startTime: formatSeconds(journey.startSeconds),
      endTime: formatSeconds(journey.endSeconds),
      serviceDays: journey.serviceDays,
      destination: journey.destination,
      firstStop: journey.stops[0]?.stopName ?? null,
      finalStop: journey.stops[journey.stops.length - 1]?.stopName ?? null,
      isServiceDayValid,
      isActive,
      inactiveReason,
      currentStopIndex: currentStop ? journey.stops.indexOf(currentStop) : -1,
      currentStopName: currentStop?.stopName ?? null,
      currentStopCode: currentStop?.stopCode ?? null,
      currentStopNaptanId: currentStop?.naptanId ?? null,
      routeStopIndex,
      routeDirection,
      positionSource: position?.source ?? null,
      positionStatus: position?.status ?? null,
      positionReason: position?.diagnostics.reason ?? null,
      interpolationFraction: position?.diagnostics.interpolationFraction ?? null,
      confidence,
      candidateCreated: candidates.length > 0,
      hiddenByConfidence: confidence === "low" && !includeLowConfidence,
      liveMatches,
    };
  });

  return {
    routeId,
    runningNo,
    scheduleLoaded: true,
    foundInSchedule: journeys.length > 0,
    journeyCount: journeys.length,
    activeJourneyCount: journeyDebug.filter(
      (journey) => journey.isServiceDayValid && journey.isActive,
    ).length,
    displayedCandidateCount: journeyDebug.filter((journey) => journey.candidateCreated)
      .length,
    currentLondonTime: currentLondonTime(now),
    currentLondonSeconds: nowSeconds,
    baseVersionMatched,
    baseVersionReason: baseVersionMatched
      ? null
      : `live=${liveBaseVersion}, schedule=${routeSchedule.baseVersion}`,
    routeDataStale: isRouteDataStale,
    staleReason: isRouteDataStale ? "route data is stale" : null,
    journeys: journeyDebug,
  };
}
