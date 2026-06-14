import { SCHEDULE_DEVIATION_THRESHOLDS } from "@/lib/constants";
import type {
  IbusRouteSchedule,
  IbusScheduledJourney,
  IbusScheduledStop,
} from "@/lib/ibus/scheduleTypes";
import { buildScheduledDate } from "@/lib/londonTime";
import {
  buildLiveVehicleMatchContext,
  findCurrentScheduledStop,
  getPlausibleLiveMatchReason,
  isJourneyActiveAtTime,
  isJourneyScheduledForServiceWindow,
  type LiveScheduleMatchReason,
} from "@/lib/scheduledGhostBuses";
import {
  buildVehicleScheduleMatch,
  calculateScheduleDeviationMinutes,
  classifyScheduleDeviation,
  scheduleStatusLabel,
} from "@/lib/scheduleDeviation";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  ScheduleMatchConfidence,
  VehicleScheduleMatch,
} from "@/lib/tfl/types";

const MATCH_PRIORITY: Record<LiveScheduleMatchReason, number> = {
  "tripId/baseVersion": 5,
  "runningNo/blockNo": 4,
  "same route/runningNo": 3,
  direction: 1,
  "next-stop/time": 2,
};

const TIMING_MATCH_REASONS = new Set<LiveScheduleMatchReason>([
  "tripId/baseVersion",
  "runningNo/blockNo",
  "same route/runningNo",
  "next-stop/time",
]);

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

export function ibusScheduledSecondsToInstant(
  scheduledSeconds: number,
  reference: Date,
): Date {
  const hour = Math.floor(scheduledSeconds / 3600);
  const minute = Math.floor((scheduledSeconds % 3600) / 60);
  return buildScheduledDate(String(hour), String(minute), reference);
}

function findJourneyStopForVehicle(
  journey: IbusScheduledJourney,
  vehicle: EstimatedVehiclePosition,
): IbusScheduledStop | null {
  if (!vehicle.nextStop) {
    return null;
  }

  const byNaptan = journey.stops.find(
    (stop) => stop.naptanId && stop.naptanId === vehicle.nextStop?.naptanId,
  );
  if (byNaptan) {
    return byNaptan;
  }

  return (
    journey.stops.find(
      (stop) =>
        stop.stopCode &&
        (stop.stopCode === vehicle.nextStop?.id ||
          stop.stopCode === vehicle.nextStop?.naptanId),
    ) ?? null
  );
}

function confidenceForMatchReason(
  reason: LiveScheduleMatchReason,
  deviationMinutes: number | null,
): ScheduleMatchConfidence {
  if (deviationMinutes === null) {
    return "unknown";
  }

  const absDeviation = Math.abs(deviationMinutes);
  if (reason === "tripId/baseVersion" || reason === "runningNo/blockNo") {
    if (absDeviation <= SCHEDULE_DEVIATION_THRESHOLDS.HIGH_CONFIDENCE_MINUTES) {
      return "high";
    }
    if (absDeviation <= SCHEDULE_DEVIATION_THRESHOLDS.MEDIUM_CONFIDENCE_MINUTES) {
      return "medium";
    }
    return "low";
  }

  if (reason === "same route/runningNo" || reason === "next-stop/time") {
    if (absDeviation <= SCHEDULE_DEVIATION_THRESHOLDS.MEDIUM_CONFIDENCE_MINUTES) {
      return "medium";
    }
    return "low";
  }

  return "unknown";
}

