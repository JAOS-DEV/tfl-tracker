import { describe, expect, it, vi } from "vitest";
import { readLocalRouteSchedule } from "@/lib/ibus/testLocalFixtures";
import { normalizeRouteSchedule } from "@/lib/ibus/compactScheduleDecode";
import { LOOP_LAYOUT } from "@/lib/constants";
import {
  buildIbusVehicleScheduleMatch,
  matchVehiclesToIbusRouteSchedule,
} from "@/lib/ibusScheduleDeviation";
import { buildRouteIntelligence } from "@/lib/routeIntelligence";
import { scheduleLoopBadgeLabel } from "@/lib/scheduleDeviation";
import * as buildLiveSchedulePoolModule from "@/lib/schedulePipeline/buildLiveSchedulePool";
import { buildLiveSchedulePool } from "@/lib/schedulePipeline/buildLiveSchedulePool";
import { buildScheduleDisplayState } from "@/lib/schedulePipeline/buildScheduleDisplayState";
import * as matchLiveVehicleModule from "@/lib/schedulePipeline/matchLiveVehicleToSchedule";
import { matchLiveVehicleToSchedule } from "@/lib/schedulePipeline/matchLiveVehicleToSchedule";
import { buildScheduleIndexes } from "@/lib/schedulePipeline/buildScheduleIndexes";
import * as runSchedulePipelineModule from "@/lib/schedulePipeline/runSchedulePipeline";
import { runScheduleTimingPipeline } from "@/lib/schedulePipeline/runSchedulePipeline";
import * as scheduledGhostBusesModule from "@/lib/scheduledGhostBuses";
import { generateScheduleGhosts } from "@/lib/schedulePipeline/generateScheduleGhosts";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  PredictionTrackingState,
} from "@/lib/tfl/types";

