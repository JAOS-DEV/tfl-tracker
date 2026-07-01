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
import {
  matchLiveVehicleToSchedule,
  selectBestScheduleMatch,
  selectBestScheduleMatchWithDiagnostics,
} from "@/lib/schedulePipeline/matchLiveVehicleToSchedule";
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
    expect(pool.allJourneys.length).toBeGreaterThan(1_000);
    expect(pool.activeJourneys.length).toBeGreaterThan(0);
    expect(pool.activeJourneys.length).toBeLessThan(pool.allJourneys.length / 10);
  });

  it("keeps delayed live runs matchable after they leave the ghost-active window", () => {
    const schedule = normalizeRouteSchedule(readLocalRouteSchedule("14"));
    expect(schedule).not.toBeNull();

    const now = new Date("2026-07-01T00:30:00.000Z").getTime();
    const pool = buildLiveSchedulePool(schedule!, now);
    const activeTripIds = new Set(pool.activeJourneys.map((journey) => journey.tripId));
    const delayedMatch = pool.liveMatchingJourneys.find(
      (journey) => !activeTripIds.has(journey.tripId),
    );

    expect(delayedMatch).toBeDefined();
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

describe("ambiguous live journey matching", () => {
  const scheduledStop = (scheduledSeconds: number) => ({
    sequence: 1,
    stopName: "Stop A",
    stopCode: "A1",
    naptanId: "490000001A",
    scheduledTime: `${String(Math.floor(scheduledSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((scheduledSeconds % 3600) / 60)).padStart(2, "0")}`,
    scheduledSeconds,
  });

  it("selects the running/block candidate nearest the live next-stop prediction", () => {
    const earlyJourney = buildActiveJourney({
      tripId: "wrong-journey",
      startSeconds: 28_800,
      endSeconds: 36_600,
      stops: [scheduledStop(29_100)],
    });
    const nearestJourney = buildActiveJourney({
      tripId: "nearest-journey",
      startSeconds: 32_400,
      endSeconds: 36_600,
      stops: [scheduledStop(32_700)],
    });
    const schedule = {
      ...controlSchedule,
      journeys: [earlyJourney, nearestJourney],
    };
    const pool = buildLiveSchedulePool(schedule, pipelineNow);
    const vehicle = buildVehicle({
      tripId: "live-trip-not-in-static-schedule",
      ibusRunningNo: "568",
      ibusBlockNo: "123568",
      expectedArrival: "2026-06-12T08:06:00.000Z",
    });

    const match = selectBestScheduleMatch(
      vehicle,
      pool.liveMatchingJourneys,
      route337,
      pool,
      schedule.baseVersion,
    );

    expect(match?.journey.tripId).toBe("nearest-journey");
    expect(match?.reason).toBe("runningNo/blockNo");
  });

  it("rejects a running/block candidate with an implausible next-stop time", () => {
    const implausibleJourney = buildActiveJourney({
      tripId: "implausible-journey",
      startSeconds: 28_800,
      endSeconds: 36_600,
      stops: [scheduledStop(29_100)],
    });
    const schedule = { ...controlSchedule, journeys: [implausibleJourney] };
    const pool = buildLiveSchedulePool(schedule, pipelineNow);
    const vehicle = buildVehicle({
      tripId: "live-trip-not-in-static-schedule",
      ibusRunningNo: "568",
      ibusBlockNo: "123568",
      expectedArrival: "2026-06-12T09:06:00.000Z",
    });

    expect(
      selectBestScheduleMatch(
        vehicle,
        pool.liveMatchingJourneys,
        route337,
        pool,
        schedule.baseVersion,
      ),
    ).toBeNull();
  });

  it("reports raw after-midnight service time and converted London/UTC instants", () => {
    const afterMidnightJourney = buildActiveJourney({
      tripId: "after-midnight-journey",
      startSeconds: 24 * 3600,
      endSeconds: 26 * 3600,
      stops: [scheduledStop(25 * 3600 + 14 * 60)],
    });
    const schedule = { ...controlSchedule, journeys: [afterMidnightJourney] };
    const pool = buildLiveSchedulePool(schedule, pipelineNow);
    const vehicle = buildVehicle({
      tripId: "live-trip-not-in-static-schedule",
      ibusRunningNo: "568",
      ibusBlockNo: "123568",
      expectedArrival: "2026-06-13T01:15:00.000Z",
    });

    const result = selectBestScheduleMatchWithDiagnostics(
      vehicle,
      [afterMidnightJourney],
      route337,
      pool,
      schedule.baseVersion,
    );

    expect(result.match).toBeNull();
    expect(result.trace).toMatchObject({
      journeyId: "after-midnight-journey",
      rawScheduledServiceTime: "25:14",
      liveExpectedArrivalUtc: "2026-06-13T01:15:00.000Z",
      scheduledArrivalUtc: "2026-06-13T00:14:00.000Z",
      stopTimeDifferenceMinutes: 61,
      rejectionReason: "fallback-time-difference",
    });
    expect(result.trace?.liveExpectedArrivalLondon).toContain("02:15");
    expect(result.trace?.scheduledArrivalLondon).toContain("01:14");
  });
});

describe("after-midnight indexed matching", () => {
  it("matches a plausible indexed journey even when the active pool is empty", () => {
    const journey = buildActiveJourney({
      serviceDays: [0],
      startSeconds: 36_000,
      endSeconds: 36_900,
    });
    const schedule = { ...controlSchedule, journeys: [journey] };
    const result = runScheduleTimingPipeline({
      routeId: "337",
      route: route337,
      routeSchedule: schedule,
      vehicles: [
        buildVehicle({
          tripId: "live-trip-not-in-static-schedule",
          ibusRunningNo: "568",
          ibusBlockNo: "123568",
          expectedArrival: "2026-06-12T09:05:00.000Z",
        }),
      ],
      layout: LOOP_LAYOUT,
      now: pipelineNow,
      dataUpdatedAt: pipelineNow,
      showScheduleGhosts: false,
      includeLowConfidence: false,
      collectDiagnostics: true,
    });

    expect(result.pool.liveMatchingJourneys).toHaveLength(0);
    expect(result.timingResults[0]?.display.candidateMatch).toBe(true);
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
