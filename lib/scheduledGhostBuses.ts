import type { LoopLayoutConfig } from "@/lib/constants";
import {
  mapProgressToLoopCoordinates,
  stopProgress,
} from "@/lib/routePositioning";
import {
  normalizeRunningNumber,
} from "@/lib/runningNumber";
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
  routeId: string;
  direction: RouteDirection;
  destinationName: string;
  nextStopNaptanId?: string;
  expectedArrival?: string;
}

export function extractLiveRunningNo(
  vehicle: EstimatedVehiclePosition,
): string | undefined {
  return (
    vehicle.ibusRunningNo ??
    vehicle.scheduledGhostRunningNo ??
    undefined
  );
}

export function buildLiveVehicleMatchContext(
  vehicle: EstimatedVehiclePosition,
): LiveVehicleMatchContext {
  return {
    tripId: vehicle.tripId,
    baseVersion: vehicle.baseVersion,
    runningNo: extractLiveRunningNo(vehicle),
    blockNo: vehicle.ibusBlockNo ?? vehicle.scheduledGhostBlockNo,
    routeId: vehicle.routeNumber,
    direction: vehicle.direction,
    destinationName: vehicle.destinationName,
    nextStopNaptanId: vehicle.nextStop?.naptanId,
    expectedArrival: vehicle.expectedArrival,
  };
}

export function isActiveLiveVehicle(
  vehicle: EstimatedVehiclePosition,
): boolean {
  return !vehicle.isScheduledGhostCandidate && vehicle.matched;
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

export function resolveScheduledJourneyDestination(
  journey: IbusScheduledJourney,
  route: NormalizedRoute,
  direction: RouteDirection,
): string | null {
  if (journey.destination) {
    return journey.destination;
  }

  const finalStop = journey.stops[journey.stops.length - 1];
  if (finalStop?.stopName) {
    return `towards ${finalStop.stopName}`;
  }

  const leg = direction === "outbound" ? route.outbound : route.inbound;
  const terminal = leg[leg.length - 1];
  if (terminal?.name) {
    return `towards ${terminal.name}`;
  }

  return null;
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
  scheduleBaseVersion?: string,
): boolean {
  if (
    live.tripId &&
    live.baseVersion &&
    scheduleBaseVersion &&
    live.baseVersion === scheduleBaseVersion &&
    journey.tripId === live.tripId
  ) {
    return true;
  }

  const journeyRunning = normalizeRunningNumber(journey.runningNo);
  const liveRunning = normalizeRunningNumber(live.runningNo);
  const journeyBlock = journey.blockNo.trim();
  const liveBlock = live.blockNo?.trim();
  const sameRoute = live.routeId === route.routeId;

  if (
    sameRoute &&
    journeyRunning &&
    liveRunning &&
    journeyBlock &&
    liveBlock &&
    journeyRunning === liveRunning &&
    journeyBlock === liveBlock
  ) {
    return true;
  }

  if (
    sameRoute &&
    journeyRunning &&
    liveRunning &&
    journeyRunning === liveRunning
  ) {
    return true;
  }

  const journeyDirection = mapIbusDirectionToRouteDirection(
    journey.direction,
    journey,
    route,
  );
  if (
    sameRoute &&
    journeyRunning &&
    liveRunning &&
    journeyRunning === liveRunning &&
    journeyDirection &&
    live.direction === journeyDirection
  ) {
    return true;
  }

  if (
    sameRoute &&
    currentStop?.naptanId &&
    live.nextStopNaptanId &&
    currentStop.naptanId === live.nextStopNaptanId &&
    journeyDirection &&
    live.direction === journeyDirection
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
      buildLiveVehicleMatchContext,
    );

    const hasLiveMatch = liveContexts.some((live) =>
      hasPlausibleLiveMatch(
        journey,
        live,
        currentStop,
        input.now,
        input.route,
        input.scheduleBaseVersion,
      ),
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
      destination: resolveScheduledJourneyDestination(journey, input.route, direction),
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

export function applyScheduleGhostDuplicateGuard(
  routeId: string,
  liveVehicles: EstimatedVehiclePosition[],
  candidates: ScheduledGhostCandidate[],
  collectDiagnostics = false,
): {
  candidates: ScheduledGhostCandidate[];
  diagnostics: string[];
} {
  const diagnostics: string[] = [];
  const liveRunningNumbers = new Set<string>();

  for (const vehicle of liveVehicles) {
    if (!isActiveLiveVehicle(vehicle) || vehicle.routeNumber !== routeId) {
      continue;
    }

    const normalizedRunning = normalizeRunningNumber(extractLiveRunningNo(vehicle));
    if (normalizedRunning) {
      liveRunningNumbers.add(normalizedRunning);
    }
  }

  const seenGhosts = new Set<string>();
  const filtered: ScheduledGhostCandidate[] = [];

  for (const candidate of candidates) {
    const normalizedRunning = normalizeRunningNumber(candidate.runningNo);
    if (normalizedRunning && liveRunningNumbers.has(normalizedRunning)) {
      if (collectDiagnostics) {
        diagnostics.push(
          `Suppressed schedule ghost ${candidate.runningNo} because live vehicle with same running number exists.`,
        );
      }
      continue;
    }

    const ghostKey = [
      normalizedRunning ?? "",
      candidate.blockNo.trim(),
      candidate.tripId,
    ].join(":");
    if (seenGhosts.has(ghostKey)) {
      continue;
    }
    seenGhosts.add(ghostKey);
    filtered.push(candidate);
  }

  return { candidates: filtered, diagnostics };
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
    destinationName: candidate.destination ?? "Destination unavailable",
    expectedArrival: new Date().toISOString(),
    timeToStation: 0,
    nextPrediction: {
      id: `scheduled-${candidate.tripId}`,
      routeId: candidate.routeId,
      routeNumber: candidate.routeId,
      naptanId: "",
      stopName: candidate.expectedStopName,
      destinationName: candidate.destination ?? "Destination unavailable",
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
    ghostSource: "schedule",
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
