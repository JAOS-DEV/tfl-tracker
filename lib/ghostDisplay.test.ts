import { describe, expect, it } from "vitest";
import {
  countPossibleGhostsBySource,
  formatGhostDestination,
  getGhostSource,
  getPossibleGhostExplanation,
  isPossibleGhostBus,
  GHOST_MARKER_RING_CLASS,
  possibleGhostCountLabel,
  POSSIBLE_GHOST_LABEL,
} from "@/lib/ghostDisplay";
import { resolveScheduledJourneyDestination, scheduledGhostToVehiclePosition } from "@/lib/scheduledGhostBuses";
import type { IbusScheduledJourney } from "@/lib/ibus/scheduleTypes";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

const sampleRoute: NormalizedRoute = {
  routeId: "337",
  routeName: "337",
  outbound: [
    { id: "1", name: "Richmond", naptanId: "490000001A", isTimingPoint: false },
    { id: "2", name: "Stop B", naptanId: "490000002B", isTimingPoint: false },
  ],
  inbound: [
    { id: "3", name: "Clapham Junction", naptanId: "490000003C", isTimingPoint: false },
  ],
};

function scheduleGhostVehicle(): EstimatedVehiclePosition {
  return scheduledGhostToVehiclePosition({
    kind: "scheduled-ghost-candidate",
    routeId: "337",
    direction: "outbound",
    tripId: "trip-1",
    baseVersion: "20260606",
    runningNo: "138",
    blockNo: "B1",
    garageNo: "G1",
    operatorCode: "CX",
    destination: "towards Richmond",
    expectedStopName: "Stop B",
    expectedStopCode: "B1",
    expectedScheduledTime: "2026-06-13T10:00:00.000Z",
    progress: 0.4,
    x: 10,
    y: 20,
    confidence: "high",
    reason: "scheduled-journey-active-but-no-live-match",
  });
}

function feedGhostVehicle(): EstimatedVehiclePosition {
  return {
    vehicleId: "V99",
    routeNumber: "337",
    direction: "outbound",
    destinationName: "Richmond",
    expectedArrival: "2026-06-13T10:00:00.000Z",
    timeToStation: 0,
    nextPrediction: {
      id: "pred-1",
      routeId: "337",
      routeNumber: "337",
      naptanId: "490000002B",
      stopName: "Stop B",
      destinationName: "Richmond",
      direction: "outbound",
      timeToStation: 0,
      expectedArrival: "2026-06-13T10:00:00.000Z",
      vehicleId: "V99",
    },
    nextStop: null,
    stopIndex: -1,
    progress: 0.5,
    x: 10,
    y: 20,
    matched: false,
    adherence: "onTime",
    scheduleDeviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: null,
    matchedStopName: "Stop B",
    scheduleDataAvailable: false,
    ghostStatus: "disappeared",
    ghostSource: "disappeared",
    ghostReason: "Prediction disappeared from the TfL feed",
    lastSeenAt: Date.now() - 120_000,
    missedRefreshCount: 2,
    isSuspectedGhost: false,
  };
}

describe("ghost display helpers", () => {
  it("uses violet dashed marker styling for possible ghosts", () => {
    expect(GHOST_MARKER_RING_CLASS).toContain("violet");
    expect(GHOST_MARKER_RING_CLASS).toContain("stroke-dashed");
  });

  it("uses one user-facing label regardless of ghost source", () => {
    const scheduleGhost = scheduleGhostVehicle();
    const feedGhost = {
      ...feedGhostVehicle(),
      isSuspectedGhost: true,
      ghostSource: "feed" as const,
    };

    expect(getPossibleGhostExplanation(scheduleGhost)?.title).toBe(
      POSSIBLE_GHOST_LABEL,
    );
    expect(getPossibleGhostExplanation(feedGhost)?.title).toBe(
      POSSIBLE_GHOST_LABEL,
    );
    expect(possibleGhostCountLabel(2)).toBe("2 possible ghosts");
  });

  it("explains schedule ghosts as active scheduled journeys without live match", () => {
    const explanation = getPossibleGhostExplanation(scheduleGhostVehicle());
    expect(explanation?.summary).toContain(
      "scheduled journey should currently be active",
    );
    expect(explanation?.sourceLabel).toContain("iBus static schedule");
    expect(getGhostSource(scheduleGhostVehicle())).toBe("schedule");
  });

  it("explains feed/disappeared ghosts as previously visible but no longer returned", () => {
    const explanation = getPossibleGhostExplanation(feedGhostVehicle());
    expect(explanation?.summary).toContain("previously visible in the live feed");
    expect(explanation?.sourceLabel).toBe("live TfL feed tracking");
    expect(getGhostSource(feedGhostVehicle())).toBe("disappeared");
  });

  it("counts combined possible ghosts and can break down by source in diagnostics", () => {
    const vehicles = [scheduleGhostVehicle(), feedGhostVehicle()];
    expect(isPossibleGhostBus(scheduleGhostVehicle())).toBe(true);
    expect(isPossibleGhostBus(feedGhostVehicle())).toBe(true);
    expect(countPossibleGhostsBySource(vehicles)).toEqual({
      schedule: 1,
      feed: 0,
      disappeared: 1,
      total: 2,
    });
  });

  it("falls back destination to final stop name when explicit destination missing", () => {
    const journey: IbusScheduledJourney = {
      tripId: "9001",
      operatorCode: null,
      blockNo: "1",
      blockIdx: "100",
      runningNo: "138",
      garageNo: null,
      direction: "1",
      destination: null,
      patternIdx: "10",
      startTime: "10:00",
      startSeconds: 36000,
      endSeconds: 36600,
      journeyType: 1,
      serviceDays: [6],
      stops: [
        {
          sequence: 1,
          stopName: "Wimbledon",
          stopCode: "A1",
          naptanId: "490000001A",
          scheduledTime: "10:00",
          scheduledSeconds: 36000,
        },
        {
          sequence: 2,
          stopName: "Richmond",
          stopCode: "B1",
          naptanId: "490000002B",
          scheduledTime: "10:10",
          scheduledSeconds: 36600,
        },
      ],
    };

    expect(
      resolveScheduledJourneyDestination(journey, sampleRoute, "outbound"),
    ).toBe("towards Richmond");
    expect(formatGhostDestination(null)).toBe("Destination unavailable");
    expect(formatGhostDestination("towards Richmond")).toBe("towards Richmond");
  });
});
