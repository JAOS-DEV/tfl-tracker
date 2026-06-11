import type { LoopLayoutConfig } from "@/lib/constants";
import { resolvePredictionConfidence } from "@/lib/predictionTracking";
import { buildVehiclePositions } from "@/lib/routePositioning";
import { buildServiceHealthMetrics } from "@/lib/serviceIntelligence";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedVehiclePrediction,
  PredictionTrackingState,
  RouteDashboardSummary,
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
  };
}

function attachPredictionConfidence(
  vehicles: EstimatedVehiclePosition[],
  trackingStates: Map<string, PredictionTrackingState>,
  dataUpdatedAt: number,
  now: number,
): EstimatedVehiclePosition[] {
  return vehicles.map((vehicle) => ({
    ...vehicle,
    predictionConfidence: resolvePredictionConfidence(
      trackingStates.get(vehicle.vehicleId),
      dataUpdatedAt,
      now,
    ),
  }));
}

export function buildRouteIntelligence(
  input: BuildRouteIntelligenceInput,
): RouteIntelligenceResult {
  const positions = buildVehiclePositions(
    input.predictions,
    input.route,
    input.layout,
  );
  const vehicles = attachPredictionConfidence(
    positions,
    input.trackingStates,
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
