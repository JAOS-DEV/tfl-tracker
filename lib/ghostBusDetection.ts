import { GHOST_BUS_THRESHOLDS } from "@/lib/constants";
import { isPredictionDataStale } from "@/lib/predictionTracking";
import type {
  GhostStatus,
  NormalizedVehiclePrediction,
  PredictionTrackingState,
} from "@/lib/tfl/types";

export interface GhostBusState {
  ghostStatus: GhostStatus;
  ghostReason?: string;
  lastSeenAt?: number;
  missedRefreshCount: number;
  reappearedAt?: number;
  isSuspectedGhost: boolean;
}

export interface ResolveGhostStatusInput {
  state?: PredictionTrackingState;
  dataUpdatedAt: number;
  now: number;
  lastTimeToStation?: number;
}

function wasDueSoon(timeToStation: number | undefined): boolean {
  if (timeToStation === undefined) {
    return false;
  }
  return timeToStation <= GHOST_BUS_THRESHOLDS.DUE_SOON_GHOST_THRESHOLD_MINUTES * 60;
}

function withinGracePeriod(lastSeenAt: number | undefined, now: number): boolean {
  if (!lastSeenAt) {
    return false;
  }
  return (
    now - lastSeenAt <= GHOST_BUS_THRESHOLDS.GHOST_GRACE_PERIOD_SECONDS * 1000
  );
}

export function resolveGhostStatus(
  input: ResolveGhostStatusInput,
): GhostBusState {
  const state = input.state;
  const missedRefreshCount = state?.missingRefreshCount ?? 0;
  const lastSeenAt = state?.lastSeenAt;
  const lastTimeToStation = state?.lastTimeToStation ?? input.lastTimeToStation;

  if (
    state?.justReappeared &&
    state.reappearedAt &&
    input.now - state.reappearedAt <=
      GHOST_BUS_THRESHOLDS.REAPPEARED_DISPLAY_SECONDS * 1000
  ) {
    return {
      ghostStatus: "reappeared",
      ghostReason: "Prediction reappeared in the TfL feed",
      lastSeenAt,
      missedRefreshCount,
      reappearedAt: state.reappearedAt,
      isSuspectedGhost: false,
    };
  }

  if (isPredictionDataStale(input.dataUpdatedAt, input.now)) {
    return {
      ghostStatus: "stale",
      ghostReason: "Prediction data may be stale",
      lastSeenAt,
      missedRefreshCount,
      isSuspectedGhost: false,
    };
  }

  if (
    missedRefreshCount >=
      GHOST_BUS_THRESHOLDS.SUSPECTED_GHOST_REFRESH_THRESHOLD &&
    (state?.wasDueSoon || wasDueSoon(lastTimeToStation)) &&
    !withinGracePeriod(lastSeenAt, input.now)
  ) {
    return {
      ghostStatus: "suspectedGhost",
      ghostReason:
        "Prediction disappeared while due soon and has not reappeared across multiple refreshes",
      lastSeenAt,
      missedRefreshCount,
      isSuspectedGhost: true,
    };
  }

  if (
    missedRefreshCount >= GHOST_BUS_THRESHOLDS.DISAPPEARED_REFRESH_THRESHOLD
  ) {
    return {
      ghostStatus: "disappeared",
      ghostReason: "Prediction disappeared from the TfL feed",
      lastSeenAt,
      missedRefreshCount,
      isSuspectedGhost: false,
    };
  }

  if (missedRefreshCount >= GHOST_BUS_THRESHOLDS.MISSING_REFRESH_THRESHOLD) {
    return {
      ghostStatus: "missingLatest",
      ghostReason: "Missing from latest TfL feed",
      lastSeenAt,
      missedRefreshCount,
      isSuspectedGhost: false,
    };
  }

  return {
    ghostStatus: "normal",
    lastSeenAt,
    missedRefreshCount,
    isSuspectedGhost: false,
  };
}

export function ghostStatusLabel(status: GhostStatus): string {
  switch (status) {
    case "missingLatest":
      return "Missing from latest TfL feed";
    case "disappeared":
      return "Prediction disappeared";
    case "suspectedGhost":
      return "Possible ghost";
    case "reappeared":
      return "Reappeared";
    case "stale":
      return "TfL data may be stale";
    default:
      return "Normal";
  }
}

export function countGhostStatuses(
  vehicles: Array<{
    ghostStatus: GhostStatus;
    isScheduledGhostCandidate?: boolean;
  }>,
): {
  possibleGhostCount: number;
  predictionDisappearedCount: number;
  missingLatestCount: number;
  reappearedCount: number;
} {
  let possibleGhostCount = 0;
  let predictionDisappearedCount = 0;
  let missingLatestCount = 0;
  let reappearedCount = 0;

  for (const vehicle of vehicles) {
    if (vehicle.isScheduledGhostCandidate) {
      possibleGhostCount += 1;
      continue;
    }

    switch (vehicle.ghostStatus) {
      case "suspectedGhost":
        possibleGhostCount += 1;
        break;
      case "disappeared":
        predictionDisappearedCount += 1;
        break;
      case "missingLatest":
        missingLatestCount += 1;
        break;
      case "reappeared":
        reappearedCount += 1;
        break;
      default:
        break;
    }
  }

  return {
    possibleGhostCount,
    predictionDisappearedCount,
    missingLatestCount,
    reappearedCount,
  };
}

export function enrichPredictionTrackingState(
  previous: PredictionTrackingState | undefined,
  prediction: NormalizedVehiclePrediction,
  refreshedAt: number,
  wasMissing: boolean,
  position?: { progress: number; x: number; y: number },
): PredictionTrackingState {
  return {
    key: prediction.vehicleId ?? prediction.id,
    vehicleId: prediction.vehicleId ?? prediction.id,
    missingRefreshCount: 0,
    lastSeenAt: refreshedAt,
    justReappeared: wasMissing,
    lastTimeToStation: prediction.timeToStation,
    wasDueSoon: wasDueSoon(prediction.timeToStation),
    reappearedAt: wasMissing ? refreshedAt : previous?.reappearedAt,
    lastPrediction: prediction,
    lastProgress: position?.progress ?? previous?.lastProgress,
    lastX: position?.x ?? previous?.lastX,
    lastY: position?.y ?? previous?.lastY,
  };
}

export function enrichMissingPredictionTrackingState(
  previous: PredictionTrackingState,
): PredictionTrackingState {
  return {
    ...previous,
    missingRefreshCount: previous.missingRefreshCount + 1,
    justReappeared: false,
    wasDueSoon:
      previous.wasDueSoon || wasDueSoon(previous.lastTimeToStation),
  };
}
