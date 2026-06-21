import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  collectActiveVehicleCandidates,
  pickBestRouteIntelligence,
} from "@/lib/activeVehicleSearchIndex";
import type { ActiveRoute, RouteIntelligenceResult } from "@/lib/tfl/types";

function intelligenceWithRegistration(
  registration: string,
): RouteIntelligenceResult {
  return {
    vehicles: [
      {
        vehicleId: registration,
        vehicleRegistration: registration,
        routeNumber: "337",
        direction: "outbound",
        destinationName: "Clapham Junction",
        expectedArrival: "2026-06-14T12:00:00Z",
        timeToStation: 60,
        nextPrediction: {
          id: "pred-1",
          routeId: "337",
          routeNumber: "337",
          naptanId: "490012345A",
          stopName: "Stop A",
          direction: "outbound",
          destinationName: "Clapham Junction",
          expectedArrival: "2026-06-14T12:00:00Z",
          timeToStation: 60,
          vehicleId: registration,
        },
        nextStop: null,
        stopIndex: 0,
        progress: 0,
        x: 0,
        y: 0,
        matched: true,
        adherence: "onTime",
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
      },
    ],
    metrics: {
      liveVehicleCount: 1,
      averageGapMinutes: null,
      largestGapMinutes: null,
      smallestGapMinutes: null,
      bunchingClusterCount: 0,
      largeGapCount: 0,
      stalePredictionCount: 0,
      disappearedPredictionCount: 0,
      missingFromRefreshCount: 0,
      isDataStale: false,
      healthScore: 80,
      healthLabel: "Good",
      estimatedLateCount: 0,
      estimatedEarlyCount: 0,
      estimatedOnTimeCount: 0,
      unknownScheduleMatchCount: 1,
      averageScheduleDeviationMinutes: null,
      possibleGhostCount: 0,
      predictionDisappearedCount: 0,
      missingLatestCount: 0,
      reappearedCount: 0,
      outbound: {
        direction: "outbound",
        liveVehicleCount: 1,
        averageGapMinutes: null,
        largestGapMinutes: null,
        smallestGapMinutes: null,
        bunchingClusterCount: 0,
        largeGapCount: 0,
      },
      inbound: {
        direction: "inbound",
        liveVehicleCount: 0,
        averageGapMinutes: null,
        largestGapMinutes: null,
        smallestGapMinutes: null,
        bunchingClusterCount: 0,
        largeGapCount: 0,
      },
    },
    dashboardSummary: {
      routeId: "337",
      healthScore: 80,
      healthLabel: "Good",
      liveVehicleCount: 1,
      largestGapMinutes: null,
      largeGapCount: 0,
      bunchingClusterCount: 0,
      isDataStale: false,
      disappearedPredictionCount: 0,
      missingFromRefreshCount: 0,
      stalePredictionCount: 0,
      estimatedLateCount: 0,
      estimatedEarlyCount: 0,
      estimatedOnTimeCount: 0,
      unknownScheduleMatchCount: 1,
      possibleGhostCount: 0,
      predictionDisappearedCount: 0,
      missingLatestCount: 0,
    },
  };
}

describe("activeVehicleSearchIndex", () => {
  it("prefers enriched intelligence cache entries", () => {
    const lite = intelligenceWithRegistration("LITE000");
    const enriched = intelligenceWithRegistration("ENRICHED");

    const picked = pickBestRouteIntelligence([
      [["route-intelligence", "337", "lite", "no-ibus"], lite],
      [["route-intelligence", "337", "full", "ibus"], enriched],
    ]);

    expect(picked?.vehicles[0]?.vehicleRegistration).toBe("ENRICHED");
  });

  it("collects candidates only from cached active-route intelligence", () => {
    const queryClient = new QueryClient();
    const activeRoutes: ActiveRoute[] = [
      { routeId: "337", routeName: "337", addedAt: 1 },
    ];

    queryClient.setQueryData(
      ["route-intelligence", "337", "lite", 1, 1, "horizontal", "no-ibus"],
      intelligenceWithRegistration("LV24EUK"),
    );

    const candidates = collectActiveVehicleCandidates(queryClient, activeRoutes);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.vehicle.vehicleRegistration).toBe("LV24EUK");
    expect(candidates[0]?.routeId).toBe("337");
  });
});
