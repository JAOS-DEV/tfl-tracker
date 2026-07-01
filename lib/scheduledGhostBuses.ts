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
  positionStatus?: ScheduledGhostPositionStatus;
  positionSource?: ScheduledGhostPositionSource;
  positionDiagnostics?: ScheduledGhostPositionDiagnostics;
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
  diagnostics?: ScheduledGhostPositionDiagnostics[];
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

export type ScheduledGhostPositionSource =
  | "interpolated"
  | "exact-scheduled-stop"
  | "first-stop-genuinely"
  | "final-stop-genuinely"
  | "one-sided-fallback"
  | "pattern-fallback"
  | "unavailable";

export type ScheduledGhostPositionStatus = "available" | "unavailable";

export interface MatchedScheduledRouteStop {
  stop: IbusScheduledStop;
  routeStop: NormalizedStop;
  routeStopIndex: number;
  matchType: "naptan" | "stop-code" | "name";
}

export interface ScheduledGhostPositionDiagnostics {
  routeId: string;
  runningNo: string;
  tripId: string;
  direction: RouteDirection | null;
  active: boolean;
  previousStopName: string | null;
  previousStopCode: string | null;
  previousStopNaptanId: string | null;
  nextStopName: string | null;
  nextStopCode: string | null;
  nextStopNaptanId: string | null;
  previousScheduledSeconds: number | null;
  nextScheduledSeconds: number | null;
  previousScheduledTime: string | null;
  nextScheduledTime: string | null;
  interpolationFraction: number | null;
  matchedPreviousRouteStop: boolean;
  matchedNextRouteStop: boolean;
  calculatedProgress: number | null;
  positionSource: ScheduledGhostPositionSource;
  confidence: ScheduledGhostConfidence | null;
  displayed: boolean;
  reason: string | null;
  suppressionReason?: string | null;
}

