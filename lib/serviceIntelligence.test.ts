import { describe, expect, it } from "vitest";
import {
  buildServiceHealthMetrics,
  calculateServiceHealthScore,
  calculateVehicleGaps,
  detectBunching,
  detectBunchingClusters,
  detectLargeGaps,
  getServiceHealthLabel,
} from "@/lib/serviceIntelligence";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

function vehicle(
  overrides: Partial<EstimatedVehiclePosition> & {
    vehicleId: string;
    progress: number;
    expectedArrival: string;
  },
): EstimatedVehiclePosition {
  return {
    routeNumber: "337",
    direction: "outbound",
    destinationName: "Richmond",
    timeToStation: 180,
    stopIndex: 2,
    x: 100,
    y: 200,
    matched: true,
    adherence: "onTime",
    nextPrediction: {
      id: overrides.vehicleId,
      routeId: "337",
      routeNumber: "337",
      naptanId: "490000001A",
      stopName: "Stop A",
      destinationName: "Richmond",
      direction: "outbound",
      timeToStation: 180,
      expectedArrival: overrides.expectedArrival,
      vehicleId: overrides.vehicleId,
    },
    nextStop: null,
    scheduleDeviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: null,
    matchedStopName: null,
    scheduleDataAvailable: false,
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    ...overrides,
  };
}

describe("calculateVehicleGaps", () => {
  it("calculates gaps between vehicles in the same direction", () => {
    const gaps = calculateVehicleGaps([
      vehicle({
        vehicleId: "BUS1",
        progress: 0.1,
        expectedArrival: "2026-06-11T12:00:00Z",
      }),
      vehicle({
        vehicleId: "BUS2",
        progress: 0.2,
        expectedArrival: "2026-06-11T12:08:00Z",
      }),
    ]);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.gapMinutes).toBe(8);
  });

  it("keeps sub-minute gaps as decimals", () => {
    const gaps = calculateVehicleGaps([
      vehicle({
        vehicleId: "BUS1",
        progress: 0.1,
        expectedArrival: "2026-06-11T12:00:00Z",
      }),
      vehicle({
        vehicleId: "BUS2",
        progress: 0.2,
        expectedArrival: "2026-06-11T12:00:45Z",
      }),
    ]);

    expect(gaps[0]?.gapMinutes).toBe(0.75);
  });

  it("uses absolute ETA separation when route progress and arrival times differ", () => {
    const gaps = calculateVehicleGaps([
      vehicle({
        vehicleId: "BUS1",
        progress: 0.1,
        expectedArrival: "2026-06-11T12:08:00Z",
      }),
      vehicle({
        vehicleId: "BUS2",
        progress: 0.2,
        expectedArrival: "2026-06-11T12:00:00Z",
      }),
    ]);

    expect(gaps[0]?.gapMinutes).toBe(8);
  });
});

describe("bunching and large gap detection", () => {
  it("detects possible bunching for nearby vehicles within threshold", () => {
    const vehicles = [
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        stopIndex: 2,
        expectedArrival: "2026-06-11T12:00:00Z",
      }),
      vehicle({
        vehicleId: "BUS2",
        progress: 0.22,
        stopIndex: 3,
        expectedArrival: "2026-06-11T12:01:00Z",
      }),
    ];

    expect(detectBunching(vehicles)).toBe(true);
    expect(detectBunchingClusters(vehicles)).toHaveLength(1);
  });

  it("detects large predicted gaps", () => {
    const vehicles = [
      vehicle({
        vehicleId: "BUS1",
        progress: 0.1,
        expectedArrival: "2026-06-11T12:00:00Z",
      }),
      vehicle({
        vehicleId: "BUS2",
        progress: 0.5,
        expectedArrival: "2026-06-11T12:20:00Z",
      }),
    ];

    expect(detectLargeGaps(vehicles)).toHaveLength(1);
    expect(detectLargeGaps(vehicles)[0]?.gapMinutes).toBe(20);
  });

  it("detects large predicted gaps with sub-minute thresholds", () => {
    const vehicles = [
      vehicle({
        vehicleId: "BUS1",
        progress: 0.1,
        expectedArrival: "2026-06-11T12:00:00Z",
      }),
      vehicle({
        vehicleId: "BUS2",
        progress: 0.5,
        expectedArrival: "2026-06-11T12:00:45Z",
      }),
    ];

    expect(detectLargeGaps(vehicles, 0.5)).toHaveLength(1);
    expect(detectLargeGaps(vehicles, 1)).toHaveLength(0);
  });
});

describe("service health score", () => {
  it("returns strong score for healthy service", () => {
    const score = calculateServiceHealthScore({
      liveVehicleCount: 6,
      largeGapCount: 0,
      bunchingClusterCount: 0,
      isDataStale: false,
      disappearedPredictionCount: 0,
      missingFromRefreshCount: 0,
      possibleGhostCount: 0,
    });

    expect(score).toBeGreaterThanOrEqual(85);
    expect(getServiceHealthLabel(score)).toBe("Good service");
  });

  it("reduces score for gaps, bunching, and stale data", () => {
    const score = calculateServiceHealthScore({
      liveVehicleCount: 1,
      largeGapCount: 2,
      bunchingClusterCount: 2,
      isDataStale: true,
      disappearedPredictionCount: 2,
      missingFromRefreshCount: 1,
      possibleGhostCount: 1,
    });

    expect(score).toBeLessThan(65);
    expect(getServiceHealthLabel(score)).not.toBe("Good service");
  });

  it("builds route health metrics with direction breakdown", () => {
    const metrics = buildServiceHealthMetrics(
      [
        vehicle({
          vehicleId: "BUS1",
          progress: 0.1,
          direction: "outbound",
          expectedArrival: "2026-06-11T12:00:00Z",
        }),
        vehicle({
          vehicleId: "BUS2",
          progress: 0.5,
          direction: "inbound",
          expectedArrival: "2026-06-11T12:20:00Z",
        }),
      ],
      {
        dataUpdatedAt: Date.now(),
        now: Date.now(),
        trackingStates: new Map(),
      },
    );

    expect(metrics.liveVehicleCount).toBe(2);
    expect(metrics.outbound.liveVehicleCount).toBe(1);
    expect(metrics.inbound.liveVehicleCount).toBe(1);
    expect(metrics.healthScore).toBeGreaterThanOrEqual(0);
    expect(metrics.healthScore).toBeLessThanOrEqual(100);
  });
});
