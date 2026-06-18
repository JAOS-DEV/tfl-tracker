import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteDiagram } from "@/components/RouteDiagram";
import { buildStopRowDomId, buildStopRowKey } from "@/lib/listRowKeys";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedStop,
} from "@/lib/tfl/types";

const sharedStop: NormalizedStop = {
  id: "759209907",
  name: "Shared Stop",
  naptanId: "759209907",
  isTimingPoint: false,
};

const route: NormalizedRoute = {
  routeId: "14",
  routeName: "14",
  outbound: [
    { id: "1", name: "Start", naptanId: "START", isTimingPoint: false },
    sharedStop,
    { id: "3", name: "End", naptanId: "END", isTimingPoint: false },
  ],
  inbound: [
    {
      id: "4",
      name: "Return Start",
      naptanId: "RSTART",
      isTimingPoint: false,
    },
    sharedStop,
  ],
};

function liveVehicle(
  vehicleId: string,
  nextStop: NormalizedStop,
  stopIndex: number,
): EstimatedVehiclePosition {
  return {
    vehicleId,
    routeNumber: "14",
    direction: "outbound",
    destinationName: "End",
    expectedArrival: "2026-06-14T12:00:00.000Z",
    timeToStation: 90,
    nextPrediction: {
      id: `pred-${vehicleId}`,
      routeId: "14",
      routeNumber: "14",
      naptanId: nextStop.naptanId,
      stopName: nextStop.name,
      destinationName: "End",
      direction: "outbound",
      timeToStation: 90,
      expectedArrival: "2026-06-14T12:00:00.000Z",
      vehicleId,
    },
    nextStop,
    stopIndex,
    progress: 0.2 + stopIndex * 0.1,
    x: 10,
    y: 20,
    matched: true,
    adherence: "onTime",
    scheduleDeviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: null,
    matchedStopName: nextStop.name,
    scheduleDataAvailable: false,
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
  };
}

describe("RouteDiagram", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders unique row ids when the same stop id repeats in one direction", () => {
    const repeatedRoute: NormalizedRoute = {
      ...route,
      outbound: [sharedStop, sharedStop],
    };

    const { container } = render(
      <RouteDiagram
        route={repeatedRoute}
        direction="outbound"
        predictions={[]}
        onStopSelect={() => undefined}
      />,
    );

    const rowKeys = [
      buildStopRowKey("14", "outbound", "759209907", 0),
      buildStopRowKey("14", "outbound", "759209907", 1),
    ];

    for (const rowKey of rowKeys) {
      expect(
        container.querySelector(`#${buildStopRowDomId(rowKey)}`),
      ).not.toBeNull();
    }
  });

  it("shows the disabled jump message when no live bus is available", () => {
    render(
      <RouteDiagram
        route={route}
        direction="outbound"
        predictions={[]}
        vehicles={[]}
        onStopSelect={() => undefined}
      />,
    );

    expect(
      screen.getByText("No live bus stops to jump to"),
    ).toBeInTheDocument();
  });

  it("cycles through live bus rows on repeated jump clicks", async () => {
    const user = userEvent.setup();
    const startStop = route.outbound[0]!;
    const endStop = route.outbound[2]!;
    const vehicles = [
      liveVehicle("BUS-START", startStop, 0),
      liveVehicle("BUS-SHARED", sharedStop, 1),
      liveVehicle("BUS-END", endStop, 2),
    ];

    const { container } = render(
      <RouteDiagram
        route={route}
        direction="outbound"
        predictions={[]}
        vehicles={vehicles}
        onStopSelect={() => undefined}
      />,
    );

    const scrollContainer = container.querySelector(
      ".overflow-y-auto",
    ) as HTMLDivElement;
    expect(scrollContainer).not.toBeNull();

    const scrollTo = vi.fn();
    scrollContainer.scrollTo = scrollTo;
    scrollContainer.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        right: 0,
        bottom: 400,
        width: 0,
        height: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const rowKeys = [
      buildStopRowKey("14", "outbound", "1", 0),
      buildStopRowKey("14", "outbound", "759209907", 1),
      buildStopRowKey("14", "outbound", "3", 2),
    ];

    for (const [index, rowKey] of rowKeys.entries()) {
      const target = container.querySelector(
        `#${buildStopRowDomId(rowKey)}`,
      ) as HTMLElement;
      Object.defineProperty(target, "offsetTop", {
        value: index * 120,
        configurable: true,
      });
      Object.defineProperty(target, "offsetHeight", {
        value: 80,
        configurable: true,
      });
      target.getBoundingClientRect = () =>
        ({
          top: index * 120,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: index * 120,
          toJSON: () => ({}),
        }) as DOMRect;
    }

    const jumpButton = screen.getByRole("button", { name: "Jump to next bus" });

    await user.click(jumpButton);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector(`#${buildStopRowDomId(rowKeys[0]!)}`)?.className,
    ).toContain("ring-sky-300");

    await user.click(screen.getByRole("button", { name: "Next bus (2/3)" }));
    expect(scrollTo).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Next bus (3/3)" }));
    expect(scrollTo).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole("button", { name: "Next bus (1/3)" }));
    expect(scrollTo).toHaveBeenCalledTimes(4);
  });
});
