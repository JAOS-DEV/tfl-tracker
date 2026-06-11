import { SCHEDULE_DEVIATION_THRESHOLDS } from "@/lib/constants";
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
  let best: ScheduledStopTime | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const scheduled of scheduledTimes) {
    const diffMinutes = Math.abs(
      (new Date(scheduled.scheduledArrival).getTime() - predictedMs) / 60_000,
    );
    if (diffMinutes <= windowMinutes && diffMinutes < bestDiff) {
      best = scheduled;
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

function resolveConfidence(
  deviationMinutes: number | null,
  matched: boolean,
  agreeingPredictions: number,
): ScheduleMatchConfidence {
  if (!matched || deviationMinutes === null) {
    return "unknown";
  }

  const absDeviation = Math.abs(deviationMinutes);

  if (
    agreeingPredictions >= 2 &&
    absDeviation <= SCHEDULE_DEVIATION_THRESHOLDS.HIGH_CONFIDENCE_MINUTES
  ) {
    return "high";
  }

  if (absDeviation <= SCHEDULE_DEVIATION_THRESHOLDS.HIGH_CONFIDENCE_MINUTES) {
    return "high";
  }

  if (absDeviation <= SCHEDULE_DEVIATION_THRESHOLDS.MEDIUM_CONFIDENCE_MINUTES) {
    return "medium";
  }

  return "low";
}

function scheduledTimesForStop(
  timetable: NormalizedTimetable | null | undefined,
  naptanId: string,
): ScheduledStopTime[] {
  if (!timetable?.available) {
    return [];
  }

  return timetable.journeys.flatMap((journey) =>
    journey.stopTimes.filter(
      (stopTime) =>
        stopTime.naptanId === naptanId || stopTime.stopId === naptanId,
    ),
  );
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
  const scheduleStatus = classifyScheduleDeviation(deviationMinutes);
  const confidence = resolveConfidence(
    deviationMinutes,
    vehicle.matched,
    agreeingPredictions,
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

  return vehicles.map((vehicle) => {
    const timetable = timetables[vehicle.direction] ?? null;
    const agreeingPredictions = predictionsByVehicle.get(vehicle.vehicleId)?.length ?? 1;
    const match = buildVehicleScheduleMatch(
      vehicle,
      timetable,
      agreeingPredictions,
      route,
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
