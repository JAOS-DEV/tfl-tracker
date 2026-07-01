import {
  buildLiveVehicleMatchContext,
  findCurrentScheduledStop,
  getPlausibleLiveMatchReason,
  mapIbusDirectionToRouteDirection,
  matchScheduledStopOnRoute,
  type LiveScheduleMatchReason,
} from "@/lib/scheduledGhostBuses";
import {
  ibusScheduledSecondsToInstant,
} from "@/lib/ibusScheduleDeviationTime";
import type { IbusScheduledJourney } from "@/lib/ibus/scheduleTypes";
import { normalizeRunningNumber } from "@/lib/runningNumber";
import type { ScheduleIndexes } from "@/lib/schedulePipeline/buildScheduleIndexes";
import type { LiveSchedulePool } from "@/lib/schedulePipeline/buildLiveSchedulePool";
import {
  buildScheduleDisplayState,
  buildUnknownScheduleDisplayState,
} from "@/lib/schedulePipeline/buildScheduleDisplayState";
import type {
  CandidateTimingTrace,
  CandidateScheduleMatch,
  IndexedVehicleTimingResult,
} from "@/lib/schedulePipeline/types";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";
import { addLondonCalendarDays, readLondonDateParts } from "@/lib/londonTime";

const MATCH_PRIORITY: Record<LiveScheduleMatchReason, number> = {
  "tripId/baseVersion": 5,
  "runningNo/blockNo": 4,
  "same route/runningNo": 3,
  "next-stop/time": 2,
  direction: 1,
};

const TIMING_MATCH_REASONS = new Set<LiveScheduleMatchReason>([
  "tripId/baseVersion",
  "runningNo/blockNo",
  "same route/runningNo",
  "next-stop/time",
]);

function findJourneyStopForVehicle(
  journey: IbusScheduledJourney,
  vehicle: EstimatedVehiclePosition,
  route: NormalizedRoute,
) {
  if (!vehicle.nextStop) {
    return null;
  }

  if (vehicle.nextStop.naptanId) {
    const byNaptan = journey.stops.find(
      (stop) => stop.naptanId && stop.naptanId === vehicle.nextStop?.naptanId,
    );
    if (byNaptan) {
      return byNaptan;
    }
  }

  const byCode = journey.stops.find(
    (stop) =>
      stop.stopCode &&
      (stop.stopCode === vehicle.nextStop?.id ||
        stop.stopCode === vehicle.nextStop?.naptanId),
  );
  if (byCode) {
    return byCode;
  }

  if (vehicle.direction) {
    const leg =
      vehicle.direction === "outbound" ? route.outbound : route.inbound;
    const routeStopIndex = leg.findIndex(
      (routeStop) =>
        (vehicle.nextStop?.naptanId &&
          routeStop.naptanId === vehicle.nextStop.naptanId) ||
        routeStop.id === vehicle.nextStop?.id,
    );
    if (routeStopIndex >= 0) {
      for (const schedStop of journey.stops) {
        const matched = matchScheduledStopOnRoute(
          schedStop,
          vehicle.direction,
          route,
        );
        if (matched?.routeStopIndex === routeStopIndex) {
          return schedStop;
        }
      }
    }
  }

  return null;
}

export function collectIndexedMatchCandidates(
  vehicle: EstimatedVehiclePosition,
  indexes: ScheduleIndexes,
  pool: LiveSchedulePool,
  route: NormalizedRoute,
  scheduleBaseVersion: string,
): IbusScheduledJourney[] {
  const candidates = new Map<string, IbusScheduledJourney>();

  if (vehicle.tripId && scheduleBaseVersion) {
    const key = `${scheduleBaseVersion}:${vehicle.tripId}`;
    for (const journey of indexes.byTripIdBaseVersion.get(key) ?? []) {
      candidates.set(journey.tripId, journey);
    }
  }

  const runningNo = normalizeRunningNumber(vehicle.ibusRunningNo);
  const blockNo = vehicle.ibusBlockNo?.trim();

  if (runningNo && blockNo) {
    for (const journey of indexes.byRunningNoBlockNo.get(`${runningNo}:${blockNo}`) ?? []) {
      candidates.set(journey.tripId, journey);
    }
  }

  if (runningNo) {
    for (const journey of indexes.byRunningNo.get(runningNo) ?? []) {
      candidates.set(journey.tripId, journey);
    }
  }

  if (candidates.size > 0) {
    return [...candidates.values()];
  }

  if (!vehicle.direction) {
    return [];
  }

  return pool.liveMatchingJourneys.filter((journey) => {
    const direction = mapIbusDirectionToRouteDirection(
      journey.direction,
      journey,
      route,
    );
    return direction === vehicle.direction;
  });
}

