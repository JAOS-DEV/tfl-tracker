import { SCHEDULE_DEVIATION_THRESHOLDS } from "@/lib/constants";
import {
  alignScheduledInstantToReference,
  readLondonDateParts,
} from "@/lib/londonTime";
import { formatMatchedStopDisplayName } from "@/lib/stopDisplayName";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedTimetable,
  NormalizedVehiclePrediction,
  RouteDirection,
  ScheduleMatchConfidence,
  ScheduleStatus,
  ScheduledStopTime,
  VehicleScheduleMatch,
} from "@/lib/tfl/types";

export function findNearestScheduledTime(
  predictedArrivalTime: string,
  scheduledTimes: ScheduledStopTime[],
  windowMinutes = SCHEDULE_DEVIATION_THRESHOLDS.MATCH_WINDOW_MINUTES,
): ScheduledStopTime | null {
  if (scheduledTimes.length === 0) {
    return null;
  }

  const predictedMs = new Date(predictedArrivalTime).getTime();
  const reference = new Date(predictedArrivalTime);
  const referenceDate = readLondonDateParts(reference);
  const alignedCache = new Map<string, number>();
  let best: ScheduledStopTime | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const scheduled of scheduledTimes) {
    let alignedMs = alignedCache.get(scheduled.scheduledArrival);
    if (alignedMs === undefined) {
      alignedMs = alignScheduledInstantToReference(
        scheduled.scheduledArrival,
        reference,
        referenceDate,
      ).getTime();
      alignedCache.set(scheduled.scheduledArrival, alignedMs);
    }

    const diffMinutes = Math.abs((alignedMs - predictedMs) / 60_000);
    if (diffMinutes <= windowMinutes && diffMinutes < bestDiff) {
      best = {
        ...scheduled,
        scheduledArrival: new Date(alignedMs).toISOString(),
      };
      bestDiff = diffMinutes;
    }
  }

  return best;
}

export function calculateScheduleDeviationMinutes(
  predictedArrival: string,
  scheduledTime: string,
): number {
  const diffMs =
    new Date(predictedArrival).getTime() - new Date(scheduledTime).getTime();
  return Math.round(diffMs / 60_000);
}

export function classifyScheduleDeviation(
  deviationMinutes: number,
): ScheduleStatus {
  if (deviationMinutes <= SCHEDULE_DEVIATION_THRESHOLDS.EARLY_MINUTES) {
    return "early";
  }
  if (deviationMinutes >= SCHEDULE_DEVIATION_THRESHOLDS.LATE_MINUTES) {
    return "late";
  }
  if (
    deviationMinutes >= -1 &&
    deviationMinutes <= SCHEDULE_DEVIATION_THRESHOLDS.ON_TIME_MAX_MINUTES
  ) {
    return "onTime";
  }
  return "unknown";
}

export function scheduleStatusLabel(
  status: ScheduleStatus,
  deviationMinutes: number | null,
): string {
  if (status === "unknown" || deviationMinutes === null) {
    return "Schedule ?";
  }
  if (status === "onTime") {
    return "On time";
  }
  if (status === "early") {
    return `${deviationMinutes} early`;
  }
  return `+${deviationMinutes} late`;
}

export function scheduleBadgeLabel(
  status: ScheduleStatus,
  deviationMinutes: number | null,
  confidence: ScheduleMatchConfidence,
): string | null {
  if (confidence === "unknown" || confidence === "low") {
    return "?";
  }
  if (status === "unknown" || deviationMinutes === null) {
    return "?";
  }
  if (status === "onTime") {
    return "OK";
  }
  if (status === "early") {
    return `${deviationMinutes}`;
  }
  return `+${deviationMinutes}`;
}

