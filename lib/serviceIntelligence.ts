import { SERVICE_INTELLIGENCE_THRESHOLDS } from "@/lib/constants";
import { countGhostStatuses } from "@/lib/ghostBusDetection";
import { possibleGhostCountLabel } from "@/lib/ghostDisplay";
import {
  countPredictionConfidenceStates,
  isPredictionDataStale,
} from "@/lib/predictionTracking";
import { summarizeScheduleMatches } from "@/lib/scheduleDeviation";
import type {
  BunchingCluster,
  DirectionIntelligence,
  EstimatedVehiclePosition,
  NormalizedVehiclePrediction,
  PredictionTrackingState,
  RouteDirection,
  ServiceHealthMetrics,
  VehicleGap,
} from "@/lib/tfl/types";

function sortVehiclesByProgress(
  vehicles: EstimatedVehiclePosition[],
): EstimatedVehiclePosition[] {
  return [...vehicles].sort((a, b) => a.progress - b.progress);
}

function minutesBetweenArrivals(
  earlier: EstimatedVehiclePosition,
  later: EstimatedVehiclePosition,
): number {
  const diff =
    new Date(later.expectedArrival).getTime() -
    new Date(earlier.expectedArrival).getTime();
  return Math.abs(diff) / 60000;
}

function vehiclesForDirection(
  vehicles: EstimatedVehiclePosition[],
  direction: RouteDirection,
): EstimatedVehiclePosition[] {
  return sortVehiclesByProgress(
    vehicles.filter((vehicle) => vehicle.direction === direction),
  );
}

export function calculateVehicleGaps(
  vehicles: EstimatedVehiclePosition[],
): VehicleGap[] {
  const gaps: VehicleGap[] = [];
  const directions: RouteDirection[] = ["outbound", "inbound"];

  for (const direction of directions) {
    const directionVehicles = vehiclesForDirection(vehicles, direction);
    for (let index = 1; index < directionVehicles.length; index += 1) {
      const previous = directionVehicles[index - 1];
      const current = directionVehicles[index];
      if (!previous || !current) {
        continue;
      }

      gaps.push({
        fromVehicleId: previous.vehicleId,
        toVehicleId: current.vehicleId,
        gapMinutes: minutesBetweenArrivals(previous, current),
        direction,
        fromProgress: previous.progress,
        toProgress: current.progress,
      });
    }
  }

  return gaps;
}

function areVehiclesNearby(
  first: EstimatedVehiclePosition,
  second: EstimatedVehiclePosition,
): boolean {
  const stopDistance = Math.abs(first.stopIndex - second.stopIndex);
  const progressDistance = Math.abs(first.progress - second.progress);
  return (
    stopDistance <=
      SERVICE_INTELLIGENCE_THRESHOLDS.NEARBY_STOP_INDEX_THRESHOLD ||
    progressDistance <= 0.08
  );
}

export function detectBunchingClusters(
  vehicles: EstimatedVehiclePosition[],
  thresholdMinutes: number =
    SERVICE_INTELLIGENCE_THRESHOLDS.BUNCHING_THRESHOLD_MINUTES,
): BunchingCluster[] {
  const clusters: BunchingCluster[] = [];
  const directions: RouteDirection[] = ["outbound", "inbound"];

  for (const direction of directions) {
    const directionVehicles = vehiclesForDirection(vehicles, direction);
    let cluster: EstimatedVehiclePosition[] = [];

    const flushCluster = () => {
      if (cluster.length < 2) {
        cluster = [];
        return;
      }

      const centerProgress =
        cluster.reduce((sum, vehicle) => sum + vehicle.progress, 0) /
        cluster.length;
      const centerX =
        cluster.reduce((sum, vehicle) => sum + vehicle.x, 0) / cluster.length;
      const centerY =
        cluster.reduce((sum, vehicle) => sum + vehicle.y, 0) / cluster.length;

      clusters.push({
        direction,
        vehicleIds: cluster.map((vehicle) => vehicle.vehicleId),
        centerProgress,
        centerX,
        centerY,
      });
      cluster = [];
    };

    for (let index = 1; index < directionVehicles.length; index += 1) {
      const previous = directionVehicles[index - 1];
      const current = directionVehicles[index];
      if (!previous || !current) {
        continue;
      }

      const gapMinutes = minutesBetweenArrivals(previous, current);
      const isBunched =
        gapMinutes > 0 &&
        gapMinutes <= thresholdMinutes &&
        areVehiclesNearby(previous, current);

      if (isBunched) {
        if (cluster.length === 0) {
          cluster.push(previous);
        }
        cluster.push(current);
      } else {
        flushCluster();
      }
    }

    flushCluster();
  }

  return clusters;
}

