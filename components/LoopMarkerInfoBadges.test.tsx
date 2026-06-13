import { describe, expect, it } from "vitest";
import { buildLoopMarkerLabels } from "@/components/LoopMarkerInfoBadges";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

function vehicle(
  overrides: Partial<EstimatedVehiclePosition> = {},
): EstimatedVehiclePosition {
  return {
    vehicleId: "V1",
    routeNumber: "156",
    direction: "outbound",
    destinationName: "Richmond",
    expectedArrival: "2026-06-13T14:22:00.000Z",
    timeToStation: 120,
    nextPrediction: {
      id: "pred-1",
      routeId: "156",
      routeNumber: "156",
      naptanId: "490000001A",
      stopName: "Stop A",
      destinationName: "Richmond",
      direction: "outbound",
      timeToStation: 120,
      expectedArrival: "2026-06-13T14:22:00.000Z",
      vehicleId: "V1",
    },
    nextStop: null,
    stopIndex: 1,
    progress: 0.2,
    x: 10,
    y: 20,
    matched: true,
    adherence: "onTime",
    scheduleDeviationMinutes: null,
    scheduleStatus: "onTime",
    scheduleStatusLabel: "On time",
    scheduleMatchConfidence: "medium",
    matchedScheduledTime: null,
    matchedStopName: null,
    scheduleDataAvailable: true,
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    ...overrides,
  };
}

describe("buildLoopMarkerLabels", () => {
  it("defaults to hidden labels", () => {
    expect(
      buildLoopMarkerLabels(vehicle({ vehicleRegistration: "LV24EWY" }), {
        showRegistration: false,
        showFleetNumber: false,
        showRunningNumber: false,
      }),
    ).toHaveLength(0);
  });

  it("shows registration only when enabled and available", () => {
    const labels = buildLoopMarkerLabels(
      vehicle({ vehicleRegistration: "LV24EWY" }),
      {
        showRegistration: true,
        showFleetNumber: false,
        showRunningNumber: false,
      },
    );

    expect(labels).toEqual([{ key: "registration", text: "Reg: LV24EWY" }]);
  });

  it("shows fleet and running labels when enabled and available", () => {
    const labels = buildLoopMarkerLabels(
      vehicle({
        vehicleFleetReference: "3085",
        ibusRunningNo: "136",
      }),
      {
        showRegistration: false,
        showFleetNumber: true,
        showRunningNumber: true,
      },
    );

    expect(labels.map((label) => label.text)).toEqual([
      "Fleet: 3085",
      "Run: 136",
    ]);
  });

  it("does not show fake registration or fleet on schedule ghosts", () => {
    const labels = buildLoopMarkerLabels(
      vehicle({
        isScheduledGhostCandidate: true,
        isSuspectedGhost: true,
        vehicleRegistration: undefined,
        vehicleFleetReference: "SHOULD-NOT-SHOW",
        scheduledGhostRunningNo: "136",
      }),
      {
        showRegistration: true,
        showFleetNumber: true,
        showRunningNumber: true,
      },
    );

    expect(labels).toEqual([{ key: "running", text: "Run: 136" }]);
  });
});