const route337: NormalizedRoute = {
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
  index: number,
  overrides: Partial<IbusRouteSchedule["journeys"][number]> = {},
): IbusRouteSchedule["journeys"][number] {
  const runningNo = String(500 + index);
  return {
    tripId: `trip-${index}`,
    operatorCode: "CX",
    blockNo: `123${runningNo}`,
    blockIdx: "",
    runningNo,
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

function buildActiveJourney(
  overrides: Partial<IbusRouteSchedule["journeys"][number]> = {},
): IbusRouteSchedule["journeys"][number] {
  return buildJourney(568, {
    tripId: "trip-568",
    runningNo: "568",
    blockNo: "123568",
    ...overrides,
  });
}

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

function buildLargeSchedule(
  totalJourneys: number,
  activeCount: number,
): IbusRouteSchedule {
  const journeys = Array.from({ length: totalJourneys }, (_, index) => {
    const isActive = index < activeCount;
    return buildJourney(index, {
      startSeconds: isActive ? 32_400 : ((index + 3) * 97) % 86_400,
      endSeconds: isActive ? 33_900 : (((index + 3) * 97) % 86_400) + 900,
      serviceDays: isActive ? [5] : [0],
    });
  });

  return {
    baseVersion: "20260606",
    routeId: "14",
    generatedAt: "2026-06-13T00:00:00.000Z",
    journeys,
  };
}

const controlSchedule: IbusRouteSchedule = {
  baseVersion: "20260606",
  routeId: "337",
  generatedAt: "2026-06-13T00:00:00.000Z",
  journeys: [buildActiveJourney()],
};

const pipelineNow = new Date("2026-06-12T09:04:00.000Z").getTime();

describe("route 14 schedule scale", () => {
  it("keeps the live-matching pool much smaller than the full service day", () => {
    const schedule = normalizeRouteSchedule(readLocalRouteSchedule("14"));
    expect(schedule).not.toBeNull();

    const pool = buildLiveSchedulePool(schedule!, pipelineNow);
    expect(pool.allJourneys.length).toBe(998);
    expect(pool.activeJourneys.length).toBeGreaterThan(0);
    expect(pool.activeJourneys.length).toBeLessThan(100);
  });
});

describe("schedule pipeline performance", () => {
  it("builds the live schedule pool once per timing pipeline run", () => {
    const poolSpy = vi.spyOn(buildLiveSchedulePoolModule, "buildLiveSchedulePool");

    runScheduleTimingPipeline({
      routeId: "14",
      route: { ...route337, routeId: "14", routeName: "14" },
      routeSchedule: buildLargeSchedule(998, 8),
      vehicles: [buildVehicle({ routeNumber: "14" })],
      layout: LOOP_LAYOUT,
      now: pipelineNow,
      dataUpdatedAt: pipelineNow,
      showScheduleGhosts: true,
      includeLowConfidence: false,
      collectDiagnostics: false,
    });

    expect(poolSpy).toHaveBeenCalledTimes(1);
    poolSpy.mockRestore();
  });

  it("does not scan the full service-day schedule for a strongly indexed vehicle", () => {
    const schedule = buildLargeSchedule(998, 8);
    const pool = buildLiveSchedulePool(schedule, pipelineNow);
    const builtIndexes = buildScheduleIndexes(pool.activeJourneys, pool.baseVersion);

    const directionalSpy = vi.spyOn(
      matchLiveVehicleModule,
      "collectDirectionalActiveCandidates",
    );

    matchLiveVehicleToSchedule(
      buildVehicle({
        routeNumber: "14",
        tripId: "trip-0",
        baseVersion: "20260606",
      }),
      pool,
      builtIndexes,
      { ...route337, routeId: "14", routeName: "14" },
      "20260606",
    );

    expect(directionalSpy).not.toHaveBeenCalled();
    expect(pool.allJourneys).toHaveLength(998);
    expect(pool.activeJourneys.length).toBeLessThan(20);
    directionalSpy.mockRestore();
  });

  it("generates ghosts from the active live-matching pool only", () => {
    const schedule = buildLargeSchedule(998, 8);
    const pool = buildLiveSchedulePool(schedule, pipelineNow);
    const candidatesSpy = vi.spyOn(
      scheduledGhostBusesModule,
      "getScheduledGhostCandidates",
    );

    generateScheduleGhosts({
      routeId: "14",
      route: { ...route337, routeId: "14", routeName: "14" },
      layout: LOOP_LAYOUT,
      vehicles: [],
      schedule,
      pool,
      now: pipelineNow,
      dataUpdatedAt: pipelineNow,
      showScheduleGhosts: true,
      includeLowConfidence: false,
      collectDiagnostics: false,
    });

    expect(candidatesSpy).toHaveBeenCalled();
    const input = candidatesSpy.mock.calls[0]?.[0];
    expect(input?.scheduledJourneys.length).toBe(pool.activeJourneys.length);
    expect(input?.scheduledJourneys.length).toBeLessThan(20);
    expect(schedule.journeys.length).toBe(998);
    candidatesSpy.mockRestore();
  });

  it("does not collect timing diagnostics when advanced diagnostics are off", () => {
    const result = runScheduleTimingPipeline({
      routeId: "337",
      route: route337,
      routeSchedule: controlSchedule,
      vehicles: [buildVehicle()],
      layout: LOOP_LAYOUT,
      now: pipelineNow,
      dataUpdatedAt: pipelineNow,
      showScheduleGhosts: true,
      includeLowConfidence: false,
      collectDiagnostics: false,
    });

    expect(result.timingDiagnostics).toBeUndefined();
  });

  it("does not run the schedule pipeline for collapsed routes", () => {
    const timingSpy = vi.spyOn(
      runSchedulePipelineModule,
      "runScheduleTimingPipeline",
    );

    buildRouteIntelligence({
      routeId: "337",
      route: route337,
      predictions: [
        {
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
      ],
      layout: LOOP_LAYOUT,
      dataUpdatedAt: pipelineNow,
      now: pipelineNow,
      trackingStates: new Map<string, PredictionTrackingState>(),
      includeScheduleMatching: false,
      routeSchedule: controlSchedule,
    });

    expect(timingSpy).not.toHaveBeenCalled();
    timingSpy.mockRestore();
  });
});

describe("schedule pipeline badge accuracy", () => {
  const now = new Date("2026-06-12T09:04:00.000Z");

  it("shows strong +35 and +59 late badges", () => {
    for (const minutes of [35, 59]) {
      const match = buildIbusVehicleScheduleMatch(
        buildVehicle({
          expectedArrival: `2026-06-12T09:${String(minutes).padStart(2, "0")}:00.000Z`,
        }),
        controlSchedule,
        route337,
        now,
      );

      expect(match.scheduleStatus).toBe("late");
      expect(match.deviationMinutes).toBe(minutes);
      expect(
        scheduleLoopBadgeLabel(
          match.scheduleStatus,
          match.deviationMinutes,
          match.scheduleMatchConfidence,
        ),
      ).toBe(`+${minutes}`);
    }
  });

  it("keeps weak +35 matches unknown", () => {
    const display = buildScheduleDisplayState(
      buildVehicle({
        tripId: undefined,
        baseVersion: undefined,
        ibusRunningNo: undefined,
        ibusBlockNo: undefined,
        expectedArrival: "2026-06-12T09:35:00.000Z",
      }),
      route337,
      {
        journey: buildActiveJourney(),
        reason: "next-stop/time",
      },
      buildActiveJourney().stops[0]!,
      "2026-06-12T09:00:00.000Z",
    );

    expect(display.scheduleStatus).toBe("unknown");
    expect(display.trustedTiming).toBe(false);
    expect(display.rejectionReason).toBe("weak-fallback");
    expect(
      scheduleLoopBadgeLabel(
        display.scheduleStatus,
        display.deviationMinutes,
        display.scheduleMatchConfidence,
      ),
    ).toBeNull();
  });

  it("shows strong -15 early and hides strong -35 early", () => {
    const earlyTrusted = buildIbusVehicleScheduleMatch(
      buildVehicle({
        expectedArrival: "2026-06-12T08:45:00.000Z",
      }),
      controlSchedule,
      route337,
      now,
    );
    const earlyUnknown = buildIbusVehicleScheduleMatch(
      buildVehicle({
        expectedArrival: "2026-06-12T08:25:00.000Z",
      }),
      controlSchedule,
      route337,
      now,
    );

    expect(earlyTrusted.scheduleStatus).toBe("early");
    expect(
      scheduleLoopBadgeLabel(
        earlyTrusted.scheduleStatus,
        earlyTrusted.deviationMinutes,
        earlyTrusted.scheduleMatchConfidence,
      ),
    ).toBe("-15");
    expect(earlyUnknown.scheduleStatus).toBe("unknown");
    expect(
      scheduleLoopBadgeLabel(
        earlyUnknown.scheduleStatus,
        earlyUnknown.deviationMinutes,
        earlyUnknown.scheduleMatchConfidence,
      ),
    ).toBeNull();
  });

  it("never turns unknown timing into on-time", () => {
    const [updated] = matchVehiclesToIbusRouteSchedule(
      [
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
      ],
      controlSchedule,
      route337,
      now.getTime(),
    );

    expect(updated?.scheduleStatus).toBe("unknown");
    expect(updated?.scheduleMatchConfidence).toBe("unknown");
  });

  it("keeps route 337 control behaviour unchanged", () => {
    const match = buildIbusVehicleScheduleMatch(
      buildVehicle(),
      controlSchedule,
      route337,
      now,
    );

    expect(match.scheduleStatus).toBe("late");
    expect(match.scheduleMatchConfidence).not.toBe("unknown");
    expect(match.deviationMinutes).toBeGreaterThanOrEqual(2);
  });
});
