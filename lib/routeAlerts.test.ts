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
  it("warns when the largest gap exceeds the user threshold", () => {
    const alerts = evaluateRouteAlerts(
      metrics({ largestGapMinutes: 15, largeGapCount: 1 }),
      createDefaultAlertPreferences("337"),
    );

    expect(alerts).toEqual([
      expect.objectContaining({
        id: "large-gap",
        label: "Large predicted gap",
      }),
    ]);
  });

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
  });

  it("respects disabled alert preferences", () => {
    const preferences = {
      ...createDefaultAlertPreferences("337"),
      warnBunching: false,
      warnStaleData: false,
      warnNoLiveBuses: false,
      warnLargeGap: false,
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
        warnLargeGap: true,
        largeGapMinutes: 12,
      }),
    );
  });

  it("gets and sets preferences per route", () => {
    const map = {};
    const prefs = createDefaultAlertPreferences("220");
    const next = setAlertPreferencesForRoute(map, {
      ...prefs,
      largeGapMinutes: 18,
    });

    expect(getAlertPreferencesForRoute(next, "220").largeGapMinutes).toBe(18);
    expect(getAlertPreferencesForRoute(next, "337").routeId).toBe("337");
  });
});

describe("formatAlertSummary", () => {
  it("joins alert labels for dashboard summaries", () => {
    expect(
      formatAlertSummary([
        { id: "a", label: "Large predicted gap", tone: "warning" },
        { id: "b", label: "Possible bunching", tone: "warning" },
      ]),
    ).toBe("Large predicted gap · Possible bunching");
  });
});
