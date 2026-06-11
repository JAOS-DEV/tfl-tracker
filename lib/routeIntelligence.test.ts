import { describe, expect, it } from "vitest";
import {
  buildRouteIntelligence,
  toRouteDashboardSummary,
} from "@/lib/routeIntelligence";
import { buildServiceHealthMetrics } from "@/lib/serviceIntelligence";
import { LOOP_LAYOUT } from "@/lib/constants";
import type {
  NormalizedRoute,
  NormalizedVehiclePrediction,
  PredictionTrackingState,
  ServiceHealthMetrics,
} from "@/lib/tfl/types";

const sampleRoute: NormalizedRoute = {
  routeId: "337",
  routeName: "337",
  outbound: [
    {
      id: "1",
      name: "Stop A",
      naptanId: "490000001A",
      isTimingPoint: false,
    },
    {
      id: "2",
      name: "Stop B",
      naptanId: "490000002B",
      isTimingPoint: false,
    },
  ],
  inbound: [
    {
      id: "3",
      name: "Stop C",
      naptanId: "490000003C",
      isTimingPoint: false,
    },
  ],
};

const basePrediction: NormalizedVehiclePrediction = {
  id: "pred-1",
  routeId: "337",
  routeNumber: "337",
  naptanId: "490000001A",
  stopName: "Stop A",
  destinationName: "Richmond",
  direction: "outbound",
  timeToStation: 180,
  expectedArrival: "2026-06-11T12:00:00Z",
  vehicleId: "BUS1",
};

function buildMetrics(
  overrides: Partial<ServiceHealthMetrics> = {},
): ServiceHealthMetrics {
  return {
    liveVehicleCount: 4,
    averageGapMinutes: 6,
    largestGapMinutes: 14,
    smallestGapMinutes: 2,
    bunchingClusterCount: 1,
    largeGapCount: 1,
    stalePredictionCount: 0,
    disappearedPredictionCount: 0,
    missingFromRefreshCount: 0,
    isDataStale: false,
    healthScore: 82,
    healthLabel: "Some gaps",
    estimatedLateCount: 0,
    estimatedEarlyCount: 0,
    estimatedOnTimeCount: 0,
    unknownScheduleMatchCount: 0,
    averageScheduleDeviationMinutes: null,
    possibleGhostCount: 0,
    predictionDisappearedCount: 0,
    missingLatestCount: 0,
    reappearedCount: 0,
    outbound: {
      direction: "outbound",
      liveVehicleCount: 2,
      averageGapMinutes: 6,
      largestGapMinutes: 14,
      smallestGapMinutes: 2,
      bunchingClusterCount: 1,
      largeGapCount: 1,
    },
    inbound: {
      direction: "inbound",
      liveVehicleCount: 2,
      averageGapMinutes: 8,
      largestGapMinutes: 10,
      smallestGapMinutes: 4,
      bunchingClusterCount: 0,
      largeGapCount: 0,
    },
    ...overrides,
  };
}

describe("toRouteDashboardSummary", () => {
  it("maps full service metrics to a compact dashboard summary", () => {
    const summary = toRouteDashboardSummary("337", buildMetrics());

    expect(summary).toEqual({
      routeId: "337",
      healthScore: 82,
      healthLabel: "Some gaps",
      liveVehicleCount: 4,
      largestGapMinutes: 14,
      largeGapCount: 1,
      bunchingClusterCount: 1,
      isDataStale: false,
      disappearedPredictionCount: 0,
      missingFromRefreshCount: 0,
      stalePredictionCount: 0,
      estimatedLateCount: 0,
      estimatedEarlyCount: 0,
      estimatedOnTimeCount: 0,
      unknownScheduleMatchCount: 0,
      possibleGhostCount: 0,
      predictionDisappearedCount: 0,
      missingLatestCount: 0,
    });
  });
});

describe("buildRouteIntelligence", () => {
  it("builds vehicles, metrics, and dashboard summary from the same inputs", () => {
    const now = Date.now();
    const dataUpdatedAt = now;
    const trackingStates = new Map<string, PredictionTrackingState>();

    const result = buildRouteIntelligence({
      routeId: "337",
      route: sampleRoute,
      predictions: [
        basePrediction,
        {
          ...basePrediction,
          id: "pred-2",
          vehicleId: "BUS2",
          naptanId: "490000002B",
          stopName: "Stop B",
          expectedArrival: "2026-06-11T12:20:00Z",
        },
      ],
      layout: LOOP_LAYOUT,
      dataUpdatedAt,
      now,
      trackingStates,
    });

    expect(result.vehicles).toHaveLength(2);
    expect(result.metrics.liveVehicleCount).toBe(2);
    expect(result.dashboardSummary.liveVehicleCount).toBe(
      result.metrics.liveVehicleCount,
    );
    expect(result.dashboardSummary.healthScore).toBe(result.metrics.healthScore);
    expect(result.dashboardSummary.largeGapCount).toBe(
      result.metrics.largeGapCount,
    );
  });

  it("matches direct service health metrics when tracking state is shared", () => {
    const now = Date.now();
    const trackingStates = new Map<string, PredictionTrackingState>([
      [
        "BUS1",
        {
          key: "BUS1",
          vehicleId: "BUS1",
          missingRefreshCount: 2,
          lastSeenAt: now - 60_000,
          justReappeared: false,
          wasDueSoon: false,
        },
      ],
    ]);

    const result = buildRouteIntelligence({
      routeId: "337",
      route: sampleRoute,
      predictions: [basePrediction],
      layout: LOOP_LAYOUT,
      dataUpdatedAt: now - 120_000,
      now,
      trackingStates,
    });

    const directMetrics = buildServiceHealthMetrics(result.vehicles, {
      dataUpdatedAt: now - 120_000,
      now,
      trackingStates,
    });

    expect(result.metrics).toEqual(directMetrics);
    expect(result.dashboardSummary.disappearedPredictionCount).toBe(
      directMetrics.disappearedPredictionCount,
    );
    expect(result.dashboardSummary.isDataStale).toBe(directMetrics.isDataStale);
  });
});
