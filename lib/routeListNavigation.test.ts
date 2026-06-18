import { describe, expect, it, vi } from "vitest";
import { buildStopRowDomId, buildStopRowKey } from "@/lib/listRowKeys";
import {
  buildLiveBusJumpCandidates,
  findStopIndexInDirection,
  getJumpButtonLabel,
  pickInitialJumpCandidate,
  pickJumpCandidateOnClick,
  pickNextJumpCandidate,
  resolveJumpTargetStopIndex,
  scrollStopRowIntoListContainer,
} from "@/lib/routeListNavigation";
import type { BusJumpCandidate } from "@/lib/routeListNavigation";
import type { EstimatedVehiclePosition, NormalizedStop } from "@/lib/tfl/types";

const sharedStop: NormalizedStop = {
  id: "759209907",
  name: "Shared Stop",
  naptanId: "759209907",
  isTimingPoint: false,
};

const outboundStops: NormalizedStop[] = [
  { id: "1", name: "A", naptanId: "A", isTimingPoint: false },
  sharedStop,
  { id: "3", name: "C", naptanId: "C", isTimingPoint: false },
];

const inboundStops: NormalizedStop[] = [
  { id: "2", name: "B", naptanId: "B", isTimingPoint: false },
  sharedStop,
];

function vehicle(
  overrides: Partial<EstimatedVehiclePosition>,
): EstimatedVehiclePosition {
  return {
    vehicleId: "BUS1",
    routeNumber: "14",
    direction: "outbound",
    destinationName: "Terminus",
    expectedArrival: "2026-06-14T12:00:00.000Z",
    timeToStation: 120,
    nextPrediction: {
      id: "pred-1",
      routeId: "14",
      routeNumber: "14",
      naptanId: "759209907",
      stopName: "Shared Stop",
      destinationName: "Terminus",
      direction: "outbound",
      timeToStation: 120,
      expectedArrival: "2026-06-14T12:00:00.000Z",
      vehicleId: "BUS1",
    },
    nextStop: sharedStop,
    stopIndex: 1,
    progress: 0.4,
    x: 10,
    y: 20,
    matched: true,
    adherence: "onTime",
    scheduleDeviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: null,
    matchedStopName: "Shared Stop",
    scheduleDataAvailable: false,
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    ...overrides,
  };
}

function candidate(rowKey: string, stopIndex: number): BusJumpCandidate {
  return {
    rowKey,
    domId: buildStopRowDomId(rowKey),
    stopIndex,
    direction: "outbound",
    vehicles: [vehicle({ vehicleId: `BUS-${stopIndex}` })],
  };
}