export function scheduleLoopBadgeLabel(
  status: ScheduleStatus,
  deviationMinutes: number | null,
  confidence: ScheduleMatchConfidence,
): string | null {
  if (confidence === "unknown" || confidence === "low") {
    return null;
  }
  if (status === "unknown" || deviationMinutes === null) {
    return null;
  }
  if (status === "onTime") {
    return "OK";
  }
  if (status === "early") {
    return `${deviationMinutes}`;
  }
  return `+${deviationMinutes}`;
}

export function scheduleAccessibleLabel(
  status: ScheduleStatus,
  deviationMinutes: number | null,
): string {
  if (status === "unknown" || deviationMinutes === null) {
    return "Schedule match uncertain";
  }
  if (status === "onTime") {
    return "Bus estimated on time";
  }
  if (status === "early") {
    return `Bus estimated ${Math.abs(deviationMinutes)} minutes early`;
  }
  return `Bus estimated ${deviationMinutes} minutes late`;
}

export type ScheduleMatchQuality = "exact" | "strong" | "weak";

function deviationConfidenceTier(
  absDeviationMinutes: number,
): ScheduleMatchConfidence {
  if (
    absDeviationMinutes <=
    SCHEDULE_DEVIATION_THRESHOLDS.HIGH_CONFIDENCE_MINUTES
  ) {
    return "high";
  }
  return "medium";
}

export function resolveScheduleMatchConfidence(
  matchQuality: ScheduleMatchQuality,
  deviationMinutes: number | null,
): ScheduleMatchConfidence {
  if (deviationMinutes === null) {
    return "unknown";
  }

  const {
    EARLY_MINUTES,
    LATE_MINUTES,
    ON_TIME_MAX_MINUTES,
    MAX_TRUSTED_STRONG_LATE_MINUTES,
    MAX_TRUSTED_STRONG_EARLY_MINUTES,
    MAX_TRUSTED_WEAK_DEVIATION_MINUTES,
  } = SCHEDULE_DEVIATION_THRESHOLDS;

  if (matchQuality === "exact" || matchQuality === "strong") {
    if (deviationMinutes >= LATE_MINUTES) {
      if (deviationMinutes <= MAX_TRUSTED_STRONG_LATE_MINUTES) {
        return deviationConfidenceTier(deviationMinutes);
      }
      if (matchQuality === "exact") {
        return "medium";
      }
      return "unknown";
    }

    if (deviationMinutes <= EARLY_MINUTES) {
      const earlyAmount = Math.abs(deviationMinutes);
      if (earlyAmount <= MAX_TRUSTED_STRONG_EARLY_MINUTES) {
        return deviationConfidenceTier(earlyAmount);
      }
      return "unknown";
    }

    if (deviationMinutes >= -1 && deviationMinutes <= ON_TIME_MAX_MINUTES) {
      return "high";
    }

    return deviationConfidenceTier(Math.abs(deviationMinutes));
  }

  const absDeviation = Math.abs(deviationMinutes);
  if (absDeviation <= MAX_TRUSTED_WEAK_DEVIATION_MINUTES) {
    return deviationConfidenceTier(absDeviation);
  }

  return "low";
}

export function gateScheduleStatusForConfidence(
  scheduleStatus: ScheduleStatus,
  confidence: ScheduleMatchConfidence,
): ScheduleStatus {
  if (confidence === "unknown" || confidence === "low") {
    return "unknown";
  }
  return scheduleStatus;
}

function resolveConfidence(
  deviationMinutes: number | null,
  matched: boolean,
): ScheduleMatchConfidence {
  if (!matched || deviationMinutes === null) {
    return "unknown";
  }

  return resolveScheduleMatchConfidence("weak", deviationMinutes);
}

function scheduledTimesForStop(
  timetable: NormalizedTimetable | null | undefined,
  naptanId: string,
  stopIndex?: Map<string, ScheduledStopTime[]>,
): ScheduledStopTime[] {
  if (!timetable?.available) {
    return [];
  }

  if (stopIndex) {
    return stopIndex.get(naptanId) ?? [];
  }

  return timetable.journeys.flatMap((journey) =>
    journey.stopTimes.filter(
      (stopTime) =>
        stopTime.naptanId === naptanId || stopTime.stopId === naptanId,
    ),
  );
}