export function detectBunching(
  vehicles: EstimatedVehiclePosition[],
  thresholdMinutes: number =
    SERVICE_INTELLIGENCE_THRESHOLDS.BUNCHING_THRESHOLD_MINUTES,
): boolean {
  return detectBunchingClusters(vehicles, thresholdMinutes).length > 0;
}

function summarizeGaps(gaps: VehicleGap[]): {
  averageGapMinutes: number | null;
  largestGapMinutes: number | null;
  smallestGapMinutes: number | null;
} {
  if (gaps.length === 0) {
    return {
      averageGapMinutes: null,
      largestGapMinutes: null,
      smallestGapMinutes: null,
    };
  }

  const gapMinutes = gaps.map((gap) => gap.gapMinutes);
  const roundGapMinutes = (value: number): number => Math.round(value * 10) / 10;

  return {
    averageGapMinutes: Math.round(
      gapMinutes.reduce((sum, gap) => sum + gap, 0) / gapMinutes.length,
    ),
    largestGapMinutes: roundGapMinutes(Math.max(...gapMinutes)),
    smallestGapMinutes: roundGapMinutes(Math.min(...gapMinutes)),
  };
}

export function calculateDirectionIntelligence(
  vehicles: EstimatedVehiclePosition[],
  direction: RouteDirection,
): DirectionIntelligence {
  const directionVehicles = vehiclesForDirection(vehicles, direction);
  const gaps = calculateVehicleGaps(directionVehicles);
  const gapSummary = summarizeGaps(gaps);
  const bunchingClusters = detectBunchingClusters(directionVehicles);

  return {
    direction,
    liveVehicleCount: directionVehicles.length,
    averageGapMinutes: gapSummary.averageGapMinutes,
    largestGapMinutes: gapSummary.largestGapMinutes,
    smallestGapMinutes: gapSummary.smallestGapMinutes,
    bunchingClusterCount: bunchingClusters.length,
    largeGapCount: 0,
  };
}

export function getServiceHealthLabel(score: number): string {
  if (score >= 85) {
    return "Good service";
  }
  if (score >= 65) {
    return "Some gaps";
  }
  if (score >= 40) {
    return "Disrupted pattern";
  }
  return "Poor service pattern";
}

export interface ServiceHealthScoreInput {
  liveVehicleCount: number;
  largeGapCount: number;
  bunchingClusterCount: number;
  isDataStale: boolean;
  disappearedPredictionCount: number;
  missingFromRefreshCount: number;
  possibleGhostCount: number;
}

