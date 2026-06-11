"use client";

import { useMemo } from "react";
import {
  getPredictionKey,
  resolvePredictionConfidence,
  updatePredictionTracking,
} from "@/lib/predictionTracking";
import type {
  NormalizedVehiclePrediction,
  PredictionConfidence,
  PredictionTrackingState,
} from "@/lib/tfl/types";

interface UsePredictionTrackingResult {
  states: Map<string, PredictionTrackingState>;
  getConfidence: (vehicleId: string, now: number) => PredictionConfidence;
  getConfidenceForPrediction: (
    prediction: NormalizedVehiclePrediction,
    now: number,
  ) => PredictionConfidence;
}

const routeTrackingStores = new Map<string, Map<string, PredictionTrackingState>>();
const lastProcessedAtByRoute = new Map<string, number>();

function getRouteTrackingStore(
  routeId: string,
): Map<string, PredictionTrackingState> {
  const existing = routeTrackingStores.get(routeId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, PredictionTrackingState>();
  routeTrackingStores.set(routeId, created);
  return created;
}

export function resetRouteTrackingStore(routeId: string): void {
  routeTrackingStores.delete(routeId);
  lastProcessedAtByRoute.delete(routeId);
}

function resolveRouteTrackingStates(
  routeId: string,
  predictions: NormalizedVehiclePrediction[],
  dataUpdatedAt: number,
): Map<string, PredictionTrackingState> {
  if (!dataUpdatedAt) {
    return getRouteTrackingStore(routeId);
  }

  const lastProcessed = lastProcessedAtByRoute.get(routeId) ?? 0;
  if (dataUpdatedAt > lastProcessed) {
    lastProcessedAtByRoute.set(routeId, dataUpdatedAt);
    const previous = getRouteTrackingStore(routeId);
    const update = updatePredictionTracking(
      previous,
      predictions,
      dataUpdatedAt,
    );
    routeTrackingStores.set(routeId, update.states);
    return update.states;
  }

  return getRouteTrackingStore(routeId);
}

export function usePredictionTracking(
  routeId: string,
  predictions: NormalizedVehiclePrediction[],
  dataUpdatedAt: number,
): UsePredictionTrackingResult {
  const states = useMemo(
    () => resolveRouteTrackingStates(routeId, predictions, dataUpdatedAt),
    [routeId, predictions, dataUpdatedAt],
  );

  return useMemo(
    () => ({
      states,
      getConfidence: (vehicleId: string, now: number) => {
        const state = states.get(vehicleId);
        return resolvePredictionConfidence(state, dataUpdatedAt, now);
      },
      getConfidenceForPrediction: (
        prediction: NormalizedVehiclePrediction,
        now: number,
      ) => {
        const key = getPredictionKey(prediction);
        const state = states.get(key);
        return resolvePredictionConfidence(state, dataUpdatedAt, now);
      },
    }),
    [states, dataUpdatedAt],
  );
}
