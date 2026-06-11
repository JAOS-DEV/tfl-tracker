import { SERVICE_INTELLIGENCE_THRESHOLDS } from "@/lib/constants";
import {
  countPredictionConfidenceStates,
  isPredictionDataStale,
} from "@/lib/predictionTracking";
import type {
  BunchingCluster,
  DirectionIntelligence,
  EstimatedVehiclePosition,
  LargeGapSegment,
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
  return Math.max(0, Math.round(diff / 60000));
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
  thresholdMinutes = SERVICE_INTELLIGENCE_THRESHOLDS.BUNCHING_THRESHOLD_MINUTES,
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
  thresholdMinutes = SERVICE_INTELLIGENCE_THRESHOLDS.BUNCHING_THRESHOLD_MINUTES,
): boolean {
  return detectBunchingClusters(vehicles, thresholdMinutes).length > 0;
}

export function detectLargeGaps(
  vehicles: EstimatedVehiclePosition[],
  thresholdMinutes = SERVICE_INTELLIGENCE_THRESHOLDS.LARGE_GAP_THRESHOLD_MINUTES,
): LargeGapSegment[] {
  return calculateVehicleGaps(vehicles)
    .filter((gap) => gap.gapMinutes >= thresholdMinutes)
    .map((gap) => ({
      direction: gap.direction,
      fromProgress: gap.fromProgress,
      toProgress: gap.toProgress,
      gapMinutes: gap.gapMinutes,
      fromVehicleId: gap.fromVehicleId,
      toVehicleId: gap.toVehicleId,
    }));
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
  return {
    averageGapMinutes: Math.round(
      gapMinutes.reduce((sum, gap) => sum + gap, 0) / gapMinutes.length,
    ),
    largestGapMinutes: Math.max(...gapMinutes),
    smallestGapMinutes: Math.min(...gapMinutes),
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
  const largeGaps = detectLargeGaps(directionVehicles);

  return {
    direction,
    liveVehicleCount: directionVehicles.length,
    averageGapMinutes: gapSummary.averageGapMinutes,
    largestGapMinutes: gapSummary.largestGapMinutes,
    smallestGapMinutes: gapSummary.smallestGapMinutes,
    bunchingClusterCount: bunchingClusters.length,
    largeGapCount: largeGaps.length,
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
}

export function calculateServiceHealthScore(
  input: ServiceHealthScoreInput,
): number {
  let score = 100;

  score -= Math.min(input.largeGapCount * 15, 45);
  score -= Math.min(input.bunchingClusterCount * 10, 30);
  score -= Math.min(input.disappearedPredictionCount * 5, 20);
  score -= Math.min(input.missingFromRefreshCount * 3, 12);

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
  const largeGaps = detectLargeGaps(vehicles);
  const confidenceCounts = countPredictionConfidenceStates(
    options.trackingStates,
    options.dataUpdatedAt,
    options.now,
  );
  const isDataStale = isPredictionDataStale(
    options.dataUpdatedAt,
    options.now,
  );

  const healthScore = calculateServiceHealthScore({
    liveVehicleCount: vehicles.length,
    largeGapCount: largeGaps.length,
    bunchingClusterCount: bunchingClusters.length,
    isDataStale,
    disappearedPredictionCount: confidenceCounts.disappeared,
    missingFromRefreshCount: confidenceCounts.missing,
  });

  return {
    liveVehicleCount: vehicles.length,
    averageGapMinutes: gapSummary.averageGapMinutes,
    largestGapMinutes: gapSummary.largestGapMinutes,
    smallestGapMinutes: gapSummary.smallestGapMinutes,
    bunchingClusterCount: bunchingClusters.length,
    largeGapCount: largeGaps.length,
    stalePredictionCount: confidenceCounts.stale,
    disappearedPredictionCount: confidenceCounts.disappeared,
    missingFromRefreshCount: confidenceCounts.missing,
    isDataStale,
    healthScore,
    healthLabel: getServiceHealthLabel(healthScore),
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

  if (metrics.largeGapCount > 0) {
    badges.push({
      id: "large-gap",
      label:
        metrics.largeGapCount === 1
          ? "Large predicted gap"
          : `${metrics.largeGapCount} large predicted gaps`,
      tone: "warning",
    });
  }

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

  return badges;
}

export function analyzeStopPredictions(
  routePredictions: NormalizedVehiclePrediction[],
): {
  hasPossibleBunching: boolean;
  hasLargeGap: boolean;
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
  let hasLargeGap = false;

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

    if (
      gapMinutes >= SERVICE_INTELLIGENCE_THRESHOLDS.LARGE_GAP_THRESHOLD_MINUTES
    ) {
      hasLargeGap = true;
    }
  }

  return { hasPossibleBunching, hasLargeGap, sortedPredictions };
}
