import { describe, expect, it } from "vitest";
import {
  buildIbusVehicleScheduleMatch,
  matchVehiclesToIbusRouteSchedule,
  resolveAdherenceFromScheduleStatus,
} from "@/lib/ibusScheduleDeviation";
import { scheduleLoopBadgeLabel } from "@/lib/scheduleDeviation";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
} from "@/lib/tfl/types";

const route: NormalizedRoute = {
  routeId: "337",
  routeName: "337",
  outbound: [
    {
      id: "1",
      name: "Stop A",
      naptanId: "490000001A",
      isTimingPoint: false,
    },
    {
      id: "2",
      name: "Stop B",
      naptanId: "490000002B",
      isTimingPoint: false,
    },
  ],
  inbound: [],
};

function buildJourney(
  overrides: Partial<IbusRouteSchedule["journeys"][number]> = {},
): IbusRouteSchedule["journeys"][number] {
  return {
    tripId: "trip-568",
    operatorCode: "CX",
    blockNo: "123568",
    blockIdx: "",
    runningNo: "568",
    garageNo: "123",
    direction: "1",
    destination: "towards Stop B",
    patternIdx: "10",
    startTime: "10:00",
    startSeconds: 36_000,
    endSeconds: 36_900,
    journeyType: 1,
    serviceDays: [5],
    stops: [
      {
        sequence: 1,
        stopName: "Stop A",
        stopCode: "A1",
        naptanId: "490000001A",
        scheduledTime: "10:00",
        scheduledSeconds: 36_000,
      },
      {
        sequence: 2,
        stopName: "Stop B",
        stopCode: "B1",
        naptanId: "490000002B",
        scheduledTime: "10:10",
        scheduledSeconds: 36_600,
      },
    ],
    ...overrides,
  };
}

const routeSchedule: IbusRouteSchedule = {
  baseVersion: "20260606",
  routeId: "337",
  generatedAt: "2026-06-13T00:00:00.000Z",
  journeys: [buildJourney()],
};

function buildVehicle(
  overrides: Partial<EstimatedVehiclePosition> = {},
): EstimatedVehiclePosition {
  return {
    vehicleId: "BUS1",
    routeNumber: "337",
    direction: "outbound",
    destinationName: "Richmond",
    expectedArrival: "2026-06-12T09:05:00.000Z",
    timeToStation: 120,
    nextPrediction: {
      id: "pred-1",
      routeId: "337",
      routeNumber: "337",
      naptanId: "490000001A",
      stopName: "Stop A",
      destinationName: "Richmond",
      direction: "outbound",
      timeToStation: 120,
      expectedArrival: "2026-06-12T09:05:00.000Z",
      vehicleId: "BUS1",
      tripId: "trip-568",
      baseVersion: "20260606",
    },
    nextStop: {
      id: "1",
      name: "Stop A",
      naptanId: "490000001A",
      isTimingPoint: false,
    },
    stopIndex: 0,
    progress: 0.2,
    x: 10,
    y: 20,
    matched: true,
    adherence: "unknown",
    scheduleDeviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: null,
    matchedStopName: "Stop A",
    scheduleDataAvailable: false,
    scheduleExplanation: "Timetable unavailable",
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    tripId: "trip-568",
    baseVersion: "20260606",
    ...overrides,
  };
}

describe("resolveAdherenceFromScheduleStatus", () => {
  it("maps unknown schedule status to unknown adherence", () => {
    expect(resolveAdherenceFromScheduleStatus("unknown")).toBe("unknown");
    expect(resolveAdherenceFromScheduleStatus("onTime")).toBe("onTime");
    expect(resolveAdherenceFromScheduleStatus("late")).toBe("late");
    expect(resolveAdherenceFromScheduleStatus("early")).toBe("early");
  });
});

