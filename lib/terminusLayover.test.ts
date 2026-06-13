import { describe, expect, it } from "vitest";
import { LOOP_LAYOUT } from "@/lib/constants";
import { isPossibleGhostBus } from "@/lib/ghostDisplay";
import {
  attachTerminusLayoverState,
  detectTerminusLayover,
  getTerminusLayoverDisplayPosition,
} from "@/lib/terminusLayover";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

const portraitLayout = {
  viewBoxWidth: 520,
  viewBoxHeight: 400,
  leftX: 178,
  rightX: 342,
  topY: 72,
  bottomY: 320,
  orientation: "portrait" as const,
};

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
    expect(result.terminusLayoverKind).toBe("leg-end");
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

  it("places outbound leg-end waiting buses on the portrait bottom connector", () => {
    const enriched = attachTerminusLayoverState(
      [
        vehicle({
          stopIndex: 2,
          progress: 0.48,
          timeToStation: 300,
        }),
      ],
      route,
      portraitLayout,
    );

    expect(enriched[0]?.markerState).toBe("terminus-layover");
    expect(isPossibleGhostBus(enriched[0]!)).toBe(false);
    expect(enriched[0]?.x).toBe(260);
    expect(enriched[0]?.y).toBeCloseTo(314.048);
    expect(enriched[0]?.terminusLayoverKind).toBe("leg-end");
  });

  it("places outbound leg-start waiting buses on the portrait top connector", () => {
    const position = getTerminusLayoverDisplayPosition(
      "outbound",
      portraitLayout,
      "leg-start",
    );

    expect(position.x).toBe(260);
    expect(position.y).toBeCloseTo(77.952);
    expect(position.progress).toBe(0.25);
  });

  it("places inbound leg-start waiting buses on the portrait bottom connector", () => {
    const position = getTerminusLayoverDisplayPosition(
      "inbound",
      portraitLayout,
      "leg-start",
    );

    expect(position.x).toBe(260);
    expect(position.y).toBeCloseTo(314.048);
    expect(position.progress).toBe(0.75);
  });

  it("places landscape outbound leg-end waiting buses on the right connector", () => {
    const position = getTerminusLayoverDisplayPosition(
      "outbound",
      LOOP_LAYOUT,
      "leg-end",
    );

    expect(position.x).toBeCloseTo(880.8);
    expect(position.y).toBe(260);
    expect(position.progress).toBe(0.25);
  });
});
