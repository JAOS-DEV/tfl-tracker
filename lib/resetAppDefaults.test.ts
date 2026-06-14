import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULT_DISPLAY_SETTINGS } from "@/lib/displaySettings";
import { loadAllSnapshots } from "@/lib/localRouteHistory";
import { resetAppToDefaults } from "@/lib/resetAppDefaults";
import { STORAGE_KEYS, readJsonStorage } from "@/lib/storage";

describe("resetAppToDefaults", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("clears saved routes, favourites, alerts, settings, and performance history", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.activeRoutes,
      JSON.stringify([{ routeId: "337", routeName: "337", addedAt: 1 }]),
    );
    window.localStorage.setItem(
      STORAGE_KEYS.recentRoutes,
      JSON.stringify([{ routeId: "22", routeName: "22", addedAt: 2 }]),
    );
    window.localStorage.setItem(
      STORAGE_KEYS.favouriteRoutes,
      JSON.stringify([{ routeId: "37", routeName: "37", favouritedAt: 3 }]),
    );
    window.localStorage.setItem(
      STORAGE_KEYS.favouriteStops,
      JSON.stringify([
        {
          stopPointId: "490000001A",
          name: "Stop A",
          routesServed: ["37"],
          favouritedAt: 4,
        },
      ]),
    );
    window.localStorage.setItem(
      STORAGE_KEYS.routeAlertPreferences,
      JSON.stringify({ "337": { warnBunching: false } }),
    );
    window.localStorage.setItem(
      STORAGE_KEYS.displaySettings,
      JSON.stringify({
        ...DEFAULT_DISPLAY_SETTINGS,
        showAdvancedDiagnostics: true,
      }),
    );
    window.localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify("dark"));
    window.localStorage.setItem(
      STORAGE_KEYS.routeHistory,
      JSON.stringify([
        {
          id: "snap-1",
          timestamp: Date.now(),
          routeId: "337",
          routeName: "337",
          liveVehicleCount: 2,
          healthScore: 80,
          healthLabel: "Good",
          averageGapMinutes: 5,
          largestGapMinutes: 8,
          smallestGapMinutes: 3,
          bunchingClusterCount: 0,
          largeGapCount: 0,
          missingFromRefreshCount: 0,
          disappearedPredictionCount: 0,
          isDataStale: false,
          outbound: {
            liveVehicleCount: 1,
            largestGapMinutes: 8,
            bunchingClusterCount: 0,
            largeGapCount: 0,
          },
          inbound: {
            liveVehicleCount: 1,
            largestGapMinutes: 6,
            bunchingClusterCount: 0,
            largeGapCount: 0,
          },
        },
      ]),
    );

    resetAppToDefaults();

    expect(readJsonStorage(STORAGE_KEYS.activeRoutes, [])).toEqual([]);
    expect(readJsonStorage(STORAGE_KEYS.recentRoutes, [])).toEqual([]);
    expect(readJsonStorage(STORAGE_KEYS.favouriteRoutes, [])).toEqual([]);
    expect(readJsonStorage(STORAGE_KEYS.favouriteStops, [])).toEqual([]);
    expect(readJsonStorage(STORAGE_KEYS.routeAlertPreferences, {})).toEqual({});
    expect(readJsonStorage(STORAGE_KEYS.displaySettings, DEFAULT_DISPLAY_SETTINGS))
      .toEqual(DEFAULT_DISPLAY_SETTINGS);
    expect(readJsonStorage(STORAGE_KEYS.theme, "system")).toBe("system");
    expect(loadAllSnapshots()).toEqual([]);
  });
});
