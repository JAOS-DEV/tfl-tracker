import { describe, expect, it } from "vitest";
import {
  createDefaultAlertPreferences,
  evaluateRouteAlerts,
  formatAlertSummary,
  getAlertPreferencesForRoute,
  normalizeAlertPreferencesMap,
  setAlertPreferencesForRoute,
} from "@/lib/routeAlerts";
import type { ServiceHealthMetrics } from "@/lib/tfl/types";

function metrics(
  overrides: Partial<ServiceHealthMetrics> = {},
): ServiceHealthMetrics {
  return {
    liveVehicleCount: 4,
    averageGapMinutes: 6,
    largestGapMinutes: 8,
    smallestGapMinutes: 2,
    bunchingClusterCount: 0,
    largeGapCount: 0,
    stalePredictionCount: 0,
    disappearedPredictionCount: 0,
    missingFromRefreshCount: 0,
    isDataStale: false,
    estimatedLateCount: 0,
    estimatedEarlyCount: 0,
    estimatedOnTimeCount: 0,
    unknownScheduleMatchCount: 0,
    averageScheduleDeviationMinutes: null,
    possibleGhostCount: 0,
    predictionDisappearedCount: 0,
    missingLatestCount: 0,
    reappearedCount: 0,
    healthScore: 90,
    healthLabel: "Good",
    outbound: {
      direction: "outbound",
      liveVehicleCount: 2,
      averageGapMinutes: 6,
      largestGapMinutes: 8,
      smallestGapMinutes: 2,
      bunchingClusterCount: 0,
      largeGapCount: 0,
    },
    inbound: {
      direction: "inbound",
      liveVehicleCount: 2,
      averageGapMinutes: 6,
      largestGapMinutes: 8,
      smallestGapMinutes: 2,
      bunchingClusterCount: 0,
      largeGapCount: 0,
    },
    ...overrides,
  };
}

describe("evaluateRouteAlerts", () => {
  it("warns about bunching, stale data, and no live vehicles", () => {
    expect(
      evaluateRouteAlerts(
        metrics({ bunchingClusterCount: 1 }),
        createDefaultAlertPreferences("337"),
      ).map((alert) => alert.label),
    ).toContain("Possible bunching");

    expect(
      evaluateRouteAlerts(
        metrics({ isDataStale: true }),
        createDefaultAlertPreferences("337"),
      ).map((alert) => alert.label),
    ).toContain("TfL data may be stale");

    expect(
      evaluateRouteAlerts(
        metrics({ liveVehicleCount: 0 }),
        createDefaultAlertPreferences("337"),
      ),
    ).toEqual([
      expect.objectContaining({
        label: "No live vehicles detected",
      }),
    ]);

    expect(
      evaluateRouteAlerts(
        metrics({ possibleGhostCount: 1 }),
        createDefaultAlertPreferences("337"),
      ).map((alert) => alert.label),
    ).toContain("Possible ghost");
  });

  it("respects disabled alert preferences", () => {
    const preferences = {
      ...createDefaultAlertPreferences("337"),
      warnBunching: false,
      warnStaleData: false,
      warnNoLiveBuses: false,
    };

    expect(
      evaluateRouteAlerts(
        metrics({
          liveVehicleCount: 0,
          bunchingClusterCount: 2,
          isDataStale: true,
          largestGapMinutes: 20,
        }),
        preferences,
      ),
    ).toEqual([]);
  });
});

describe("alert preference storage helpers", () => {
  it("normalizes stored preferences with defaults", () => {
    expect(
      normalizeAlertPreferencesMap({
        "337": { routeId: "337", warnBunching: false },
      })["337"],
    ).toEqual(
      expect.objectContaining({
        routeId: "337",
        warnBunching: false,
      }),
    );
  });

  it("gets and sets preferences per route", () => {
    const map = {};
    const prefs = createDefaultAlertPreferences("220");
    const next = setAlertPreferencesForRoute(map, {
      ...prefs,
      estimatedLateMinutes: 6,
    });

    expect(getAlertPreferencesForRoute(next, "220").estimatedLateMinutes).toBe(6);
    expect(getAlertPreferencesForRoute(next, "337").routeId).toBe("337");
  });
});

describe("formatAlertSummary", () => {
  it("joins alert labels for dashboard summaries", () => {
    expect(
      formatAlertSummary([
        { id: "a", label: "Possible bunching", tone: "warning" },
        { id: "b", label: "TfL data may be stale", tone: "warning" },
      ]),
    ).toBe("Possible bunching · TfL data may be stale");
  });
});