export function calculateServiceHealthScore(
  input: ServiceHealthScoreInput,
): number {
  let score = 100;

  score -= Math.min(input.bunchingClusterCount * 10, 30);
  score -= Math.min(input.disappearedPredictionCount * 5, 20);
  score -= Math.min(input.missingFromRefreshCount * 3, 12);
  score -= Math.min(input.possibleGhostCount * 8, 24);

  if (input.liveVehicleCount === 0) {
    score -= 40;
  } else if (
    input.liveVehicleCount <
    SERVICE_INTELLIGENCE_THRESHOLDS.MIN_LIVE_VEHICLES_HEALTHY
  ) {
    score -= 20;
  }

  if (input.isDataStale) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export interface BuildServiceHealthOptions {
  dataUpdatedAt: number;
  now: number;
  trackingStates: Map<string, PredictionTrackingState>;
}

export function buildServiceHealthMetrics(
  vehicles: EstimatedVehiclePosition[],
  options: BuildServiceHealthOptions,
): ServiceHealthMetrics {
  const gaps = calculateVehicleGaps(vehicles);
  const gapSummary = summarizeGaps(gaps);
  const bunchingClusters = detectBunchingClusters(vehicles);
  const confidenceCounts = countPredictionConfidenceStates(
    options.trackingStates,
    options.dataUpdatedAt,
    options.now,
  );
  const isDataStale = isPredictionDataStale(
    options.dataUpdatedAt,
    options.now,
  );

  const ghostCounts = countGhostStatuses(vehicles);
  const scheduleSummary = summarizeScheduleMatches(vehicles);

  const healthScore = calculateServiceHealthScore({
    liveVehicleCount: vehicles.length,
    largeGapCount: 0,
    bunchingClusterCount: bunchingClusters.length,
    isDataStale,
    disappearedPredictionCount: confidenceCounts.disappeared,
    missingFromRefreshCount: confidenceCounts.missing,
    possibleGhostCount: ghostCounts.possibleGhostCount,
  });

  return {
    liveVehicleCount: vehicles.length,
    averageGapMinutes: gapSummary.averageGapMinutes,
    largestGapMinutes: gapSummary.largestGapMinutes,
    smallestGapMinutes: gapSummary.smallestGapMinutes,
    bunchingClusterCount: bunchingClusters.length,
    largeGapCount: 0,
    stalePredictionCount: confidenceCounts.stale,
    disappearedPredictionCount: confidenceCounts.disappeared,
    missingFromRefreshCount: confidenceCounts.missing,
    isDataStale,
    healthScore,
    healthLabel: getServiceHealthLabel(healthScore),
    estimatedLateCount: scheduleSummary.estimatedLateCount,
    estimatedEarlyCount: scheduleSummary.estimatedEarlyCount,
    estimatedOnTimeCount: scheduleSummary.estimatedOnTimeCount,
    unknownScheduleMatchCount: scheduleSummary.unknownScheduleMatchCount,
    averageScheduleDeviationMinutes:
      scheduleSummary.averageScheduleDeviationMinutes,
    possibleGhostCount: ghostCounts.possibleGhostCount,
    predictionDisappearedCount: ghostCounts.predictionDisappearedCount,
    missingLatestCount: ghostCounts.missingLatestCount,
    reappearedCount: ghostCounts.reappearedCount,
    outbound: calculateDirectionIntelligence(vehicles, "outbound"),
    inbound: calculateDirectionIntelligence(vehicles, "inbound"),
  };
}

export function buildServiceAlertBadges(
  metrics: ServiceHealthMetrics,
): Array<{ id: string; label: string; tone: "info" | "warning" | "neutral" | "success" | "danger" }> {
  const badges: Array<{
    id: string;
    label: string;
    tone: "info" | "warning" | "neutral" | "success" | "danger";
  }> = [];

  if (metrics.liveVehicleCount === 0) {
    badges.push({
      id: "no-buses",
      label: "No live vehicles detected",
      tone: "neutral",
    });
    return badges;
  }

  badges.push({
    id: "health",
    label: `${metrics.healthLabel} (${metrics.healthScore})`,
    tone:
      metrics.healthScore >= 85
        ? "success"
        : metrics.healthScore >= 65
          ? "info"
          : "warning",
  });

  badges.push({
    id: "live-count",
    label: `${metrics.liveVehicleCount} live`,
    tone: "info",
  });

  if (metrics.bunchingClusterCount > 0) {
    badges.push({
      id: "bunching",
      label:
        metrics.bunchingClusterCount === 1
          ? "Possible bunching"
          : `${metrics.bunchingClusterCount} possible bunching areas`,
      tone: "warning",
    });
  }

  if (metrics.isDataStale) {
    badges.push({
      id: "stale",
      label: "TfL data may be stale",
      tone: "warning",
    });
  }

  if (metrics.disappearedPredictionCount > 0) {
    badges.push({
      id: "disappeared",
      label: `${metrics.disappearedPredictionCount} prediction${metrics.disappearedPredictionCount === 1 ? "" : "s"} disappeared`,
      tone: "danger",
    });
  }

  if (metrics.possibleGhostCount > 0) {
    badges.push({
      id: "possible-ghost",
      label: possibleGhostCountLabel(metrics.possibleGhostCount),
      tone: "warning",
    });
  }

  if (metrics.estimatedLateCount > 0) {
    badges.push({
      id: "estimated-late",
      label:
        metrics.estimatedLateCount === 1
          ? "1 estimated late"
          : `${metrics.estimatedLateCount} estimated late`,
      tone: "warning",
    });
  }

  if (metrics.estimatedEarlyCount > 0) {
    badges.push({
      id: "estimated-early",
      label:
        metrics.estimatedEarlyCount === 1
          ? "1 estimated early"
          : `${metrics.estimatedEarlyCount} estimated early`,
      tone: "info",
    });
  }

  return badges;
}

export function analyzeStopPredictions(
  routePredictions: NormalizedVehiclePrediction[],
): {
  hasPossibleBunching: boolean;
  sortedPredictions: NormalizedVehiclePrediction[];
} {
  const sortedPredictions = [...routePredictions].sort((a, b) => {
    const timeDiff =
      new Date(a.expectedArrival).getTime() -
      new Date(b.expectedArrival).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.timeToStation - b.timeToStation;
  });

  let hasPossibleBunching = false;

  for (let index = 1; index < sortedPredictions.length; index += 1) {
    const previous = sortedPredictions[index - 1];
    const current = sortedPredictions[index];
    if (!previous || !current) {
      continue;
    }

    const gapMinutes = Math.max(
      0,
      Math.round(
        (new Date(current.expectedArrival).getTime() -
          new Date(previous.expectedArrival).getTime()) /
          60000,
      ),
    );

    if (
      gapMinutes > 0 &&
      gapMinutes <= SERVICE_INTELLIGENCE_THRESHOLDS.BUNCHING_THRESHOLD_MINUTES
    ) {
      hasPossibleBunching = true;
    }
  }

  return { hasPossibleBunching, sortedPredictions };
}
