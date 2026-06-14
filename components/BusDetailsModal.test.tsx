import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BusDetailsModal } from "@/components/BusDetailsModal";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

vi.mock("@/hooks/useIbusVehicleDetails", () => ({
  useIbusVehicleDetails: () => ({
    ibusQuery: {
      isLoading: false,
      data: {
        registration: "LV24EWY",
        fleetNo: "3085",
        runningNo: "568",
        blockNo: "123568",
        sourceBaseVersion: "20260606",
        fleetSource: "tfl-ibus-static",
        runningNumberSource: "tfl-ibus-static",
        status: "matched",
      },
    },
    fleetFallbackQuery: { isLoading: false, data: undefined },
    displayFleetNo: "3085",
    fleetSourceLabel: "TfL iBus static data",
    runningNo: "568",
    runningNumberSourceLabel: "TfL iBus static data",
  }),
}));

function vehicle(
  overrides: Partial<EstimatedVehiclePosition> = {},
): EstimatedVehiclePosition {
  return {
    vehicleId: "V1",
    vehicleRegistration: "LV24EWY",
    routeNumber: "156",
    direction: "outbound",
    destinationName: "Richmond",
    expectedArrival: "2026-06-13T14:22:00.000Z",
    timeToStation: 180,
    nextPrediction: {
      id: "pred-1",
      routeId: "156",
      routeNumber: "156",
      naptanId: "490000001A",
      stopName: "Wimbledon Station",
      destinationName: "Richmond",
      direction: "outbound",
      timeToStation: 180,
      expectedArrival: "2026-06-13T14:22:00.000Z",
      vehicleId: "V1",
    },
    nextStop: {
      id: "1",
      name: "Wimbledon Station",
      naptanId: "490000001A",
      isTimingPoint: false,
    },
    stopIndex: 1,
    progress: 0.2,
    x: 10,
    y: 20,
    matched: true,
    adherence: "onTime",
    scheduleDeviationMinutes: 2,
    scheduleStatus: "late",
    scheduleStatusLabel: "+2 min",
    scheduleMatchConfidence: "medium",
    matchedScheduledTime: "2026-06-13T14:20:00.000Z",
    matchedStopName: "Wimbledon Station",
    scheduleDataAvailable: true,
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    ...overrides,
  };
}

describe("BusDetailsModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows registration and fleet once in the header, not again in iBus details", () => {
    render(
      <BusDetailsModal
        vehicle={vehicle()}
        showAdvancedDiagnostics={false}
        onClose={() => undefined}
      />,
    );

    const title = document.getElementById("bus-details-title");
    expect(title).not.toBeNull();
    expect(title).toHaveTextContent("Bus");
    expect(title).toHaveTextContent("156");
    expect(title).toHaveTextContent("Destination");
    expect(title).toHaveTextContent("Richmond");
    expect(screen.queryByText("156 · Richmond")).not.toBeInTheDocument();
    expect(screen.getByText("Registration")).toBeInTheDocument();
    expect(screen.getByText("LV24EWY")).toBeInTheDocument();
    expect(screen.getByText("Fleet number")).toBeInTheDocument();
    expect(screen.getByText("3085")).toBeInTheDocument();
    expect(screen.getByText("Running number")).toBeInTheDocument();
    expect(screen.getByText("568")).toBeInTheDocument();
    expect(screen.queryByText("iBus base version")).not.toBeInTheDocument();
    expect(screen.getByText("Block")).toBeInTheDocument();
  });

  it("shows schedule match helper wording", () => {
    render(
      <BusDetailsModal
        vehicle={vehicle()}
        showAdvancedDiagnostics={false}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("Schedule match")).toBeInTheDocument();
    expect(
      screen.getByText(/compares the live bus position with the iBus schedule estimate/i),
    ).toBeInTheDocument();
  });

  it("shows loop movement debug only with advanced diagnostics", () => {
    const { rerender } = render(
      <BusDetailsModal
        vehicle={vehicle()}
        showAdvancedDiagnostics={false}
        movementDecision={{ mode: "snap", reason: "first-seen" }}
        onClose={() => undefined}
      />,
    );

    expect(screen.queryByText("Loop movement debug")).not.toBeInTheDocument();

    rerender(
      <BusDetailsModal
        vehicle={vehicle()}
        showAdvancedDiagnostics
        movementDecision={{ mode: "snap", reason: "first-seen" }}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("Loop movement debug")).toBeInTheDocument();
    expect(screen.getByText("iBus base version")).toBeInTheDocument();
  });
});