describe("buildIbusVehicleScheduleMatch", () => {
  const now = new Date("2026-06-12T09:04:00.000Z");

  it("derives late status from compact route schedule matching", () => {
    const match = buildIbusVehicleScheduleMatch(
      buildVehicle(),
      routeSchedule,
      route,
      now,
    );

    expect(match.scheduleStatus).toBe("late");
    expect(match.deviationMinutes).toBeGreaterThanOrEqual(2);
    expect(match.scheduleMatchConfidence).not.toBe("unknown");
  });

  it("derives early status when live bus is ahead of schedule", () => {
    const match = buildIbusVehicleScheduleMatch(
      buildVehicle({
        expectedArrival: "2026-06-12T08:57:00.000Z",
      }),
      routeSchedule,
      route,
      now,
    );

    expect(match.scheduleStatus).toBe("early");
    expect(match.deviationMinutes).toBeLessThanOrEqual(-2);
  });

  it("returns unknown when no active journey matches the live bus", () => {
    const match = buildIbusVehicleScheduleMatch(
      buildVehicle({
        tripId: undefined,
        baseVersion: undefined,
        ibusRunningNo: undefined,
        ibusBlockNo: undefined,
        nextStop: {
          id: "9",
          name: "Unmatched Stop",
          naptanId: "490000099Z",
          isTimingPoint: false,
        },
        expectedArrival: "2026-06-12T12:00:00.000Z",
      }),
      routeSchedule,
      route,
      now,
    );

    expect(match.scheduleStatus).toBe("unknown");
    expect(match.scheduleMatchConfidence).toBe("unknown");
  });

  it("shows loop badges for strongly matched large lateness", () => {
    const match = buildIbusVehicleScheduleMatch(
      buildVehicle({
        expectedArrival: "2026-06-12T09:35:00.000Z",
      }),
      routeSchedule,
      route,
      now,
    );

    expect(match.scheduleStatus).toBe("late");
    expect(match.deviationMinutes).toBe(35);
    expect(match.scheduleMatchConfidence).toBe("medium");
    expect(
      scheduleLoopBadgeLabel(
        match.scheduleStatus,
        match.deviationMinutes,
        match.scheduleMatchConfidence,
      ),
    ).toBe("+35");
  });

  it("shows loop badges for strongly matched lateness up to 59 minutes", () => {
    const match = buildIbusVehicleScheduleMatch(
      buildVehicle({
        expectedArrival: "2026-06-12T09:59:00.000Z",
      }),
      routeSchedule,
      route,
      now,
    );

    expect(match.deviationMinutes).toBe(59);
    expect(match.scheduleStatus).toBe("late");
    expect(
      scheduleLoopBadgeLabel(
        match.scheduleStatus,
        match.deviationMinutes,
        match.scheduleMatchConfidence,
      ),
    ).toBe("+59");
  });

  it("hides loop badges for strong block matches beyond 60 minutes late", () => {
    const match = buildIbusVehicleScheduleMatch(
      buildVehicle({
        tripId: undefined,
        baseVersion: undefined,
        ibusRunningNo: "568",
        ibusBlockNo: "123568",
        expectedArrival: "2026-06-12T10:01:00.000Z",
      }),
      routeSchedule,
      route,
      now,
    );

    expect(match.deviationMinutes).toBe(61);
    expect(match.scheduleMatchConfidence).toBe("unknown");
    expect(match.scheduleStatus).toBe("unknown");
    expect(
      scheduleLoopBadgeLabel(
        match.scheduleStatus,
        match.deviationMinutes,
        match.scheduleMatchConfidence,
      ),
    ).toBeNull();
  });

  it("shows early loop badges for trusted strong early matches", () => {
    const match = buildIbusVehicleScheduleMatch(
      buildVehicle({
        expectedArrival: "2026-06-12T08:45:00.000Z",
      }),
      routeSchedule,
      route,
      now,
    );

    expect(match.scheduleStatus).toBe("early");
    expect(match.deviationMinutes).toBe(-15);
    expect(
      scheduleLoopBadgeLabel(
        match.scheduleStatus,
        match.deviationMinutes,
        match.scheduleMatchConfidence,
      ),
    ).toBe("-15");
  });

  it("hides loop badges for very early strong matches", () => {
    const match = buildIbusVehicleScheduleMatch(
      buildVehicle({
        expectedArrival: "2026-06-12T08:25:00.000Z",
      }),
      routeSchedule,
      route,
      now,
    );

    expect(match.deviationMinutes).toBe(-35);
    expect(match.scheduleMatchConfidence).toBe("unknown");
    expect(match.scheduleStatus).toBe("unknown");
    expect(resolveAdherenceFromScheduleStatus(match.scheduleStatus)).toBe(
      "unknown",
    );
  });

  it("keeps route 337 small early and late badges working", () => {
    const lateMatch = buildIbusVehicleScheduleMatch(
      buildVehicle({
        expectedArrival: "2026-06-12T09:05:00.000Z",
      }),
      routeSchedule,
      route,
      now,
    );
    const earlyMatch = buildIbusVehicleScheduleMatch(
      buildVehicle({
        expectedArrival: "2026-06-12T08:57:00.000Z",
      }),
      routeSchedule,
      route,
      now,
    );

    expect(lateMatch.scheduleStatus).toBe("late");
    expect(
      scheduleLoopBadgeLabel(
        lateMatch.scheduleStatus,
        lateMatch.deviationMinutes,
        lateMatch.scheduleMatchConfidence,
      ),
    ).toMatch(/^\+/);
    expect(earlyMatch.scheduleStatus).toBe("early");
    expect(
      scheduleLoopBadgeLabel(
        earlyMatch.scheduleStatus,
        earlyMatch.deviationMinutes,
        earlyMatch.scheduleMatchConfidence,
      ),
    ).toMatch(/^-/);
  });
});