function buildTimetableStopIndex(
  timetable: NormalizedTimetable | null | undefined,
): Map<string, ScheduledStopTime[]> {
  const index = new Map<string, ScheduledStopTime[]>();

  if (!timetable?.available) {
    return index;
  }

  for (const journey of timetable.journeys) {
    for (const stopTime of journey.stopTimes) {
      const addStopTime = (key: string) => {
        const existing = index.get(key) ?? [];
        if (
          existing.some(
            (entry) => entry.scheduledArrival === stopTime.scheduledArrival,
          )
        ) {
          return;
        }

        existing.push(stopTime);
        index.set(key, existing);
      };

      addStopTime(stopTime.naptanId);

      if (stopTime.stopId !== stopTime.naptanId) {
        addStopTime(stopTime.stopId);
      }
    }
  }

  return index;
}

function resolveMatchedStopName(
  vehicle: Pick<
    EstimatedVehiclePosition,
    "direction" | "nextStop"
  >,
  timetableStop: ScheduledStopTime | null,
  route?: NormalizedRoute,
): string | null {
  if (timetableStop && route) {
    return formatMatchedStopDisplayName(vehicle, timetableStop, route);
  }
  if (vehicle.nextStop?.name) {
    return vehicle.nextStop.name;
  }
  if (timetableStop && !/^[0-9]{6,}[A-Z]?$/i.test(timetableStop.stopName)) {
    return timetableStop.stopName;
  }
  return null;
}

export function buildVehicleScheduleMatch(
  vehicle: Pick<
    EstimatedVehiclePosition,
    | "vehicleId"
    | "direction"
    | "expectedArrival"
    | "matched"
    | "nextStop"
    | "destinationName"
    | "ghostStatus"
  >,
  timetable: NormalizedTimetable | null | undefined,
  agreeingPredictions: number,
  route?: NormalizedRoute,
  stopIndex?: Map<string, ScheduledStopTime[]>,
): VehicleScheduleMatch {
  if (vehicle.ghostStatus === "suspectedGhost") {
    return {
      deviationMinutes: null,
      scheduleStatus: "unknown",
      scheduleStatusLabel: "Schedule ?",
      scheduleMatchConfidence: "unknown",
      matchedScheduledTime: null,
      matchedStopName: null,
      scheduleDataAvailable: Boolean(timetable?.available),
      scheduleExplanation: "Schedule match uncertain",
    };
  }

  if (!timetable?.available || !vehicle.matched || !vehicle.nextStop) {
    return {
      deviationMinutes: null,
      scheduleStatus: "unknown",
      scheduleStatusLabel: "Schedule ?",
      scheduleMatchConfidence: "unknown",
      matchedScheduledTime: null,
      matchedStopName: resolveMatchedStopName(vehicle, null, route),
      scheduleDataAvailable: Boolean(timetable?.available),
      scheduleExplanation: timetable?.available
        ? "Schedule match uncertain"
        : "Timetable unavailable",
    };
  }

  const scheduledTimes = scheduledTimesForStop(
    timetable,
    vehicle.nextStop.naptanId,
    stopIndex,
  );
  const nearest = findNearestScheduledTime(
    vehicle.expectedArrival,
    scheduledTimes,
  );

  if (!nearest) {
    return {
      deviationMinutes: null,
      scheduleStatus: "unknown",
      scheduleStatusLabel: "Schedule ?",
      scheduleMatchConfidence: "unknown",
      matchedScheduledTime: null,
      matchedStopName: resolveMatchedStopName(vehicle, null, route),
      scheduleDataAvailable: true,
      scheduleExplanation: "Schedule match uncertain",
    };
  }

  const deviationMinutes = calculateScheduleDeviationMinutes(
    vehicle.expectedArrival,
    nearest.scheduledArrival,
  );
  const rawScheduleStatus = classifyScheduleDeviation(deviationMinutes);
  const confidence = resolveConfidence(deviationMinutes, vehicle.matched);
  const scheduleStatus = gateScheduleStatusForConfidence(
    rawScheduleStatus,
    confidence,
  );

  return {
    deviationMinutes,
    scheduleStatus,
    scheduleStatusLabel: scheduleStatusLabel(scheduleStatus, deviationMinutes),
    scheduleMatchConfidence: confidence,
    matchedScheduledTime: nearest.scheduledArrival,
    matchedStopName: resolveMatchedStopName(vehicle, nearest, route),
    scheduleDataAvailable: true,
    scheduleExplanation:
      "Estimated from TfL live predictions and timetable data",
  };
}