export function collectDirectionalActiveCandidates(
  vehicle: EstimatedVehiclePosition,
  pool: LiveSchedulePool,
  route: NormalizedRoute,
): IbusScheduledJourney[] {
  if (!vehicle.direction) {
    return [];
  }

  return pool.liveMatchingJourneys.filter((journey) => {
    const direction = mapIbusDirectionToRouteDirection(
      journey.direction,
      journey,
      route,
    );
    return direction === vehicle.direction;
  });
}

const FALLBACK_MATCH_MAX_STOP_TIME_DIFFERENCE_MINUTES = 30;

function formatServiceTime(seconds: number): string {
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor((seconds % 3600) / 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatLondonInstant(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function describeStaticServiceDay(
  scheduledSeconds: number,
  scheduledInstant: Date,
): { staticServiceDayLondon: string; staticRolloverDays: number } {
  const staticRolloverDays = Math.floor(scheduledSeconds / 86_400);
  const arrivalDate = readLondonDateParts(scheduledInstant);
  const serviceDate = addLondonCalendarDays(
    arrivalDate.year,
    arrivalDate.month,
    arrivalDate.day,
    -staticRolloverDays,
  );
  return {
    staticServiceDayLondon: `${serviceDate.year}-${String(serviceDate.month).padStart(2, "0")}-${String(serviceDate.day).padStart(2, "0")}`,
    staticRolloverDays,
  };
}

export interface ScheduleMatchSelectionResult {
  match: CandidateScheduleMatch | null;
  trace?: CandidateTimingTrace;
}

export function selectBestScheduleMatchWithDiagnostics(
  vehicle: EstimatedVehiclePosition,
  journeys: IbusScheduledJourney[],
  route: NormalizedRoute,
  pool: LiveSchedulePool,
  scheduleBaseVersion: string,
): ScheduleMatchSelectionResult {
  const live = buildLiveVehicleMatchContext(vehicle);
  let best:
    | (CandidateScheduleMatch & { priority: number; score: number })
    | null = null;
  let bestScoreTied = false;
  let bestTrace: CandidateTimingTrace | undefined;
  let bestRejectedTrace: CandidateTimingTrace | undefined;
  let bestRejectedScore = Number.NEGATIVE_INFINITY;

  for (const journey of journeys) {
    const currentStop = findCurrentScheduledStop(
      journey,
      pool.nowSeconds,
    );
    const reason = getPlausibleLiveMatchReason(
      journey,
      live,
      currentStop,
      pool.now,
      route,
      scheduleBaseVersion,
    );
    if (!reason || !TIMING_MATCH_REASONS.has(reason)) {
      continue;
    }

    const priority = MATCH_PRIORITY[reason];
    const scheduledStop = findJourneyStopForVehicle(journey, vehicle, route);
    const isExactTripMatch = reason === "tripId/baseVersion";
    const journeyDirection = mapIbusDirectionToRouteDirection(
      journey.direction,
      journey,
      route,
    );

    let stopTimeDifferenceMinutes = 0;
    let trace: CandidateTimingTrace | undefined;
    if (vehicle.expectedArrival && scheduledStop) {
      const expectedArrival = new Date(vehicle.expectedArrival);
      const scheduledInstant = ibusScheduledSecondsToInstant(
        scheduledStop.scheduledSeconds,
        expectedArrival,
      );
      stopTimeDifferenceMinutes =
        Math.abs(
            scheduledInstant.getTime() -
            expectedArrival.getTime(),
        ) / 60_000;
      trace = {
        journeyId: journey.tripId,
        rawJourneyStartServiceTime: formatServiceTime(journey.startSeconds),
        rawJourneyEndServiceTime: formatServiceTime(journey.endSeconds),
        rawScheduledServiceTime: formatServiceTime(
          scheduledStop.scheduledSeconds,
        ),
        ...describeStaticServiceDay(
          scheduledStop.scheduledSeconds,
          scheduledInstant,
        ),
        liveExpectedArrivalUtc: expectedArrival.toISOString(),
        liveExpectedArrivalLondon: formatLondonInstant(expectedArrival),
        scheduledArrivalUtc: scheduledInstant.toISOString(),
        scheduledArrivalLondon: formatLondonInstant(scheduledInstant),
        stopTimeDifferenceMinutes: Math.round(stopTimeDifferenceMinutes),
        rejectionReason: null,
      };
    } else if (!isExactTripMatch) {
      continue;
    }

    const directionMismatch =
      !isExactTripMatch &&
      vehicle.direction &&
      journeyDirection &&
      vehicle.direction !== journeyDirection;

    const directionScore =
      vehicle.direction && journeyDirection === vehicle.direction ? 100 : 0;
    const score = priority * 10_000 + directionScore - stopTimeDifferenceMinutes;

    if (directionMismatch) {
      if (trace && score > bestRejectedScore) {
        bestRejectedTrace = { ...trace, rejectionReason: "direction-mismatch" };
        bestRejectedScore = score;
      }
      continue;
    }

    if (
      !isExactTripMatch &&
      stopTimeDifferenceMinutes > FALLBACK_MATCH_MAX_STOP_TIME_DIFFERENCE_MINUTES
    ) {
      if (trace && score > bestRejectedScore) {
        bestRejectedTrace = {
          ...trace,
          rejectionReason: "fallback-time-difference",
        };
        bestRejectedScore = score;
      }
      continue;
    }

    if (!best || score > best.score) {
      best = { journey, reason, priority, score };
      bestTrace = trace;
      bestScoreTied = false;
    } else if (score === best.score) {
      bestScoreTied = true;
    }
  }

  if (best && !bestScoreTied) {
    return {
      match: { journey: best.journey, reason: best.reason },
      trace: bestTrace,
    };
  }

  return {
    match: null,
    trace:
      best && bestScoreTied && bestTrace
        ? { ...bestTrace, rejectionReason: "ambiguous-score" }
        : bestRejectedTrace,
  };
}

export function selectBestScheduleMatch(
  vehicle: EstimatedVehiclePosition,
  journeys: IbusScheduledJourney[],
  route: NormalizedRoute,
  pool: LiveSchedulePool,
  scheduleBaseVersion: string,
): CandidateScheduleMatch | null {
  return selectBestScheduleMatchWithDiagnostics(
    vehicle,
    journeys,
    route,
    pool,
    scheduleBaseVersion,
  ).match;
}

export function matchLiveVehicleToSchedule(
  vehicle: EstimatedVehiclePosition,
  pool: LiveSchedulePool,
  indexes: ScheduleIndexes,
  route: NormalizedRoute,
  scheduleBaseVersion: string,
): IndexedVehicleTimingResult {
  if (vehicle.isScheduledGhostCandidate) {
    return {
      vehicleId: vehicle.vehicleId,
      display: buildUnknownScheduleDisplayState(
        vehicle,
        "Schedule ghost candidate",
        "no-trusted-match",
      ),
      rawDeviationMinutes: null,
      matchReason: null,
    };
  }

  const indexedCandidates = collectIndexedMatchCandidates(
    vehicle,
    indexes,
    pool,
    route,
    scheduleBaseVersion,
  );
  let selection = selectBestScheduleMatchWithDiagnostics(
    vehicle,
    indexedCandidates,
    route,
    pool,
    scheduleBaseVersion,
  );
  let match = selection.match;

  if (!match) {
    const directionalCandidates = collectDirectionalActiveCandidates(
      vehicle,
      pool,
      route,
    );
    const fallbackSelection = selectBestScheduleMatchWithDiagnostics(
      vehicle,
      directionalCandidates,
      route,
      pool,
      scheduleBaseVersion,
    );
    match = fallbackSelection.match;
    if (fallbackSelection.match || !selection.trace) {
      selection = fallbackSelection;
    }
  }

  const scheduledStop = match
    ? findJourneyStopForVehicle(match.journey, vehicle, route)
    : null;
  const scheduledInstant =
    scheduledStop && vehicle.expectedArrival
      ? ibusScheduledSecondsToInstant(
          scheduledStop.scheduledSeconds,
          new Date(vehicle.expectedArrival),
        ).toISOString()
      : null;

  const display = buildScheduleDisplayState(
    vehicle,
    route,
    match,
    scheduledStop,
    scheduledInstant,
  );

  return {
    vehicleId: vehicle.vehicleId,
    display,
    rawDeviationMinutes: display.deviationMinutes,
    matchReason: match?.reason ?? null,
    timingTrace: selection.trace,
  };
}

export function matchLiveVehiclesToSchedule(
  vehicles: EstimatedVehiclePosition[],
  pool: LiveSchedulePool,
  indexes: ScheduleIndexes,
  route: NormalizedRoute,
): {
  vehicles: EstimatedVehiclePosition[];
  timingResults: IndexedVehicleTimingResult[];
} {
  const scheduleBaseVersion = pool.baseVersion;
  const timingResults: IndexedVehicleTimingResult[] = [];

  const matchedVehicles = vehicles.map((vehicle) => {
    const timing = matchLiveVehicleToSchedule(
      vehicle,
      pool,
      indexes,
      route,
      scheduleBaseVersion,
    );
    timingResults.push(timing);

    return {
      ...vehicle,
      scheduleDeviationMinutes: timing.display.deviationMinutes,
      scheduleStatus: timing.display.scheduleStatus,
      scheduleStatusLabel: timing.display.scheduleStatusLabel,
      scheduleMatchConfidence: timing.display.scheduleMatchConfidence,
      matchedScheduledTime: timing.display.matchedScheduledTime,
      matchedStopName: timing.display.matchedStopName,
      scheduleDataAvailable: timing.display.scheduleDataAvailable,
      scheduleExplanation: timing.display.scheduleExplanation,
    };
  });

  return { vehicles: matchedVehicles, timingResults };
}
