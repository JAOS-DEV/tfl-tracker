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
  CandidateScheduleMatch,
  IndexedVehicleTimingResult,
} from "@/lib/schedulePipeline/types";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

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

  return pool.activeJourneys.filter((journey) => {
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

  return pool.activeJourneys.filter((journey) => {
    const direction = mapIbusDirectionToRouteDirection(
      journey.direction,
      journey,
      route,
    );
    return direction === vehicle.direction;
  });
}

function findBestMatchingJourney(
  vehicle: EstimatedVehiclePosition,
  journeys: IbusScheduledJourney[],
  route: NormalizedRoute,
  pool: LiveSchedulePool,
  scheduleBaseVersion: string,
): CandidateScheduleMatch | null {
  const live = buildLiveVehicleMatchContext(vehicle);
  let best: CandidateScheduleMatch & { priority: number } | null = null;

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
    if (!best || priority > best.priority) {
      best = { journey, reason, priority };
    }
  }

  return best ? { journey: best.journey, reason: best.reason } : null;
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
  let match = findBestMatchingJourney(
    vehicle,
    indexedCandidates,
    route,
    pool,
    scheduleBaseVersion,
  );

  if (!match) {
    const directionalCandidates = collectDirectionalActiveCandidates(
      vehicle,
      pool,
      route,
    );
    match = findBestMatchingJourney(
      vehicle,
      directionalCandidates,
      route,
      pool,
      scheduleBaseVersion,
    );
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
