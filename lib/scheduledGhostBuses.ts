import type { LoopLayoutConfig } from "@/lib/constants";
import {
  mapProgressToLoopCoordinates,
  stopProgress,
} from "@/lib/routePositioning";
import type {
  IbusRouteSchedule,
  IbusScheduledJourney,
  IbusScheduledStop,
  ScheduledGhostConfidence,
} from "@/lib/ibus/scheduleTypes";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedStop,
  RouteDirection,
} from "@/lib/tfl/types";

export const LIVE_MATCH_TIME_TOLERANCE_MINUTES = 5;
export const SCHEDULED_END_GRACE_MINUTES = 10;
export const SCHEDULED_START_GRACE_MINUTES = 2;

export interface ScheduledGhostCandidate {
  kind: "scheduled-ghost-candidate";
  routeId: string;
  direction: RouteDirection;
  tripId: string;
  baseVersion: string;
  runningNo: string;
  blockNo: string;
  garageNo: string | null;
  operatorCode: string | null;
  destination: string | null;
  expectedStopName: string;
  expectedStopCode: string | null;
  expectedScheduledTime: string;
  progress: number;
  x: number;
  y: number;
  confidence: ScheduledGhostConfidence;
  reason: string;
}

export interface GetScheduledGhostCandidatesInput {
  routeId: string;
  direction?: RouteDirection;
  now: Date;
  liveVehicles: EstimatedVehiclePosition[];
  scheduledJourneys: IbusScheduledJourney[];
  route: NormalizedRoute;
  layout: LoopLayoutConfig;
  liveBaseVersion?: string;
  scheduleBaseVersion: string;
  isRouteDataStale?: boolean;
  includeLowConfidence?: boolean;
}

export interface LiveVehicleMatchContext {
  tripId?: string;
  baseVersion?: string;
  runningNo?: string;
  blockNo?: string;
  direction: RouteDirection;
  destinationName: string;
  nextStopNaptanId?: string;
  expectedArrival?: string;
}

function getLondonDaySeconds(now: Date): number {
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

function getLondonWeekday(now: Date): number {
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? now.getUTCDay();
}

export function isJourneyScheduledForToday(
  journey: IbusScheduledJourney,
  now: Date,
): boolean {
  if (journey.serviceDays.length === 0) {
    return true;
  }
  return journey.serviceDays.includes(getLondonWeekday(now));
}

export function isJourneyActiveAtTime(
  journey: IbusScheduledJourney,
  nowSeconds: number,
): boolean {
  const startGrace = SCHEDULED_START_GRACE_MINUTES * 60;
  const endGrace = SCHEDULED_END_GRACE_MINUTES * 60;
  return (
    nowSeconds >= journey.startSeconds - startGrace &&
    nowSeconds <= journey.endSeconds + endGrace
  );
}

export function findCurrentScheduledStop(
  journey: IbusScheduledJourney,
  nowSeconds: number,
): IbusScheduledStop | null {
  let current: IbusScheduledStop | null = null;

  for (const stop of journey.stops) {
    if (stop.scheduledSeconds <= nowSeconds) {
      current = stop;
      continue;
    }
    break;
  }

  return current ?? journey.stops[0] ?? null;
}

export function mapIbusDirectionToRouteDirection(
  ibusDirection: string,
  journey: IbusScheduledJourney,
  route: NormalizedRoute,
): RouteDirection | null {
  const stops = journey.stops
    .map((stop) => stop.naptanId)
    .filter((naptanId): naptanId is string => Boolean(naptanId));

  if (stops.length === 0) {
    return ibusDirection === "2" ? "inbound" : "outbound";
  }

  const outboundMatches = countStopMatches(stops, route.outbound);
  const inboundMatches = countStopMatches(stops, route.inbound);

  if (outboundMatches > inboundMatches) {
    return "outbound";
  }
  if (inboundMatches > outboundMatches) {
    return "inbound";
  }

  return ibusDirection === "2" ? "inbound" : "outbound";
}

function countStopMatches(
  naptanIds: string[],
  routeStops: NormalizedStop[],
): number {
  const routeIds = new Set(routeStops.map((stop) => stop.naptanId));
  return naptanIds.filter((naptanId) => routeIds.has(naptanId)).length;
}

export function findStopIndexOnRoute(
  stop: IbusScheduledStop | null,
  direction: RouteDirection,
  route: NormalizedRoute,
): number {
  if (!stop?.naptanId) {
    return -1;
  }

  const leg = direction === "outbound" ? route.outbound : route.inbound;
  return leg.findIndex((routeStop) => routeStop.naptanId === stop.naptanId);
}

export function estimateScheduledProgress(
  journey: IbusScheduledJourney,
  currentStop: IbusScheduledStop | null,
  direction: RouteDirection,
  route: NormalizedRoute,
): number {
  const leg = direction === "outbound" ? route.outbound : route.inbound;
  const stopIndex = findStopIndexOnRoute(currentStop, direction, route);

  if (stopIndex >= 0 && leg.length > 0) {
    return stopProgress(direction, stopIndex, leg.length);
  }

  const ratio =
    journey.stops.length <= 1
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((currentStop?.sequence ?? 1) - 1) / (journey.stops.length - 1),
          ),
        );

  return direction === "outbound"
    ? 0.05 + ratio * 0.4
    : 0.55 + ratio * 0.4;
}

