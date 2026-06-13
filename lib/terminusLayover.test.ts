import { describe, expect, it } from "vitest";
import { isPossibleGhostBus } from "@/lib/ghostDisplay";
import {
  attachTerminusLayoverState,
  detectTerminusLayover,
} from "@/lib/terminusLayover";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

const route: NormalizedRoute = {
  routeId: "156",
  routeName: "156",
  outbound: [
    { id: "1", name: "Start", naptanId: "490000001A", isTimingPoint: false },
    { id: "2", name: "Mid", naptanId: "490000002B", isTimingPoint: false },
    { id: "3", name: "Richmond", naptanId: "490000003C", isTimingPoint: false },
  ],
  inbound: [
    { id: "4", name: "Wimbledon", naptanId: "490000004D", isTimingPoint: false },
    { id: "5", name: "Return Mid", naptanId: "490000005E", isTimingPoint: false },
    { id: "6", name: "End", naptanId: "490000006F", isTimingPoint: false },
  ],
};

function vehicle(
  overrides: Partial<EstimatedVehiclePosition>,
): EstimatedVehiclePosition {
  return {
    vehicleId: "V1",
    routeNumber: "156",
    direction: "outbound",
    destinationName: "Richmond",
    expectedArrival: "2026-06-13T14:22:00.000Z",
    timeToStation: 240,
    nextPrediction: {
      id: "pred-1",
      routeId: "156",
      routeNumber: "156",
      naptanId: "490000003C",
      stopName: "Richmond",
      destinationName: "Richmond",
      direction: "outbound",
      timeToStation: 240,
      expectedArrival: "2026-06-13T14:22:00.000Z",
      vehicleId: "V1",
    },
    nextStop: route.outbound[2],
    stopIndex: 2,
    progress: 0.48,
    x: 100,
    y: 200,
    matched: true,
    adherence: "onTime",
    scheduleDeviationMinutes: null,
    scheduleStatus: "onTime",
    scheduleStatusLabel: "On time",
    scheduleMatchConfidence: "medium",
    matchedScheduledTime: null,
    matchedStopName: "Richmond",
    scheduleDataAvailable: true,
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    ...overrides,
  };
}

describe("terminusLayover", () => {
  it("detects a bus waiting at the final outbound stop as terminus layover", () => {
    const result = detectTerminusLayover(
      vehicle({
        stopIndex: 2,
        progress: 0.48,
        timeToStation: 300,
      }),
      route,
    );

    expect(result.markerState).toBe("terminus-layover");
    expect(result.terminusLayoverLabel).toBe("At terminus");
  });

  it("does not mark a normal mid-route bus as terminus layover", () => {
    const result = detectTerminusLayover(
      vehicle({
        stopIndex: 1,
        progress: 0.25,
        timeToStation: 120,
        nextStop: route.outbound[1],
      }),
      route,
    );

    expect(result.markerState).toBe("live");
  });

  it("uses grey-style marker state without ghost styling", () => {
    const enriched = attachTerminusLayoverState(
      [
        vehicle({
          stopIndex: 2,
          progress: 0.48,
          timeToStation: 300,
        }),
      ],
      route,
    );

    expect(enriched[0]?.markerState).toBe("terminus-layover");
    expect(isPossibleGhostBus(enriched[0]!)).toBe(false);
  });
});
