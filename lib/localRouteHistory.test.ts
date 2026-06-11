import { describe, expect, it } from "vitest";
import {
  calculateDailyStats,
  createSnapshotFromIntelligence,
  exportSnapshotsAsCsv,
  exportSnapshotsAsJson,
  getSnapshotsForRoute,
  pruneSnapshots,
  shouldSaveSnapshot,
  snapshotsHaveIdenticalMetrics,
} from "@/lib/localRouteHistory";
import type { RouteHistorySnapshot } from "@/lib/localRouteHistory";
import type {
  RouteIntelligenceResult,
  ServiceHealthMetrics,
} from "@/lib/tfl/types";

const baseMetrics: ServiceHealthMetrics = {
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
};

const intelligence: RouteIntelligenceResult = {
  vehicles: [],
  metrics: baseMetrics,
  dashboardSummary: {
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
  },
};

function snapshot(
  overrides: Partial<RouteHistorySnapshot> = {},
): RouteHistorySnapshot {
  return {
    ...createSnapshotFromIntelligence("337", "337", intelligence, 1_000),
    ...overrides,
  };
}

describe("createSnapshotFromIntelligence", () => {
  it("creates a compact snapshot from shared route intelligence", () => {
    const created = createSnapshotFromIntelligence(
      "337",
      "337",
      intelligence,
      1_700_000_000_000,
    );

    expect(created.routeId).toBe("337");
    expect(created.healthScore).toBe(82);
    expect(created.outbound.liveVehicleCount).toBe(2);
    expect(created.inbound.liveVehicleCount).toBe(2);
  });
});

describe("shouldSaveSnapshot", () => {
  it("allows the first snapshot for a route", () => {
    const candidate = snapshot({ timestamp: 10_000 });
    expect(shouldSaveSnapshot(candidate, null, 10_000)).toBe(true);
  });

  it("skips snapshots that are too close together", () => {
    const previous = snapshot({ timestamp: 10_000 });
    const candidate = snapshot({ timestamp: 15_000 });
    expect(shouldSaveSnapshot(candidate, previous, 15_000)).toBe(false);
  });

  it("skips identical metrics when the previous snapshot is recent", () => {
    const previous = snapshot({ timestamp: 10_000 });
    const candidate = snapshot({ timestamp: 40_000 });
    expect(snapshotsHaveIdenticalMetrics(previous, candidate)).toBe(true);
    expect(shouldSaveSnapshot(candidate, previous, 40_000)).toBe(false);
  });

  it("saves when metrics change even if recent", () => {
    const previous = snapshot({ timestamp: 10_000, healthScore: 90 });
    const candidate = snapshot({ timestamp: 40_000, healthScore: 70 });
    expect(shouldSaveSnapshot(candidate, previous, 40_000)).toBe(true);
  });
});

describe("pruneSnapshots", () => {
  it("removes snapshots older than 24 hours", () => {
    const now = 2_000_000;
    const snapshots = [
      snapshot({ id: "old", timestamp: now - 25 * 60 * 60 * 1000 }),
      snapshot({ id: "new", timestamp: now - 60_000 }),
    ];

    const pruned = pruneSnapshots(snapshots, now);
    expect(pruned).toHaveLength(1);
    expect(pruned[0]?.id).toBe("new");
  });

  it("enforces the maximum snapshot count", () => {
    const now = Date.now();
    const snapshots = Array.from({ length: 520 }, (_, index) =>
      snapshot({
        id: `snap-${index}`,
        timestamp: now - (520 - index) * 60_000,
      }),
    );

    const pruned = pruneSnapshots(snapshots, now);
    expect(pruned).toHaveLength(500);
    expect(pruned[0]?.id).toBe("snap-20");
  });
});

describe("calculateDailyStats", () => {
  it("summarizes health and gap events for today", () => {
    const reference = new Date("2026-06-11T18:00:00").getTime();
    const dayStart = new Date("2026-06-11T00:00:00").getTime();

    const stats = calculateDailyStats(
      [
        snapshot({
          timestamp: dayStart + 60_000,
          healthScore: 90,
          largestGapMinutes: 8,
          bunchingClusterCount: 1,
          largeGapCount: 0,
        }),
        snapshot({
          timestamp: dayStart + 120_000,
          healthScore: 70,
          largestGapMinutes: 18,
          bunchingClusterCount: 2,
          largeGapCount: 1,
        }),
      ],
      reference,
    );

    expect(stats.snapshotCount).toBe(2);
    expect(stats.bestHealthScore).toBe(90);
    expect(stats.worstHealthScore).toBe(70);
    expect(stats.averageHealthScore).toBe(80);
    expect(stats.worstLargestGapMinutes).toBe(18);
    expect(stats.totalBunchingEvents).toBe(3);
    expect(stats.totalLargeGapEvents).toBe(1);
  });
});

describe("snapshot cache", () => {
  it("returns stable array references when storage has not changed", () => {
    const first = getSnapshotsForRoute("337");
    const second = getSnapshotsForRoute("337");
    expect(first).toBe(second);
  });
});

describe("export formatting", () => {
  it("exports snapshots as JSON", () => {
    const exported = exportSnapshotsAsJson([snapshot()]);
    expect(JSON.parse(exported)).toHaveLength(1);
  });

  it("exports snapshots as CSV", () => {
    const exported = exportSnapshotsAsCsv([snapshot()]);
    expect(exported.split("\n")[0]).toContain("healthScore");
    expect(exported).toContain("337");
  });
});
