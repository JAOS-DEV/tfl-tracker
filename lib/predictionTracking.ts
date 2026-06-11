import { SERVICE_INTELLIGENCE_THRESHOLDS } from "@/lib/constants";
import {
  enrichMissingPredictionTrackingState,
  enrichPredictionTrackingState,
} from "@/lib/ghostBusDetection";
import type {
  NormalizedVehiclePrediction,
  PredictionConfidence,
  PredictionTrackingState,
} from "@/lib/tfl/types";

export function getPredictionKey(
  prediction: NormalizedVehiclePrediction,
): string {
  return prediction.vehicleId ?? prediction.id;
}

export function buildPredictionSnapshot(
  predictions: NormalizedVehiclePrediction[],
): Set<string> {
  return new Set(predictions.map(getPredictionKey));
}

export interface PredictionTrackingUpdate {
  states: Map<string, PredictionTrackingState>;
  disappeared: string[];
  reappeared: string[];
}

export function updatePredictionTracking(
  previousStates: Map<string, PredictionTrackingState>,
  predictions: NormalizedVehiclePrediction[],
  refreshedAt: number,
): PredictionTrackingUpdate {
  const currentKeys = buildPredictionSnapshot(predictions);
  const nextStates = new Map<string, PredictionTrackingState>();
  const disappeared: string[] = [];
  const reappeared: string[] = [];

  for (const prediction of predictions) {
    const key = getPredictionKey(prediction);
    const previous = previousStates.get(key);
    const wasMissing = (previous?.missingRefreshCount ?? 0) > 0;

    if (wasMissing) {
      reappeared.push(key);
    }

    nextStates.set(key, {
      ...enrichPredictionTrackingState(
        previous,
        prediction,
        refreshedAt,
        wasMissing,
      ),
      key,
    });
  }

  for (const [key, previous] of previousStates.entries()) {
    if (currentKeys.has(key)) {
      continue;
    }

    disappeared.push(key);
    nextStates.set(key, enrichMissingPredictionTrackingState(previous));
  }

  return { states: nextStates, disappeared, reappeared };
}

export function isPredictionDataStale(
  dataUpdatedAt: number,
  now: number,
): boolean {
  if (!dataUpdatedAt) {
    return true;
  }

  const ageSeconds = (now - dataUpdatedAt) / 1000;
  return ageSeconds > SERVICE_INTELLIGENCE_THRESHOLDS.STALE_DATA_THRESHOLD_SECONDS;
}

export function resolvePredictionConfidence(
  state: PredictionTrackingState | undefined,
  dataUpdatedAt: number,
  now: number,
): PredictionConfidence {
  if (state?.justReappeared) {
    return "reappeared";
  }

  if (!state || state.missingRefreshCount === 0) {
    return isPredictionDataStale(dataUpdatedAt, now) ? "stale" : "normal";
  }

  if (
    state.missingRefreshCount >=
    SERVICE_INTELLIGENCE_THRESHOLDS.PREDICTION_DISAPPEARED_REFRESH_COUNT
  ) {
    return "disappeared";
  }

  return "missing";
}

export function predictionConfidenceLabel(
  confidence: PredictionConfidence,
): string {
  switch (confidence) {
    case "normal":
      return "Normal";
    case "stale":
      return "Stale";
    case "missing":
      return "Missing from latest refresh";
    case "disappeared":
      return "Prediction disappeared";
    case "reappeared":
      return "Reappeared";
    default:
      return "Normal";
  }
}

export function countPredictionConfidenceStates(
  states: Map<string, PredictionTrackingState>,
  dataUpdatedAt: number,
  now: number,
): {
  stale: number;
  disappeared: number;
  missing: number;
  reappeared: number;
} {
  let stale = 0;
  let disappeared = 0;
  let missing = 0;
  let reappeared = 0;

  for (const state of states.values()) {
    const confidence = resolvePredictionConfidence(state, dataUpdatedAt, now);
    if (confidence === "stale") {
      stale += 1;
    } else if (confidence === "disappeared") {
      disappeared += 1;
    } else if (confidence === "missing") {
      missing += 1;
    } else if (confidence === "reappeared") {
      reappeared += 1;
    }
  }

  if (isPredictionDataStale(dataUpdatedAt, now)) {
    stale = Math.max(stale, states.size);
  }

  return { stale, disappeared, missing, reappeared };
}

export function detectDisappearedPredictions(
  previousSnapshot: Set<string>,
  currentSnapshot: Set<string>,
): string[] {
  const disappeared: string[] = [];
  for (const key of previousSnapshot) {
    if (!currentSnapshot.has(key)) {
      disappeared.push(key);
    }
  }
  return disappeared;
}

export function detectReappearedPredictions(
  previousStates: Map<string, PredictionTrackingState>,
  currentSnapshot: Set<string>,
): string[] {
  const reappeared: string[] = [];
  for (const key of currentSnapshot) {
    const previous = previousStates.get(key);
    if (previous && previous.missingRefreshCount > 0) {
      reappeared.push(key);
    }
  }
  return reappeared;
}