describe("routeListNavigation", () => {
  it("resolves the outbound row when the same stop id exists in both directions", () => {
    const targetIndex = resolveJumpTargetStopIndex(
      vehicle({ direction: "outbound", stopIndex: 1 }),
      outboundStops,
    );

    expect(targetIndex).toBe(1);
    expect(outboundStops[targetIndex]?.id).toBe("759209907");
  });

  it("resolves the inbound row when the next bus is on the inbound leg", () => {
    const targetIndex = resolveJumpTargetStopIndex(
      vehicle({ direction: "inbound", stopIndex: 1 }),
      inboundStops,
    );

    expect(targetIndex).toBe(1);
    expect(inboundStops[targetIndex]?.id).toBe("759209907");
  });

  it("picks the nearest matching row index when duplicate stop ids exist", () => {
    const repeatedStops: NormalizedStop[] = [
      sharedStop,
      { id: "3", name: "C", naptanId: "C", isTimingPoint: false },
      sharedStop,
    ];

    expect(findStopIndexInDirection(repeatedStops, "759209907", 2)).toBe(2);
    expect(findStopIndexInDirection(repeatedStops, "759209907")).toBe(0);
  });

  it("builds ordered live bus jump candidates for rows with live buses", () => {
    const candidates = buildLiveBusJumpCandidates(
      "337",
      "outbound",
      outboundStops,
      [
        vehicle({
          vehicleId: "BUS-A",
          nextStop: outboundStops[0]!,
          stopIndex: 0,
        }),
        vehicle({
          vehicleId: "BUS-C",
          nextStop: outboundStops[2]!,
          stopIndex: 2,
        }),
      ],
    );

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.rowKey).toBe(
      buildStopRowKey("337", "outbound", "1", 0),
    );
    expect(candidates[1]?.rowKey).toBe(
      buildStopRowKey("337", "outbound", "3", 2),
    );
  });

  it("cycles through candidates and wraps from last to first", () => {
    const candidates = [
      candidate("337:outbound:1:0", 0),
      candidate("337:outbound:759209907:1", 1),
      candidate("337:outbound:3:2", 2),
    ];

    expect(pickNextJumpCandidate(candidates, null)?.rowKey).toBe(
      "337:outbound:1:0",
    );
    expect(pickNextJumpCandidate(candidates, "337:outbound:1:0")?.rowKey).toBe(
      "337:outbound:759209907:1",
    );
    expect(
      pickNextJumpCandidate(candidates, "337:outbound:759209907:1")?.rowKey,
    ).toBe("337:outbound:3:2");
    expect(pickNextJumpCandidate(candidates, "337:outbound:3:2")?.rowKey).toBe(
      "337:outbound:1:0",
    );
  });

  it("picks the first candidate after the current scroll position", () => {
    const container = document.createElement("div");
    const first = document.createElement("div");
    const second = document.createElement("div");
    first.id = buildStopRowDomId("337:outbound:1:0");
    second.id = buildStopRowDomId("337:outbound:3:2");
    Object.defineProperty(first, "offsetTop", { value: 20, configurable: true });
    Object.defineProperty(first, "offsetHeight", { value: 40, configurable: true });
    Object.defineProperty(second, "offsetTop", {
      value: 220,
      configurable: true,
    });
    Object.defineProperty(second, "offsetHeight", {
      value: 40,
      configurable: true,
    });
    container.append(first, second);
    Object.defineProperty(container, "scrollTop", {
      value: 100,
      writable: true,
    });

    const candidates = [
      candidate("337:outbound:1:0", 0),
      candidate("337:outbound:3:2", 2),
    ];

    expect(
      pickInitialJumpCandidate(candidates, container)?.rowKey,
    ).toBe("337:outbound:3:2");
  });

  it("keeps duplicate NaPTAN rows as separate jump candidates", () => {
    const repeatedStops: NormalizedStop[] = [sharedStop, sharedStop];
    const candidates = buildLiveBusJumpCandidates(
      "14",
      "outbound",
      repeatedStops,
      [
        vehicle({
          vehicleId: "BUS-0",
          nextStop: repeatedStops[0]!,
          stopIndex: 0,
        }),
        vehicle({
          vehicleId: "BUS-1",
          nextStop: repeatedStops[1]!,
          stopIndex: 1,
        }),
      ],
    );

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.rowKey).toBe(
      buildStopRowKey("14", "outbound", "759209907", 0),
    );
    expect(candidates[1]?.rowKey).toBe(
      buildStopRowKey("14", "outbound", "759209907", 1),
    );
  });

  it("uses cycling after a previous jump target exists", () => {
    const candidates = [
      candidate("337:outbound:1:0", 0),
      candidate("337:outbound:3:2", 2),
    ];

    expect(
      pickJumpCandidateOnClick(candidates, "337:outbound:1:0", null)?.rowKey,
    ).toBe("337:outbound:3:2");
    expect(pickJumpCandidateOnClick(candidates, null, null)?.rowKey).toBe(
      "337:outbound:1:0",
    );
  });

  it("shows the next bus counter after the first jump", () => {
    const candidates = [
      candidate("337:outbound:1:0", 0),
      candidate("337:outbound:3:2", 2),
      candidate("337:outbound:759209907:1", 1),
    ];

    expect(getJumpButtonLabel(candidates, null)).toBe("Jump to next bus");
    expect(getJumpButtonLabel(candidates, "337:outbound:1:0")).toBe(
      "Next bus (2/3)",
    );
  });

  it("scrolls the list container instead of the window when present", () => {
    const container = document.createElement("div");
    const target = document.createElement("div");
    target.id = buildStopRowDomId("337:outbound:3:2");
    container.append(target);

    Object.defineProperty(container, "scrollTop", {
      value: 0,
      writable: true,
    });
    container.scrollTo = vi.fn();
    container.getBoundingClientRect = () =>
      ({
        top: 100,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    target.getBoundingClientRect = () =>
      ({
        top: 260,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 260,
        toJSON: () => ({}),
      }) as DOMRect;

    const scrolled = scrollStopRowIntoListContainer(
      container,
      buildStopRowDomId("337:outbound:3:2"),
    );

    expect(scrolled).toBe(true);
    expect(container.scrollTo).toHaveBeenCalledWith({
      top: 152,
      behavior: "smooth",
    });
  });

  it("falls back to scrollIntoView when no container is provided", () => {
    const target = document.createElement("div");
    target.id = buildStopRowDomId("337:outbound:1:0");
    document.body.append(target);
    target.scrollIntoView = vi.fn();

    const scrolled = scrollStopRowIntoListContainer(
      null,
      buildStopRowDomId("337:outbound:1:0"),
    );

    expect(scrolled).toBe(true);
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });

    document.body.removeChild(target);
  });
});