export function matchVehicleToSchedule(
  vehicles: EstimatedVehiclePosition[],
  timetables: Partial<Record<RouteDirection, NormalizedTimetable | null>>,
  predictions: NormalizedVehiclePrediction[],
  route: NormalizedRoute,
): EstimatedVehiclePosition[] {
  const predictionsByVehicle = new Map<string, NormalizedVehiclePrediction[]>();
  for (const prediction of predictions) {
    const vehicleId = prediction.vehicleId ?? prediction.id;
    const existing = predictionsByVehicle.get(vehicleId) ?? [];
    existing.push(prediction);
    predictionsByVehicle.set(vehicleId, existing);
  }

  const stopIndexes: Partial<Record<RouteDirection, Map<string, ScheduledStopTime[]>>> =
    {
      outbound: buildTimetableStopIndex(timetables.outbound ?? null),
      inbound: buildTimetableStopIndex(timetables.inbound ?? null),
    };

  return vehicles.map((vehicle) => {
    const timetable = timetables[vehicle.direction] ?? null;
    const agreeingPredictions = predictionsByVehicle.get(vehicle.vehicleId)?.length ?? 1;
    const match = buildVehicleScheduleMatch(
      vehicle,
      timetable,
      agreeingPredictions,
      route,
      stopIndexes[vehicle.direction],
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

export function summarizeScheduleMatches(
  vehicles: EstimatedVehiclePosition[],
): {
  estimatedLateCount: number;
  estimatedEarlyCount: number;
  estimatedOnTimeCount: number;
  unknownScheduleMatchCount: number;
  averageScheduleDeviationMinutes: number | null;
} {
  let estimatedLateCount = 0;
  let estimatedEarlyCount = 0;
  let estimatedOnTimeCount = 0;
  let unknownScheduleMatchCount = 0;
  const deviations: number[] = [];

  for (const vehicle of vehicles) {
    if (
      vehicle.scheduleMatchConfidence === "unknown" ||
      vehicle.scheduleMatchConfidence === "low" ||
      vehicle.scheduleStatus === "unknown" ||
      vehicle.isSuspectedGhost
    ) {
      unknownScheduleMatchCount += 1;
      continue;
    }

    if (vehicle.scheduleDeviationMinutes !== null) {
      deviations.push(vehicle.scheduleDeviationMinutes);
    }

    if (vehicle.scheduleStatus === "late") {
      estimatedLateCount += 1;
    } else if (vehicle.scheduleStatus === "early") {
      estimatedEarlyCount += 1;
    } else if (vehicle.scheduleStatus === "onTime") {
      estimatedOnTimeCount += 1;
    } else {
      unknownScheduleMatchCount += 1;
    }
  }

  const averageScheduleDeviationMinutes =
    deviations.length > 0
      ? Math.round(
          deviations.reduce((sum, value) => sum + value, 0) / deviations.length,
        )
      : null;

  return {
    estimatedLateCount,
    estimatedEarlyCount,
    estimatedOnTimeCount,
    unknownScheduleMatchCount,
    averageScheduleDeviationMinutes,
  };
}
