import { describe, expect, it } from "vitest";
import { LOOP_LAYOUT } from "@/lib/constants";
import { buildRouteIntelligence } from "@/lib/routeIntelligence";
import { normalizeRouteSchedule } from "@/lib/ibus/compactScheduleDecode";
import {
  getLocalIbusFixtureVersion,
  readLocalRouteSchedule,
} from "@/lib/ibus/testLocalFixtures";
import { buildLiveSchedulePool } from "@/lib/schedulePipeline/buildLiveSchedulePool";
import { buildScheduleIndexes } from "@/lib/schedulePipeline/buildScheduleIndexes";
import { matchLiveVehiclesToSchedule } from "@/lib/schedulePipeline/matchLiveVehicleToSchedule";
import { enrichLiveVehicles } from "@/lib/schedulePipeline/enrichLiveVehicles";
import type { LiveIbusRunningDetail } from "@/lib/ibusLookup";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedVehiclePrediction,
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

function buildVehicle(
  journey: NonNullable<ReturnType<typeof normalizeRouteSchedule>>["journeys"][number],
  overrides: Partial<EstimatedVehiclePosition> = {},
): EstimatedVehiclePosition {
  const firstStop = journey.stops[0]!;
  return {
    vehicleId: "LV24EUK",
    routeNumber: "337",
    direction: "outbound",
    destinationName: "Richmond",
    expectedArrival: "2026-06-12T09:05:00.000Z",
    timeToStation: 120,
    nextPrediction: {
      id: "pred-1",
      routeId: "337",
      routeNumber: "337",
      naptanId: firstStop.naptanId ?? "490000001A",
      stopName: firstStop.stopName,
      destinationName: "Richmond",
      direction: "outbound",
      timeToStation: 120,
      expectedArrival: "2026-06-12T09:05:00.000Z",
      vehicleId: "LV24EUK",
      tripId: journey.tripId,
      baseVersion: "20250619",
    },
    nextStop: {
      id: firstStop.stopCode ?? "1",
      name: firstStop.stopName,
      naptanId: firstStop.naptanId ?? "490000001A",
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
    matchedStopName: firstStop.stopName,
    scheduleDataAvailable: false,
    scheduleExplanation: "Timetable unavailable",
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    tripId: journey.tripId,
    baseVersion: "20250619",
    vehicleRegistration: "LV24EUK",
    ...overrides,
  };
}

describe("running lookup integration", () => {
  const fixtureVersion = getLocalIbusFixtureVersion();

  it("attaches running/block from enrichment into schedule matching", () => {
    const schedule = normalizeRouteSchedule(readLocalRouteSchedule("337"));
    expect(schedule).not.toBeNull();

    const now = new Date("2026-06-12T09:04:00.000Z").getTime();
    const pool = buildLiveSchedulePool(schedule!, now);
    const activeJourney = pool.activeJourneys[0];
    expect(activeJourney).toBeDefined();

    const indexes = buildScheduleIndexes(pool.activeJourneys, pool.baseVersion);
    const liveDetails = new Map<string, LiveIbusRunningDetail>([
      [
        "LV24EUK",
        {
          runningNo: activeJourney!.runningNo,
          blockNo: activeJourney!.blockNo,
          operatorCode: "CX",
          runningLookupStatus: "matched",
          liveBaseVersion: "20250619",
          staticBaseVersion: fixtureVersion,
          baseVersionMatches: fixtureVersion === "20250619",
        },
      ],
    ]);

    const enriched = enrichLiveVehicles([buildVehicle(activeJourney!)], liveDetails);
    const { timingResults } = matchLiveVehiclesToSchedule(
      enriched,
      pool,
      indexes,
      route337,
    );

    expect(enriched[0]?.ibusRunningNo).toBe(activeJourney!.runningNo);
    expect(enriched[0]?.ibusBlockNo).toBe(activeJourney!.blockNo);
    expect(timingResults[0]?.display.candidateMatch).toBe(true);
    expect(timingResults[0]?.display.trustedTiming).toBe(true);
    expect(timingResults[0]?.matchReason).toBe("tripId/baseVersion");
  });

  it("does not run schedule pipeline work when route is collapsed", () => {
    const schedule = normalizeRouteSchedule(readLocalRouteSchedule("337"));
    const now = Date.now();
    const prediction: NormalizedVehiclePrediction = {
      id: "pred-1",
      routeId: "337",
      routeNumber: "337",
      naptanId: "490000001A",
      stopName: "Stop A",
      destinationName: "Richmond",
      direction: "outbound",
      timeToStation: 120,
      expectedArrival: "2026-06-12T09:05:00.000Z",
      vehicleId: "LV24EUK",
      tripId: "601361",
      baseVersion: "20250619",
    };

    const result = buildRouteIntelligence({
      routeId: "337",
      route: route337,
      predictions: [prediction],
      layout: LOOP_LAYOUT,
      dataUpdatedAt: now,
      now,
      trackingStates: new Map<string, PredictionTrackingState>(),
      includeScheduleMatching: false,
      routeSchedule: schedule!,
      liveIbusRunningDetails: new Map([
        [
          "LV24EUK",
          {
            runningNo: "561",
            blockNo: "123561",
            runningLookupStatus: "matched",
          },
        ],
      ]),
    });

    expect(result.vehicles[0]?.ibusRunningNo).toBe("561");
    expect(result.vehicles[0]?.scheduleStatus).toBe("unknown");
    expect(result.scheduleTimingDiagnostics).toBeUndefined();
  });

  it("route 337 active pool with static running lookup improves candidate/trusted counts", () => {
    const schedule = normalizeRouteSchedule(readLocalRouteSchedule("337"));
    expect(schedule).not.toBeNull();

    const now = new Date("2026-06-12T09:04:00.000Z").getTime();
    const pool = buildLiveSchedulePool(schedule!, now);
    const indexes = buildScheduleIndexes(pool.activeJourneys, pool.baseVersion);

    const liveDetails = new Map<string, LiveIbusRunningDetail>();
    const vehicles = pool.activeJourneys.map((journey, index) => {
      const firstStop = journey.stops[0]!;
      const vehicleId = `BUS-${index}`;
      const baseVersionMatches = pool.baseVersion === "20250619";

      liveDetails.set(vehicleId, {
        runningNo: journey.runningNo,
        blockNo: journey.blockNo,
        runningLookupStatus: "matched",
        liveBaseVersion: "20250619",
        staticBaseVersion: pool.baseVersion,
        baseVersionMatches,
        runningLookupNote: baseVersionMatches
          ? undefined
          : "Live prediction reports a different baseVersion, but tripId matched current static iBus data.",
      });

      return buildVehicle(journey, {
        vehicleId,
        tripId: journey.tripId,
        baseVersion: "20250619",
        direction: journey.direction === "inbound" ? "inbound" : "outbound",
        nextPrediction: {
          id: `pred-${index}`,
          routeId: "337",
          routeNumber: "337",
          naptanId: firstStop.naptanId ?? "490000001A",
          stopName: firstStop.stopName,
          destinationName: journey.destination ?? "Richmond",
          direction: journey.direction === "inbound" ? "inbound" : "outbound",
          timeToStation: 120,
          expectedArrival: "2026-06-12T09:05:00.000Z",
          vehicleId,
          tripId: journey.tripId,
          baseVersion: "20250619",
        },
      });
    });

    const enriched = enrichLiveVehicles(vehicles, liveDetails);
    const { timingResults } = matchLiveVehiclesToSchedule(
      enriched,
      pool,
      indexes,
      route337,
    );

    const candidateCount = timingResults.filter(
      (result) => result.display.candidateMatch,
    ).length;
    const trustedCount = timingResults.filter(
      (result) => result.display.trustedTiming,
    ).length;
    const blueCount = timingResults.filter(
      (result) => !result.display.trustedTiming,
    ).length;

    expect(pool.activeJourneys.length).toBeGreaterThan(0);
    expect(candidateCount).toBe(pool.activeJourneys.length);
    expect(trustedCount).toBeGreaterThan(2);
    expect(blueCount).toBeLessThan(pool.activeJourneys.length);
    expect({
      active: pool.activeJourneys.length,
      candidate: candidateCount,
      trusted: trustedCount,
      blue: blueCount,
    }).toEqual({ active: 11, candidate: 11, trusted: 11, blue: 0 });
  });

  it("route 14 active pool with static running lookup improves candidate/trusted counts", () => {
    const schedule = normalizeRouteSchedule(readLocalRouteSchedule("14"));
    expect(schedule).not.toBeNull();

    const now = new Date("2026-06-12T09:04:00.000Z").getTime();
    const pool = buildLiveSchedulePool(schedule!, now);
    const indexes = buildScheduleIndexes(pool.activeJourneys, pool.baseVersion);
    const route14: NormalizedRoute = {
      routeId: "14",
      routeName: "14",
      outbound: route337.outbound,
      inbound: route337.inbound,
    };

    const liveDetails = new Map<string, LiveIbusRunningDetail>();
    const vehicles = pool.activeJourneys.slice(0, 10).map((journey, index) => {
      const firstStop = journey.stops[0]!;
      const vehicleId = `BUS-${index}`;

      liveDetails.set(vehicleId, {
        runningNo: journey.runningNo,
        blockNo: journey.blockNo,
        runningLookupStatus: "matched",
        liveBaseVersion: "20250619",
        staticBaseVersion: pool.baseVersion,
        baseVersionMatches: pool.baseVersion === "20250619",
      });

      return buildVehicle(journey, {
        vehicleId,
        routeNumber: "14",
        tripId: journey.tripId,
        baseVersion: "20250619",
        direction: journey.direction === "inbound" ? "inbound" : "outbound",
        nextPrediction: {
          id: `pred-${index}`,
          routeId: "14",
          routeNumber: "14",
          naptanId: firstStop.naptanId ?? "490000001A",
          stopName: firstStop.stopName,
          destinationName: journey.destination ?? "Putney",
          direction: journey.direction === "inbound" ? "inbound" : "outbound",
          timeToStation: 120,
          expectedArrival: "2026-06-12T09:05:00.000Z",
          vehicleId,
          tripId: journey.tripId,
          baseVersion: "20250619",
        },
      });
    });

    const enriched = enrichLiveVehicles(vehicles, liveDetails);
    const { timingResults } = matchLiveVehiclesToSchedule(
      enriched,
      pool,
      indexes,
      route14,
    );

    const candidateCount = timingResults.filter(
      (result) => result.display.candidateMatch,
    ).length;
    const trustedCount = timingResults.filter(
      (result) => result.display.trustedTiming,
    ).length;
    const blueCount = timingResults.filter(
      (result) => !result.display.trustedTiming,
    ).length;

    expect(candidateCount).toBe(10);
    expect(trustedCount).toBeGreaterThan(2);
    expect(blueCount).toBeLessThan(10);
    expect({
      active: pool.activeJourneys.length,
      candidate: candidateCount,
      trusted: trustedCount,
      blue: blueCount,
    }).toEqual({ active: 26, candidate: 10, trusted: 10, blue: 0 });
  });
});