function minutesBetweenScheduledAndExpected(
  scheduledSeconds: number,
  expectedArrival?: string,
  now?: Date,
): number | null {
  if (!expectedArrival || !now) {
    return null;
  }

  const expected = new Date(expectedArrival);
  if (Number.isNaN(expected.getTime())) {
    return null;
  }

  const expectedParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(expected);
  const hour = Number(expectedParts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    expectedParts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const expectedSeconds = hour * 3600 + minute * 60;
  return Math.abs(expectedSeconds - scheduledSeconds) / 60;
}

export function hasPlausibleLiveMatch(
  journey: IbusScheduledJourney,
  live: LiveVehicleMatchContext,
  currentStop: IbusScheduledStop | null,
  now: Date,
  route: NormalizedRoute,
): boolean {
  if (live.tripId && journey.tripId === live.tripId) {
    return true;
  }

  if (
    live.runningNo &&
    live.blockNo &&
    journey.runningNo === live.runningNo &&
    journey.blockNo === live.blockNo
  ) {
    return true;
  }

  if (
    live.runningNo &&
    journey.runningNo === live.runningNo &&
    live.direction === mapIbusDirectionToRouteDirection(journey.direction, journey, route)
  ) {
    return true;
  }

  if (
    currentStop?.naptanId &&
    live.nextStopNaptanId &&
    currentStop.naptanId === live.nextStopNaptanId &&
    live.direction === mapIbusDirectionToRouteDirection(journey.direction, journey, route)
  ) {
    const minutes = minutesBetweenScheduledAndExpected(
      currentStop.scheduledSeconds,
      live.expectedArrival,
      now,
    );
    if (
      minutes !== null &&
      minutes <= LIVE_MATCH_TIME_TOLERANCE_MINUTES
    ) {
      return true;
    }
  }

  return false;
}

export function calculateScheduledGhostConfidence(
  journey: IbusScheduledJourney,
  currentStop: IbusScheduledStop | null,
  stopIndex: number,
): ScheduledGhostConfidence {
  if (currentStop?.naptanId && stopIndex >= 0 && journey.runningNo) {
    return "high";
  }
  if (journey.runningNo && journey.blockNo) {
    return "medium";
  }
  return "low";
}

export function getScheduledGhostCandidates(
  input: GetScheduledGhostCandidatesInput,
): ScheduledGhostCandidate[] {
  if (input.isRouteDataStale) {
    return [];
  }

  if (
    input.liveBaseVersion &&
    input.liveBaseVersion !== input.scheduleBaseVersion
  ) {
    return [];
  }

  const nowSeconds = getLondonDaySeconds(input.now);
  const candidates: ScheduledGhostCandidate[] = [];
  const seen = new Set<string>();

  for (const journey of input.scheduledJourneys) {
    if (!isJourneyScheduledForToday(journey, input.now)) {
      continue;
    }

    if (!isJourneyActiveAtTime(journey, nowSeconds)) {
      continue;
    }

    const direction = mapIbusDirectionToRouteDirection(
      journey.direction,
      journey,
      input.route,
    );
    if (!direction) {
      continue;
    }

    if (input.direction && input.direction !== direction) {
      continue;
    }

    const currentStop = findCurrentScheduledStop(journey, nowSeconds);
    const stopIndex = findStopIndexOnRoute(currentStop, direction, input.route);
    if (stopIndex < 0 && !currentStop?.naptanId) {
      continue;
    }

    const liveContexts: LiveVehicleMatchContext[] = input.liveVehicles.map(
      (vehicle) => ({
        tripId: vehicle.tripId,
        baseVersion: vehicle.baseVersion,
        runningNo: vehicle.vehicleFleetReference,
        blockNo: undefined,
        direction: vehicle.direction,
        destinationName: vehicle.destinationName,
        nextStopNaptanId: vehicle.nextStop?.naptanId,
        expectedArrival: vehicle.expectedArrival,
      }),
    );

    const hasLiveMatch = liveContexts.some((live) =>
      hasPlausibleLiveMatch(journey, live, currentStop, input.now, input.route),
    );
    if (hasLiveMatch) {
      continue;
    }

    const dedupeKey = `${journey.tripId}:${journey.runningNo}:${journey.blockNo}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    const confidence = calculateScheduledGhostConfidence(
      journey,
      currentStop,
      stopIndex,
    );

    if (confidence === "low" && !input.includeLowConfidence) {
      continue;
    }

    const progress = estimateScheduledProgress(
      journey,
      currentStop,
      direction,
      input.route,
    );
    const { x, y } = mapProgressToLoopCoordinates(progress, input.layout);

    candidates.push({
      kind: "scheduled-ghost-candidate",
      routeId: input.routeId,
      direction,
      tripId: journey.tripId,
      baseVersion: input.scheduleBaseVersion,
      runningNo: journey.runningNo,
      blockNo: journey.blockNo,
      garageNo: journey.garageNo,
      operatorCode: journey.operatorCode,
      destination: journey.destination,
      expectedStopName: currentStop?.stopName ?? "Unknown stop",
      expectedStopCode: currentStop?.stopCode ?? null,
      expectedScheduledTime: currentStop?.scheduledTime ?? journey.startTime,
      progress,
      x,
      y,
      confidence,
      reason: "scheduled-journey-active-but-no-live-match",
    });
  }

  return candidates;
}

export function scheduledGhostToVehiclePosition(
  candidate: ScheduledGhostCandidate,
): EstimatedVehiclePosition {
  const vehicleId = `scheduled-ghost:${candidate.routeId}:${candidate.tripId}`;

  return {
    vehicleId,
    tripId: candidate.tripId,
    baseVersion: candidate.baseVersion,
    routeNumber: candidate.routeId,
    direction: candidate.direction,
    destinationName: candidate.destination ?? "Scheduled destination",
    expectedArrival: new Date().toISOString(),
    timeToStation: 0,
    nextPrediction: {
      id: `scheduled-${candidate.tripId}`,
      routeId: candidate.routeId,
      routeNumber: candidate.routeId,
      naptanId: "",
      stopName: candidate.expectedStopName,
      destinationName: candidate.destination ?? "Scheduled destination",
      direction: candidate.direction,
      timeToStation: 0,
      expectedArrival: new Date().toISOString(),
      vehicleId,
      tripId: candidate.tripId,
      baseVersion: candidate.baseVersion,
    },
    nextStop: null,
    stopIndex: -1,
    progress: candidate.progress,
    x: candidate.x,
    y: candidate.y,
    matched: true,
    adherence: "onTime",
    scheduleDeviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: candidate.expectedScheduledTime,
    matchedStopName: candidate.expectedStopName,
    scheduleDataAvailable: true,
    scheduleExplanation:
      "Scheduled bus not currently matched to a live vehicle",
    ghostStatus: "suspectedGhost",
    ghostReason: candidate.reason,
    missedRefreshCount: 0,
    isSuspectedGhost: true,
    isScheduledGhostCandidate: true,
    scheduledGhostConfidence: candidate.confidence,
    scheduledGhostRunningNo: candidate.runningNo,
    scheduledGhostBlockNo: candidate.blockNo,
    scheduledGhostGarageNo: candidate.garageNo,
    scheduledGhostOperatorCode: candidate.operatorCode,
    scheduledGhostExpectedStopCode: candidate.expectedStopCode,
    scheduledGhostSource: "tfl-ibus-static-schedule",
  };
}

export function filterRouteScheduleJourneys(
  schedule: IbusRouteSchedule | null | undefined,
): IbusScheduledJourney[] {
  return schedule?.journeys ?? [];
}
