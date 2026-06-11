import { describe, expect, it } from "vitest";
import { buildActiveRouteComparison } from "@/lib/activeRouteComparison";
import type { RouteDashboardSummary } from "@/lib/tfl/types";

function createSummary(
  routeId: string,
  overrides: Partial<RouteDashboardSummary> = {},
): RouteDashboardSummary {
  return {
    routeId,
    healthScore: 80,
    healthLabel: "Good",
    liveVehicleCount: 5,
    largestGapMinutes: 10,
    largeGapCount: 0,
    bunchingClusterCount: 0,
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
    ...overrides,
  };
}

describe("buildActiveRouteComparison", () => {
  it("returns null when fewer than two routes are active", () => {
    expect(buildActiveRouteComparison([createSummary("337")])).toBeNull();
  });

  it("picks the best active route and explains why", () => {
    const comparison = buildActiveRouteComparison([
      createSummary("337", {
        healthScore: 92,
        liveVehicleCount: 8,
        largestGapMinutes: 8,
      }),
      createSummary("220", {
        healthScore: 65,
        liveVehicleCount: 3,
        largestGapMinutes: 18,
        estimatedLateCount: 2,
      }),
    ]);

    expect(comparison?.bestRouteId).toBe("337");
    expect(comparison?.bestReason).toMatch(/health score/i);
    expect(comparison?.largestGapRouteId).toBe("220");
    expect(comparison?.entries).toHaveLength(2);
  });
});