function findBestMatchingJourney(
  vehicle: EstimatedVehiclePosition,
  journeys: IbusScheduledJourney[],
  route: NormalizedRoute,
  now: Date,
  scheduleBaseVersion: string,
): {
  journey: IbusScheduledJourney;
  reason: LiveScheduleMatchReason;
} | null {
  const live = buildLiveVehicleMatchContext(vehicle);
  let best: {
    journey: IbusScheduledJourney;
    reason: LiveScheduleMatchReason;
    priority: number;
  } | null = null;

  for (const journey of journeys) {
    const currentStop = findCurrentScheduledStop(journey, londonDaySeconds(now));
    const reason = getPlausibleLiveMatchReason(
      journey,
      live,
      currentStop,
      now,
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

export function buildIbusVehicleScheduleMatch(
  vehicle: EstimatedVehiclePosition,
  routeSchedule: IbusRouteSchedule,
  route: NormalizedRoute,
  now: Date,
  liveBaseVersion?: string,
): VehicleScheduleMatch {
  if (vehicle.ghostStatus === "suspectedGhost") {
    return buildVehicleScheduleMatch(vehicle, null, 1, route);
  }

  if (!vehicle.matched || !vehicle.nextStop) {
    return {
      deviationMinutes: null,
      scheduleStatus: "unknown",
      scheduleStatusLabel: "Schedule ?",
      scheduleMatchConfidence: "unknown",
      matchedScheduledTime: null,
      matchedStopName: vehicle.nextStop?.name ?? null,
      scheduleDataAvailable: true,
      scheduleExplanation: "Schedule match uncertain",
    };
  }

  const scheduleBaseVersion = liveBaseVersion ?? routeSchedule.baseVersion;
  const nowSeconds = londonDaySeconds(now);
  const activeJourneys = routeSchedule.journeys.filter(
    (journey) =>
      isJourneyScheduledForServiceWindow(journey, now, nowSeconds) &&
      isJourneyActiveAtTime(journey, nowSeconds),
  );
  const match = findBestMatchingJourney(
    vehicle,
    activeJourneys,
    route,
    now,
    scheduleBaseVersion,
  );

  if (!match) {
    return {
      deviationMinutes: null,
      scheduleStatus: "unknown",
      scheduleStatusLabel: "Schedule ?",
      scheduleMatchConfidence: "unknown",
      matchedScheduledTime: null,
      matchedStopName: vehicle.nextStop.name,
      scheduleDataAvailable: true,
      scheduleExplanation: "No matching active iBus journey for live bus",
    };
  }

  const scheduledStop = findJourneyStopForVehicle(match.journey, vehicle);
  if (!scheduledStop) {
    return {
      deviationMinutes: null,
      scheduleStatus: "unknown",
      scheduleStatusLabel: "Schedule ?",
      scheduleMatchConfidence: "unknown",
      matchedScheduledTime: null,
      matchedStopName: vehicle.nextStop.name,
      scheduleDataAvailable: true,
      scheduleExplanation: "Matched journey has no scheduled time for next stop",
    };
  }

  const scheduledInstant = ibusScheduledSecondsToInstant(
    scheduledStop.scheduledSeconds,
    new Date(vehicle.expectedArrival),
  );
  const deviationMinutes = calculateScheduleDeviationMinutes(
    vehicle.expectedArrival,
    scheduledInstant.toISOString(),
  );
  const scheduleStatus = classifyScheduleDeviation(deviationMinutes);
  const scheduleMatchConfidence = confidenceForMatchReason(
    match.reason,
    deviationMinutes,
  );

  return {
    deviationMinutes,
    scheduleStatus,
    scheduleStatusLabel: scheduleStatusLabel(scheduleStatus, deviationMinutes),
    scheduleMatchConfidence,
    matchedScheduledTime: scheduledInstant.toISOString(),
    matchedStopName: scheduledStop.stopName || vehicle.nextStop.name,
    scheduleDataAvailable: true,
    scheduleExplanation: `Matched iBus journey ${match.journey.tripId} (${match.reason})`,
    matchedJourneyId: match.journey.tripId,
  };
}

export function matchVehiclesToIbusRouteSchedule(
  vehicles: EstimatedVehiclePosition[],
  routeSchedule: IbusRouteSchedule,
  route: NormalizedRoute,
  now: number,
  liveBaseVersion?: string,
): EstimatedVehiclePosition[] {
  const nowDate = new Date(now);

  return vehicles.map((vehicle) => {
    if (vehicle.isScheduledGhostCandidate) {
      return vehicle;
    }

    const match = buildIbusVehicleScheduleMatch(
      vehicle,
      routeSchedule,
      route,
      nowDate,
      liveBaseVersion,
    );

    return {
      ...vehicle,
      scheduleDeviationMinutes: match.deviationMinutes,
      scheduleStatus: match.scheduleStatus,
      scheduleStatusLabel: match.scheduleStatusLabel,
      scheduleMatchConfidence: match.scheduleMatchConfidence,
      matchedScheduledTime: match.matchedScheduledTime,
      matchedStopName: match.matchedStopName,
      scheduleDataAvailable: match.scheduleDataAvailable,
      scheduleExplanation: match.scheduleExplanation,
    };
  });
}

export function resolveAdherenceFromScheduleStatus(
  scheduleStatus: EstimatedVehiclePosition["scheduleStatus"],
): EstimatedVehiclePosition["adherence"] {
  if (scheduleStatus === "late") {
    return "late";
  }
  if (scheduleStatus === "early") {
    return "early";
  }
  if (scheduleStatus === "onTime") {
    return "onTime";
  }
  return "unknown";
}