describe("matchVehiclesToIbusRouteSchedule", () => {
  it("updates live vehicles with schedule timing without timetable data", () => {
    const now = new Date("2026-06-12T09:04:00.000Z").getTime();
    const [updated] = matchVehiclesToIbusRouteSchedule(
      [buildVehicle()],
      routeSchedule,
      route,
      now,
    );

    expect(updated?.scheduleStatus).toBe("late");
    expect(updated?.scheduleDeviationMinutes).not.toBeNull();
  });
});

describe("route 14 disrupted schedule timing", () => {
  const route14: NormalizedRoute = {
    routeId: "14",
    routeName: "14",
    outbound: route.outbound,
    inbound: [],
  };

  const route14Schedule: IbusRouteSchedule = {
    baseVersion: "20260606",
    routeId: "14",
    generatedAt: "2026-06-13T00:00:00.000Z",
    journeys: [
      buildJourney({
        tripId: "trip-1401",
        runningNo: "401",
        blockNo: "140401",
        destination: "towards Putney",
      }),
    ],
  };

  const now = new Date("2026-06-12T09:04:00.000Z");

  it("shows +35 for a strongly matched disrupted late bus", () => {
    const match = buildIbusVehicleScheduleMatch(
      buildVehicle({
        routeNumber: "14",
        tripId: "trip-1401",
        baseVersion: "20260606",
        expectedArrival: "2026-06-12T09:35:00.000Z",
        nextPrediction: {
          id: "pred-14",
          routeId: "14",
          routeNumber: "14",
          naptanId: "490000001A",
          stopName: "Stop A",
          destinationName: "Putney",
          direction: "outbound",
          timeToStation: 120,
          expectedArrival: "2026-06-12T09:35:00.000Z",
          vehicleId: "BUS14",
          tripId: "trip-1401",
          baseVersion: "20260606",
        },
      }),
      route14Schedule,
      route14,
      now,
    );

    expect(match.scheduleStatus).toBe("late");
    expect(match.deviationMinutes).toBe(35);
    expect(
      scheduleLoopBadgeLabel(
        match.scheduleStatus,
        match.deviationMinutes,
        match.scheduleMatchConfidence,
      ),
    ).toBe("+35");
  });
});