export interface ScheduledGhostPositionResult {
  status: ScheduledGhostPositionStatus;
  source: ScheduledGhostPositionSource;
  confidence: ScheduledGhostConfidence;
  progress: number | null;
  x: number | null;
  y: number | null;
  expectedStop: IbusScheduledStop | null;
  routeStopIndex: number;
  diagnostics: ScheduledGhostPositionDiagnostics;
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

export function isJourneyScheduledForServiceWindow(
  journey: IbusScheduledJourney,
  now: Date,
  nowSeconds: number,
  endGraceMinutes = SCHEDULED_END_GRACE_MINUTES,
): boolean {
  if (isJourneyScheduledForToday(journey, now)) {
    return true;
  }

  if (journey.serviceDays.length === 0) {
    return true;
  }

  const endGrace = endGraceMinutes * 60;
  const continuesAfterMidnight =
    journey.endSeconds + endGrace >= 24 * 60 * 60 ||
    journey.endSeconds < journey.startSeconds;
  if (!continuesAfterMidnight || nowSeconds > (journey.endSeconds + endGrace) % (24 * 60 * 60)) {
    return false;
  }

  const previousDay = (getLondonWeekday(now) + 6) % 7;
  return journey.serviceDays.includes(previousDay);
}

export function isJourneyActiveAtTime(
  journey: IbusScheduledJourney,
  nowSeconds: number,
  grace: {
    startMinutes?: number;
    endMinutes?: number;
  } = {},
): boolean {
  const startGrace =
    (grace.startMinutes ?? SCHEDULED_START_GRACE_MINUTES) * 60;
  const endGrace = (grace.endMinutes ?? SCHEDULED_END_GRACE_MINUTES) * 60;
  const start = journey.startSeconds - startGrace;
  const end = journey.endSeconds + endGrace;
  const daySeconds = 24 * 60 * 60;

  if (start < 0) {
    return nowSeconds >= start + daySeconds || nowSeconds <= end;
  }

  if (end >= daySeconds) {
    return nowSeconds >= start || nowSeconds <= end - daySeconds;
  }

  if (end >= start) {
    return nowSeconds >= start && nowSeconds <= end;
  }

  // Some night journeys wrap through local midnight.
  return nowSeconds >= start || nowSeconds <= end;
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

function normalizeStopName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(bus station|station|stop|stand)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeScheduleSecondsForJourney(
  journey: IbusScheduledJourney,
  nowSeconds: number,
): number {
  const daySeconds = 24 * 60 * 60;
  const wrapsAfterMidnight =
    journey.endSeconds >= daySeconds || journey.endSeconds < journey.startSeconds;
  if (wrapsAfterMidnight && nowSeconds < (journey.endSeconds % daySeconds)) {
    return nowSeconds + daySeconds;
  }
  return nowSeconds;
}

function stopScheduledSecondsOnJourney(
  journey: IbusScheduledJourney,
  stop: IbusScheduledStop,
  index: number,
): number {
  if (stop.scheduledSeconds >= journey.startSeconds || index === 0) {
    return stop.scheduledSeconds;
  }
  return stop.scheduledSeconds + 24 * 60 * 60;
}

export function findScheduledStopPair(
  journey: IbusScheduledJourney,
  nowSeconds: number,
): {
  nowJourneySeconds: number;
  previous: IbusScheduledStop | null;
  next: IbusScheduledStop | null;
  previousSeconds: number | null;
  nextSeconds: number | null;
  fraction: number | null;
} {
  const nowJourneySeconds = normalizeScheduleSecondsForJourney(journey, nowSeconds);
  let previous: IbusScheduledStop | null = null;
  let next: IbusScheduledStop | null = null;
  let previousSeconds: number | null = null;
  let nextSeconds: number | null = null;

  for (let index = 0; index < journey.stops.length; index += 1) {
    const stop = journey.stops[index]!;
    const stopSeconds = stopScheduledSecondsOnJourney(journey, stop, index);
    if (stopSeconds <= nowJourneySeconds) {
      previous = stop;
      previousSeconds = stopSeconds;
      continue;
    }
    next = stop;
    nextSeconds = stopSeconds;
    break;
  }

  if (!previous && journey.stops[0]) {
    next = journey.stops[0];
    nextSeconds = stopScheduledSecondsOnJourney(journey, journey.stops[0], 0);
  }

  if (!next && journey.stops.length > 0) {
    const finalIndex = journey.stops.length - 1;
    previous = journey.stops[finalIndex]!;
    previousSeconds = stopScheduledSecondsOnJourney(
      journey,
      journey.stops[finalIndex]!,
      finalIndex,
    );
  }

  const fraction =
    previousSeconds !== null &&
    nextSeconds !== null &&
    nextSeconds > previousSeconds
      ? (nowJourneySeconds - previousSeconds) / (nextSeconds - previousSeconds)
      : previousSeconds !== null && nextSeconds !== null
        ? 0
        : null;

  return {
    nowJourneySeconds,
    previous,
    next,
    previousSeconds,
    nextSeconds,
    fraction:
      fraction === null ? null : Math.max(0, Math.min(1, fraction)),
  };
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

export function matchScheduledStopOnRoute(
  stop: IbusScheduledStop | null,
  direction: RouteDirection,
  route: NormalizedRoute,
): MatchedScheduledRouteStop | null {
  if (!stop) {
    return null;
  }
  const leg = direction === "outbound" ? route.outbound : route.inbound;
  const byNaptan =
    stop.naptanId !== null
      ? leg.findIndex((routeStop) => routeStop.naptanId === stop.naptanId)
      : -1;
  if (byNaptan >= 0) {
    return {
      stop,
      routeStop: leg[byNaptan]!,
      routeStopIndex: byNaptan,
      matchType: "naptan",
    };
  }

  const byCode =
    stop.stopCode !== null
      ? leg.findIndex(
          (routeStop) =>
            routeStop.id === stop.stopCode || routeStop.naptanId === stop.stopCode,
        )
      : -1;
  if (byCode >= 0) {
    return {
      stop,
      routeStop: leg[byCode]!,
      routeStopIndex: byCode,
      matchType: "stop-code",
    };
  }

  const normalizedName = normalizeStopName(stop.stopName);
  if (normalizedName) {
    const byName = leg.findIndex(
      (routeStop) => normalizeStopName(routeStop.name) === normalizedName,
    );
    if (byName >= 0) {
      return {
        stop,
        routeStop: leg[byName]!,
        routeStopIndex: byName,
        matchType: "name",
      };
    }
  }

  return null;
}

function interpolateProgress(
  direction: RouteDirection,
  previousIndex: number,
  nextIndex: number,
  totalStops: number,
  fraction: number,
): number {
  const previousProgress = stopProgress(direction, previousIndex, totalStops);
  const nextProgress = stopProgress(direction, nextIndex, totalStops);
  return previousProgress + (nextProgress - previousProgress) * fraction;
}

function buildUnavailablePositionDiagnostics({
  routeId,
  journey,
  direction,
  pair,
  reason,
}: {
  routeId: string;
  journey: IbusScheduledJourney;
  direction: RouteDirection | null;
  pair: ReturnType<typeof findScheduledStopPair>;
  reason: string;
}): ScheduledGhostPositionDiagnostics {
  return {
    routeId,
    runningNo: journey.runningNo,
    tripId: journey.tripId,
    direction,
    active: false,
    previousStopName: pair.previous?.stopName ?? null,
    previousStopCode: pair.previous?.stopCode ?? null,
    previousStopNaptanId: pair.previous?.naptanId ?? null,
    nextStopName: pair.next?.stopName ?? null,
    nextStopCode: pair.next?.stopCode ?? null,
    nextStopNaptanId: pair.next?.naptanId ?? null,
    previousScheduledSeconds: pair.previousSeconds,
    nextScheduledSeconds: pair.nextSeconds,
    previousScheduledTime: pair.previous?.scheduledTime ?? null,
    nextScheduledTime: pair.next?.scheduledTime ?? null,
    interpolationFraction: pair.fraction,
    matchedPreviousRouteStop: false,
    matchedNextRouteStop: false,
    calculatedProgress: null,
    positionSource: "unavailable",
    confidence: null,
    displayed: false,
    reason,
  };
}

export function resolveScheduledGhostPosition({
  routeId,
  journey,
  nowSeconds,
  direction,
  route,
  layout,
}: {
  routeId: string;
  journey: IbusScheduledJourney;
  nowSeconds: number;
  direction: RouteDirection;
  route: NormalizedRoute;
  layout: LoopLayoutConfig;
}): ScheduledGhostPositionResult {
  const pair = findScheduledStopPair(journey, nowSeconds);
  const leg = direction === "outbound" ? route.outbound : route.inbound;
  const previousMatch = matchScheduledStopOnRoute(pair.previous, direction, route);
  const nextMatch = matchScheduledStopOnRoute(pair.next, direction, route);
  let source: ScheduledGhostPositionSource = "unavailable";
  let confidence: ScheduledGhostConfidence = "low";
  let progress: number | null = null;
  let expectedStop: IbusScheduledStop | null = pair.next ?? pair.previous;
  let routeStopIndex = -1;

  if (leg.length === 0) {
    const diagnostics = buildUnavailablePositionDiagnostics({
      routeId,
      journey,
      direction,
      pair,
      reason: "route has no displayed stops for direction",
    });
    return {
      status: "unavailable",
      source: "unavailable",
      confidence,
      progress: null,
      x: null,
      y: null,
      expectedStop,
      routeStopIndex,
      diagnostics,
    };
  }

  if (
    previousMatch &&
    nextMatch &&
    pair.previousSeconds !== null &&
    pair.nextSeconds !== null &&
    pair.fraction !== null
  ) {
    if (pair.fraction <= 0) {
      progress = stopProgress(direction, previousMatch.routeStopIndex, leg.length);
      routeStopIndex = previousMatch.routeStopIndex;
      source =
        previousMatch.routeStopIndex === 0
          ? "first-stop-genuinely"
          : previousMatch.routeStopIndex === leg.length - 1
            ? "final-stop-genuinely"
            : "exact-scheduled-stop";
    } else if (pair.fraction >= 1) {
      progress = stopProgress(direction, nextMatch.routeStopIndex, leg.length);
      routeStopIndex = nextMatch.routeStopIndex;
      source =
        nextMatch.routeStopIndex === 0
          ? "first-stop-genuinely"
          : nextMatch.routeStopIndex === leg.length - 1
            ? "final-stop-genuinely"
            : "exact-scheduled-stop";
    } else if (previousMatch.routeStopIndex === nextMatch.routeStopIndex) {
      progress = stopProgress(direction, previousMatch.routeStopIndex, leg.length);
      routeStopIndex = previousMatch.routeStopIndex;
      source =
        previousMatch.routeStopIndex === 0
          ? "first-stop-genuinely"
          : previousMatch.routeStopIndex === leg.length - 1
            ? "final-stop-genuinely"
            : "exact-scheduled-stop";
    } else {
      progress = interpolateProgress(
        direction,
        previousMatch.routeStopIndex,
        nextMatch.routeStopIndex,
        leg.length,
        pair.fraction,
      );
      routeStopIndex =
        pair.fraction < 0.5
          ? previousMatch.routeStopIndex
          : nextMatch.routeStopIndex;
      source = "interpolated";
    }
    confidence =
      previousMatch.matchType === "naptan" && nextMatch.matchType === "naptan"
        ? "high"
        : "medium";
    expectedStop = pair.fraction < 0.5 ? pair.previous : pair.next;
  } else if (previousMatch || nextMatch) {
    const match = previousMatch ?? nextMatch!;
    progress = stopProgress(direction, match.routeStopIndex, leg.length);
    routeStopIndex = match.routeStopIndex;
    const exactSingleStopTime =
      (previousMatch &&
        pair.previousSeconds !== null &&
        pair.previousSeconds === pair.nowJourneySeconds) ||
      (nextMatch &&
        pair.nextSeconds !== null &&
        pair.nextSeconds === pair.nowJourneySeconds);
    source =
      exactSingleStopTime && match.routeStopIndex === 0
        ? "first-stop-genuinely"
        : exactSingleStopTime && match.routeStopIndex === leg.length - 1
          ? "final-stop-genuinely"
          : "one-sided-fallback";
    confidence = exactSingleStopTime && match.matchType === "naptan" ? "medium" : "low";
    expectedStop = match.stop;
  }

  if (progress === null || !Number.isFinite(progress)) {
    const diagnostics = buildUnavailablePositionDiagnostics({
      routeId,
      journey,
      direction,
      pair,
      reason: "no usable scheduled stop could be matched to route stops",
    });
    return {
      status: "unavailable",
      source: "unavailable",
      confidence,
      progress: null,
      x: null,
      y: null,
      expectedStop,
      routeStopIndex,
      diagnostics,
    };
  }

  if (!journey.runningNo || !journey.blockNo) {
    confidence = "low";
  }

  const coordinates = mapProgressToLoopCoordinates(progress, layout);
  const diagnostics: ScheduledGhostPositionDiagnostics = {
    routeId,
    runningNo: journey.runningNo,
    tripId: journey.tripId,
    direction,
    active: true,
    previousStopName: pair.previous?.stopName ?? null,
    previousStopCode: pair.previous?.stopCode ?? null,
    previousStopNaptanId: pair.previous?.naptanId ?? null,
    nextStopName: pair.next?.stopName ?? null,
    nextStopCode: pair.next?.stopCode ?? null,
    nextStopNaptanId: pair.next?.naptanId ?? null,
    previousScheduledSeconds: pair.previousSeconds,
    nextScheduledSeconds: pair.nextSeconds,
    previousScheduledTime: pair.previous?.scheduledTime ?? null,
    nextScheduledTime: pair.next?.scheduledTime ?? null,
    interpolationFraction: pair.fraction,
    matchedPreviousRouteStop: Boolean(previousMatch),
    matchedNextRouteStop: Boolean(nextMatch),
    calculatedProgress: progress,
    positionSource: source,
    confidence,
    displayed: confidence !== "low",
    reason: null,
  };

  return {
    status: "available",
    source,
    confidence,
    progress,
    x: coordinates.x,
    y: coordinates.y,
    expectedStop,
    routeStopIndex,
    diagnostics,
  };
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

export type LiveScheduleMatchReason =
  | "tripId/baseVersion"
  | "runningNo/blockNo"
  | "same route/runningNo"
  | "direction"
  | "next-stop/time";

export function getPlausibleLiveMatchReason(
  journey: IbusScheduledJourney,
  live: LiveVehicleMatchContext,
  currentStop: IbusScheduledStop | null,
  now: Date,
  route: NormalizedRoute,
  scheduleBaseVersion?: string,
): LiveScheduleMatchReason | null {
  if (
    live.tripId &&
    live.baseVersion &&
    scheduleBaseVersion &&
    live.baseVersion === scheduleBaseVersion &&
    journey.tripId === live.tripId
  ) {
    return "tripId/baseVersion";
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
    return "runningNo/blockNo";
  }

  if (
    sameRoute &&
    journeyRunning &&
    liveRunning &&
    journeyRunning === liveRunning
  ) {
    return "same route/runningNo";
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
    return "direction";
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
      return "next-stop/time";
    }
  }

  return null;
}

export function hasPlausibleLiveMatch(
  journey: IbusScheduledJourney,
  live: LiveVehicleMatchContext,
  currentStop: IbusScheduledStop | null,
  now: Date,
  route: NormalizedRoute,
  scheduleBaseVersion?: string,
): boolean {
  return getPlausibleLiveMatchReason(
    journey,
    live,
    currentStop,
    now,
    route,
    scheduleBaseVersion,
  ) !== null;
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
  const liveContexts: LiveVehicleMatchContext[] = input.liveVehicles.map(
    buildLiveVehicleMatchContext,
  );

  for (const journey of input.scheduledJourneys) {
    if (!isJourneyScheduledForServiceWindow(journey, input.now, nowSeconds)) {
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

    const position = resolveScheduledGhostPosition({
      routeId: input.routeId,
      journey,
      nowSeconds,
      direction,
      route: input.route,
      layout: input.layout,
    });
    if (position.status === "unavailable") {
      input.diagnostics?.push(position.diagnostics);
      continue;
    }
    const currentStop = position.expectedStop;

    const liveMatchReason = liveContexts
      .map((live) =>
        getPlausibleLiveMatchReason(
          journey,
          live,
          currentStop,
          input.now,
          input.route,
          input.scheduleBaseVersion,
        ),
      )
      .find((reason): reason is LiveScheduleMatchReason => reason !== null);
    if (liveMatchReason) {
      input.diagnostics?.push({
        ...position.diagnostics,
        confidence: position.confidence,
        displayed: false,
        reason: "suppressed by plausible live match",
        suppressionReason: liveMatchReason,
      });
      continue;
    }

    const dedupeKey = `${journey.tripId}:${journey.runningNo}:${journey.blockNo}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    const confidence = position.confidence;

    if (position.source !== "interpolated" && !input.includeLowConfidence) {
      input.diagnostics?.push({
        ...position.diagnostics,
        confidence,
        displayed: false,
        reason:
          position.source === "one-sided-fallback"
            ? "grace-only hidden"
            : "non-interpolated position hidden",
      });
      continue;
    }

    if (confidence === "low" && !input.includeLowConfidence) {
      input.diagnostics?.push({
        ...position.diagnostics,
        confidence,
        displayed: false,
        reason: "low confidence hidden",
      });
      continue;
    }

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
      progress: position.progress ?? 0,
      x: position.x ?? 0,
      y: position.y ?? 0,
      confidence,
      reason: "scheduled-journey-active-but-no-live-match",
      positionStatus: position.status,
      positionSource: position.source,
      positionDiagnostics: {
        ...position.diagnostics,
        confidence,
        displayed: true,
      },
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
  const seenDisplayedRuns = new Set<string>();
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

    if (normalizedRunning) {
      const displayedRunKey = [
        routeId,
        normalizedRunning,
        candidate.blockNo.trim(),
        candidate.direction,
      ].join(":");
      if (seenDisplayedRuns.has(displayedRunKey)) {
        if (collectDiagnostics) {
          diagnostics.push(
            `Suppressed schedule ghost ${candidate.runningNo} trip ${candidate.tripId} because an overlapping scheduled run is already displayed.`,
          );
        }
        continue;
      }
      seenDisplayedRuns.add(displayedRunKey);
    }

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
