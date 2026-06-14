import type { LoopLayoutConfig } from "@/lib/constants";
import { resolveGhostStatus } from "@/lib/ghostBusDetection";
import type { LiveIbusRunningDetail } from "@/lib/ibusLookup";
import { appendTrackedGhostVehicles } from "@/lib/ghostVehicles";
import { appendScheduledGhostVehicles } from "@/lib/scheduledGhostVehicles";
import { resolvePredictionConfidence } from "@/lib/predictionTracking";
import { buildVehiclePositions } from "@/lib/routePositioning";
import { matchVehicleToSchedule } from "@/lib/scheduleDeviation";
import { buildServiceHealthMetrics } from "@/lib/serviceIntelligence";
import { attachTerminusLayoverState } from "@/lib/terminusLayover";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
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
  includeScheduleMatching?: boolean;
  routeSchedule?: IbusRouteSchedule | null;
  showScheduleGhosts?: boolean;
  includeLowConfidenceScheduleGhosts?: boolean;
  liveBaseVersion?: string;
  liveIbusRunningDetails?: Map<string, LiveIbusRunningDetail>;
  collectScheduleGhostDiagnostics?: boolean;
  debugScheduleRunningNo?: string;
  debugScheduleRunningNos?: string[];
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

function attachLiveIbusRunningDetails(
  vehicles: EstimatedVehiclePosition[],
  details: Map<string, LiveIbusRunningDetail> | undefined,
): EstimatedVehiclePosition[] {
  if (!details || details.size === 0) {
    return vehicles;
  }

  return vehicles.map((vehicle) => {
    const detail = details.get(vehicle.vehicleId);
    if (!detail) {
      return vehicle;
    }

    return {
      ...vehicle,
      ...(detail.runningNo ? { ibusRunningNo: detail.runningNo } : {}),
      ...(detail.blockNo ? { ibusBlockNo: detail.blockNo } : {}),
      ...(detail.fleetNo ? { ibusFleetNo: detail.fleetNo } : {}),
    };
  });
}

function attachPredictionAndGhostState(
  vehicles: EstimatedVehiclePosition[],
  trackingStates: Map<string, PredictionTrackingState>,
  dataUpdatedAt: number,
  now: number,
): EstimatedVehiclePosition[] {
  return vehicles.map((vehicle) => {
    if (vehicle.isScheduledGhostCandidate) {
      return vehicle;
    }

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
  const positions = attachLiveIbusRunningDetails(
    buildVehiclePositions(
      input.predictions,
      input.route,
      input.layout,
    ),
    input.liveIbusRunningDetails,
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
      lastVehicleRegistration: vehicle.vehicleRegistration,
      lastIbusRunningNo: vehicle.ibusRunningNo,
      lastIbusBlockNo: vehicle.ibusBlockNo,
    });
  }

  const withSchedule = input.includeScheduleMatching === false
    ? positions
    : matchVehicleToSchedule(
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

  const scheduledGhostResult = appendScheduledGhostVehicles({
    routeId: input.routeId,
    route: input.route,
    layout: input.layout,
    vehicles: withGhosts,
    schedule: input.routeSchedule,
    now: input.now,
    dataUpdatedAt: input.dataUpdatedAt,
    liveBaseVersion: input.liveBaseVersion,
    livePredictionCount: input.predictions.length,
    showScheduleGhosts: input.showScheduleGhosts ?? true,
    includeLowConfidence: input.includeLowConfidenceScheduleGhosts ?? false,
    collectDiagnostics: input.collectScheduleGhostDiagnostics ?? false,
    debugRunningNo: input.debugScheduleRunningNo,
    debugRunningNos: input.debugScheduleRunningNos,
    liveEnrichmentComplete: true,
  });

  const vehicles = attachPredictionAndGhostState(
    attachTerminusLayoverState(
      scheduledGhostResult.vehicles,
      input.route,
      input.layout,
    ),
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
    scheduleGhostDiagnostics:
      scheduledGhostResult.diagnostics.length > 0
        ? scheduledGhostResult.diagnostics
        : undefined,
    ghostComparisonSummary: scheduledGhostResult.ghostComparisonSummary,
    ghostRunDiagnostics: scheduledGhostResult.ghostRunDiagnostics,
  };
}
