import { resolveGhostStatus } from "@/lib/ghostBusDetection";
import type {
  EstimatedVehiclePosition,
  PredictionTrackingState,
} from "@/lib/tfl/types";

export function appendTrackedGhostVehicles(
  vehicles: EstimatedVehiclePosition[],
  trackingStates: Map<string, PredictionTrackingState>,
  dataUpdatedAt: number,
  now: number,
): EstimatedVehiclePosition[] {
  const liveIds = new Set(vehicles.map((vehicle) => vehicle.vehicleId));
  const ghostVehicles: EstimatedVehiclePosition[] = [];

  for (const state of trackingStates.values()) {
    if (liveIds.has(state.vehicleId) || state.missingRefreshCount === 0) {
      continue;
    }

    const prediction = state.lastPrediction;
    if (!prediction || state.lastX === undefined || state.lastY === undefined) {
      continue;
    }

    const ghost = resolveGhostStatus({
      state,
      dataUpdatedAt,
      now,
      lastTimeToStation: state.lastTimeToStation,
    });

    if (
      ghost.ghostStatus !== "missingLatest" &&
      ghost.ghostStatus !== "disappeared" &&
      ghost.ghostStatus !== "suspectedGhost"
    ) {
      continue;
    }

    ghostVehicles.push({
      vehicleId: state.vehicleId,
      routeNumber: prediction.routeNumber,
      direction: prediction.direction,
      destinationName: prediction.destinationName,
      currentLocation: prediction.currentLocation,
      expectedArrival: prediction.expectedArrival,
      timeToStation: prediction.timeToStation,
      nextPrediction: prediction,
      nextStop: null,
      stopIndex: -1,
      progress: state.lastProgress ?? 0.5,
      x: state.lastX,
      y: state.lastY,
      matched: false,
      adherence: "onTime",
      scheduleDeviationMinutes: null,
      scheduleStatus: "unknown",
      scheduleStatusLabel: "Schedule ?",
      scheduleMatchConfidence: "unknown",
      matchedScheduledTime: null,
      matchedStopName: null,
      scheduleDataAvailable: false,
      scheduleExplanation: "Schedule match uncertain",
      ghostStatus: ghost.ghostStatus,
      ghostReason: ghost.ghostReason,
      lastSeenAt: ghost.lastSeenAt,
      missedRefreshCount: ghost.missedRefreshCount,
      reappearedAt: ghost.reappearedAt,
      isSuspectedGhost: ghost.isSuspectedGhost,
    });
  }

  return [...vehicles, ...ghostVehicles];
}
