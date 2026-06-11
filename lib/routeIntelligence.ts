import type { LoopLayoutConfig } from "@/lib/constants";
import { resolveGhostStatus } from "@/lib/ghostBusDetection";
import { appendTrackedGhostVehicles } from "@/lib/ghostVehicles";
import { resolvePredictionConfidence } from "@/lib/predictionTracking";
import { buildVehiclePositions } from "@/lib/routePositioning";
import { matchVehicleToSchedule } from "@/lib/scheduleDeviation";
import { buildServiceHealthMetrics } from "@/lib/serviceIntelligence";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedTimetable,
  NormalizedVehiclePrediction,
  PredictionTrackingState,
  RouteDashboardSummary,
  RouteDirection,
  RouteIntelligenceResult,
  ServiceHealthMetrics,
} from "@/lib/tfl/types";

export interface BuildRouteIntelligenceInput {
  routeId: string;
  route: NormalizedRoute;
  predictions: NormalizedVehiclePrediction[];
  layout: LoopLayoutConfig;
  dataUpdatedAt: number;
  now: number;
  trackingStates: Map<string, PredictionTrackingState>;
  timetables?: Partial<Record<RouteDirection, NormalizedTimetable | null>>;
}

export function toRouteDashboardSummary(
  routeId: string,
  metrics: ServiceHealthMetrics,
): RouteDashboardSummary {
  return {
    routeId,
    healthScore: metrics.healthScore,
    healthLabel: metrics.healthLabel,
    liveVehicleCount: metrics.liveVehicleCount,
    largestGapMinutes: metrics.largestGapMinutes,
    largeGapCount: metrics.largeGapCount,
    bunchingClusterCount: metrics.bunchingClusterCount,
    isDataStale: metrics.isDataStale,
    disappearedPredictionCount: metrics.disappearedPredictionCount,
    missingFromRefreshCount: metrics.missingFromRefreshCount,
    stalePredictionCount: metrics.stalePredictionCount,
    estimatedLateCount: metrics.estimatedLateCount,
    estimatedEarlyCount: metrics.estimatedEarlyCount,
    estimatedOnTimeCount: metrics.estimatedOnTimeCount,
    unknownScheduleMatchCount: metrics.unknownScheduleMatchCount,
    possibleGhostCount: metrics.possibleGhostCount,
    predictionDisappearedCount: metrics.predictionDisappearedCount,
    missingLatestCount: metrics.missingLatestCount,
  };
}

function attachPredictionAndGhostState(
  vehicles: EstimatedVehiclePosition[],
  trackingStates: Map<string, PredictionTrackingState>,
  dataUpdatedAt: number,
  now: number,
): EstimatedVehiclePosition[] {
  return vehicles.map((vehicle) => {
    const trackingState = trackingStates.get(vehicle.vehicleId);
    const ghost = resolveGhostStatus({
      state: trackingState,
      dataUpdatedAt,
      now,
      lastTimeToStation: vehicle.timeToStation,
    });

    return {
      ...vehicle,
      predictionConfidence: resolvePredictionConfidence(
        trackingState,
        dataUpdatedAt,
        now,
      ),
      ghostStatus: ghost.ghostStatus,
      ghostReason: ghost.ghostReason,
      lastSeenAt: ghost.lastSeenAt,
      missedRefreshCount: ghost.missedRefreshCount,
      reappearedAt: ghost.reappearedAt,
      isSuspectedGhost: ghost.isSuspectedGhost,
      adherence:
        vehicle.scheduleStatus === "late"
          ? "late"
          : vehicle.scheduleStatus === "early"
            ? "early"
            : "onTime",
    };
  });
}

export function buildRouteIntelligence(
  input: BuildRouteIntelligenceInput,
): RouteIntelligenceResult {
  const positions = buildVehiclePositions(
    input.predictions,
    input.route,
    input.layout,
  );

  const enrichedTracking = new Map(input.trackingStates);
  for (const vehicle of positions) {
    const state = enrichedTracking.get(vehicle.vehicleId);
    if (!state) {
      continue;
    }
    enrichedTracking.set(vehicle.vehicleId, {
      ...state,
      lastPrediction: vehicle.nextPrediction,
      lastProgress: vehicle.progress,
      lastX: vehicle.x,
      lastY: vehicle.y,
    });
  }

  const withSchedule = matchVehicleToSchedule(
    positions,
    input.timetables ?? {},
    input.predictions,
    input.route,
  );

  const withGhosts = appendTrackedGhostVehicles(
    withSchedule,
    enrichedTracking,
    input.dataUpdatedAt,
    input.now,
  );

  const vehicles = attachPredictionAndGhostState(
    withGhosts,
    enrichedTracking,
    input.dataUpdatedAt,
    input.now,
  );

  const metrics = buildServiceHealthMetrics(vehicles, {
    dataUpdatedAt: input.dataUpdatedAt,
    now: input.now,
    trackingStates: input.trackingStates,
  });

  return {
    vehicles,
    metrics,
    dashboardSummary: toRouteDashboardSummary(input.routeId, metrics),
  };
}
