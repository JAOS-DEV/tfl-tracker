import { describe, expect, it } from "vitest";
import { buildServiceHealthSummary } from "@/lib/serviceHealthSummary";
import type { ServiceHealthMetrics } from "@/lib/tfl/types";

function createMetrics(
  overrides: Partial<ServiceHealthMetrics> = {},
): ServiceHealthMetrics {
  return {
    healthScore: 82,
    healthLabel: "Good",
    liveVehicleCount: 4,
    averageGapMinutes: 8,
    largestGapMinutes: 14,
    smallestGapMinutes: 3,
    bunchingClusterCount: 0,
    largeGapCount: 0,
    stalePredictionCount: 0,
    estimatedOnTimeCount: 2,
    estimatedLateCount: 2,
    estimatedEarlyCount: 0,
    unknownScheduleMatchCount: 1,
    averageScheduleDeviationMinutes: 2,
    possibleGhostCount: 1,
    predictionDisappearedCount: 0,
    missingLatestCount: 0,
    reappearedCount: 0,
    isDataStale: false,
    missingFromRefreshCount: 0,
    disappearedPredictionCount: 0,
    outbound: {
      direction: "outbound",
      liveVehicleCount: 2,
      averageGapMinutes: 8,
      largestGapMinutes: 14,
      smallestGapMinutes: 3,
      bunchingClusterCount: 0,
      largeGapCount: 0,
    },
    inbound: {
      direction: "inbound",
      liveVehicleCount: 2,
      averageGapMinutes: 7,
      largestGapMinutes: 10,
      smallestGapMinutes: 4,
      bunchingClusterCount: 0,
      largeGapCount: 0,
    },
    ...overrides,
  };
}

describe("buildServiceHealthSummary", () => {
  it("prioritizes compact at-a-glance chips", () => {
    const summary = buildServiceHealthSummary(createMetrics());

    expect(summary.chips[0]?.id).toBe("live");
    expect(summary.chips.some((chip) => chip.id === "health")).toBe(true);
    expect(summary.chips.some((chip) => chip.id === "live-count")).toBe(true);
    expect(summary.chips.some((chip) => chip.id === "late")).toBe(true);
    expect(summary.chips.some((chip) => chip.id === "ghost")).toBe(true);
    expect(summary.topWarning).toContain("ghost");
  });

  it("omits zero-count schedule chips", () => {
    const summary = buildServiceHealthSummary(
      createMetrics({
        estimatedLateCount: 0,
        estimatedEarlyCount: 0,
        possibleGhostCount: 0,
        largestGapMinutes: 6,
      }),
    );

    expect(summary.chips.some((chip) => chip.id === "late")).toBe(false);
    expect(summary.chips.some((chip) => chip.id === "ghost")).toBe(false);
  });
});
