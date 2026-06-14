import { describe, expect, it } from "vitest";
import { debugScheduledJourneyForRun } from "@/lib/scheduledGhostDebug";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

const route156: NormalizedRoute = {
  routeId: "156",
  routeName: "156",
  outbound: [
    { id: "1", name: "Stop A", naptanId: "490000001A", isTimingPoint: false },
    { id: "2", name: "Stop B", naptanId: "490000002B", isTimingPoint: false },
  ],
  inbound: [
    { id: "3", name: "Stop C", naptanId: "490000003C", isTimingPoint: false },
  ],
};

const schedule156: IbusRouteSchedule = {
  baseVersion: "20260606",
  routeId: "156",
  generatedAt: "2026-06-13T00:00:00.000Z",
  journeys: [
    {
      tripId: "run-138-trip",
      operatorCode: "CX",
      blockNo: "123138",
      blockIdx: "",
      runningNo: "138",
      garageNo: "123",
      direction: "1",
      destination: "towards Stop B",
      patternIdx: "4147",
      startTime: "10:00",
      startSeconds: 36000,
      endSeconds: 36300,
      journeyType: 1,
      serviceDays: [5],
      stops: [
        {
          sequence: 1,
          stopName: "Stop A",
          stopCode: "A1",
          naptanId: "490000001A",
          scheduledTime: "10:00",
          scheduledSeconds: 36000,
        },
        {
          sequence: 2,
          stopName: "Stop B",
          stopCode: "B1",
          naptanId: "490000002B",
          scheduledTime: "10:05",
          scheduledSeconds: 36300,
        },
      ],
    },
  ],
};

function liveVehicle(overrides: Partial<EstimatedVehiclePosition>): EstimatedVehiclePosition {
  return {
    vehicleId: "BUS-live",
    routeNumber: "156",
    direction: "outbound",
    destinationName: "Destination",
    expectedArrival: "2026-06-12T09:04:00.000Z",
    timeToStation: 120,
    nextPrediction: {
      id: "pred-live",
      routeId: "156",
      routeNumber: "156",
      naptanId: "490000001A",
      stopName: "Stop A",
      destinationName: "Destination",
      direction: "outbound",
      timeToStation: 120,
      expectedArrival: "2026-06-12T09:04:00.000Z",
      vehicleId: "BUS-live",
    },
    nextStop: route156.outbound[0]!,
    stopIndex: 0,
    progress: 0.1,
    x: 10,
    y: 20,
    matched: true,
    adherence: "onTime",
    scheduleDeviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: null,
    matchedStopName: null,
    scheduleDataAvailable: true,
    scheduleExplanation: "",
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    ...overrides,
  };
}

describe("debugScheduledJourneyForRun", () => {
  it("identifies an active route 156 running 138 candidate when no live match exists", () => {
    const result = debugScheduledJourneyForRun({
      routeSchedule: schedule156,
      routeId: "156",
      runningNo: "138",
      now: new Date("2026-06-12T09:04:00.000Z"),
      liveVehicles: [],
      route: route156,
      liveBaseVersion: "20260606",
      dataUpdatedAt: new Date("2026-06-12T09:04:00.000Z").getTime(),
    });

    expect(result.foundInSchedule).toBe(true);
    expect(result.journeyCount).toBe(1);
    expect(result.activeJourneyCount).toBe(1);
    expect(result.displayedCandidateCount).toBe(1);
    expect(result.journeys[0]?.confidence).toBe("high");
    expect(result.journeys[0]?.inactiveReason).toBeNull();
  });

  it("does not suppress running 138 for unrelated live vehicles", () => {
    const result = debugScheduledJourneyForRun({
      routeSchedule: schedule156,
      routeId: "156",
      runningNo: "138",
      now: new Date("2026-06-12T09:04:00.000Z"),
      liveVehicles: [
        liveVehicle({
          vehicleId: "OTHER",
          routeNumber: "337",
          ibusRunningNo: "138",
        }),
      ],
      route: route156,
      liveBaseVersion: "20260606",
      dataUpdatedAt: new Date("2026-06-12T09:04:00.000Z").getTime(),
    });

    expect(result.displayedCandidateCount).toBe(1);
    expect(result.journeys[0]?.liveMatches[0]?.matched).toBe(false);
  });

  it("does not treat vehicleFleetReference as an iBus running number", () => {
    const result = debugScheduledJourneyForRun({
      routeSchedule: schedule156,
      routeId: "156",
      runningNo: "138",
      now: new Date("2026-06-12T09:04:00.000Z"),
      liveVehicles: [
        liveVehicle({
          expectedArrival: "2026-06-12T10:30:00.000Z",
          nextPrediction: {
            id: "pred-live",
            routeId: "156",
            routeNumber: "156",
            naptanId: "490000001A",
            stopName: "Stop A",
            destinationName: "Destination",
            direction: "outbound",
            timeToStation: 120,
            expectedArrival: "2026-06-12T10:30:00.000Z",
            vehicleId: "BUS-live",
          },
          vehicleFleetReference: "138",
          ibusRunningNo: undefined,
          ibusBlockNo: undefined,
        }),
      ],
      route: route156,
      liveBaseVersion: "20260606",
      dataUpdatedAt: new Date("2026-06-12T09:04:00.000Z").getTime(),
    });

    expect(result.displayedCandidateCount).toBe(1);
    expect(result.journeys[0]?.liveMatches[0]?.matched).toBe(false);
  });

  it("reports same-route running-number suppression for a real live running 138", () => {
    const result = debugScheduledJourneyForRun({
      routeSchedule: schedule156,
      routeId: "156",
      runningNo: "138",
      now: new Date("2026-06-12T09:04:00.000Z"),
      liveVehicles: [
        liveVehicle({
          ibusRunningNo: "138",
          ibusBlockNo: "123138",
        }),
      ],
      route: route156,
      liveBaseVersion: "20260606",
      dataUpdatedAt: new Date("2026-06-12T09:04:00.000Z").getTime(),
    });

    expect(result.displayedCandidateCount).toBe(0);
    expect(result.journeys[0]?.inactiveReason).toBe("suppressed by plausible live match");
    expect(result.journeys[0]?.liveMatches[0]?.reasons).toContain(
      "runningNo/blockNo",
    );
  });

  it("explains when running 138 is present but not currently active", () => {
    const result = debugScheduledJourneyForRun({
      routeSchedule: schedule156,
      routeId: "156",
      runningNo: "138",
      now: new Date("2026-06-14T00:22:00.000Z"),
      liveVehicles: [],
      route: route156,
      liveBaseVersion: "20260606",
      dataUpdatedAt: new Date("2026-06-14T00:22:00.000Z").getTime(),
    });

    expect(result.foundInSchedule).toBe(true);
    expect(result.activeJourneyCount).toBe(0);
    expect(result.journeys[0]?.inactiveReason).toBe(
      "not scheduled for current London service day",
    );
  });
});
