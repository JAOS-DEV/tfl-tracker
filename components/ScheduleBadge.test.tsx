import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleBadge } from "@/components/ScheduleBadge";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

const basePrediction = {
  id: "P1",
  routeId: "337",
  routeNumber: "337",
  direction: "outbound" as const,
  destinationName: "Richmond",
  expectedArrival: "2026-06-11T08:00:00.000Z",
  timeToStation: 120,
  vehicleId: "V1",
  naptanId: "A",
  stopName: "Stop A",
};

function createVehicle(
  overrides: Partial<EstimatedVehiclePosition> = {},
): EstimatedVehiclePosition {
  return {
    vehicleId: "V1",
    routeNumber: "337",
    direction: "outbound",
    progress: 0.5,
    stopIndex: 2,
    x: 10,
    y: 20,
    matched: true,
    adherence: "onTime",
    scheduleStatus: "onTime",
    scheduleDeviationMinutes: 0,
    scheduleMatchConfidence: "high",
    scheduleStatusLabel: "On time",
    matchedScheduledTime: "2026-06-11T08:00:00.000Z",
    matchedStopName: "Stop A",
    scheduleDataAvailable: true,
    isSuspectedGhost: false,
    ghostStatus: "normal",
    missedRefreshCount: 0,
    expectedArrival: "2026-06-11T08:00:00.000Z",
    timeToStation: 120,
    nextPrediction: basePrediction,
    nextStop: {
      id: "1",
      name: "Stop A",
      naptanId: "A",
      isTimingPoint: false,
    },
    destinationName: "Richmond",
    ...overrides,
  };
}

describe("ScheduleBadge", () => {
  it("hides unknown schedule badges on the loop", () => {
    const { container } = render(
      <ScheduleBadge
        vehicle={createVehicle({
          scheduleStatus: "unknown",
          scheduleMatchConfidence: "unknown",
        })}
        context="loop"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows loop badges for clear schedule matches", () => {
    render(
      <ScheduleBadge
        vehicle={createVehicle({
          scheduleStatus: "early",
          scheduleDeviationMinutes: -2,
          adherence: "early",
        })}
        context="loop"
      />,
    );

    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it("hides ghost schedule badges", () => {
    const { container } = render(
      <ScheduleBadge
        vehicle={createVehicle({ isSuspectedGhost: true })}
        context="loop"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
