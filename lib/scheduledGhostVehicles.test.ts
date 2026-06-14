import { describe, expect, it } from "vitest";
import { LOOP_LAYOUT } from "@/lib/constants";
import { appendScheduledGhostVehicles } from "@/lib/scheduledGhostVehicles";
import type { IbusRouteSchedule, IbusScheduledJourney } from "@/lib/ibus/scheduleTypes";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
} from "@/lib/tfl/types";

const route: NormalizedRoute = {
  routeId: "test",
  routeName: "test",
  outbound: [
    { id: "1", name: "Stop A", naptanId: "490000001A", isTimingPoint: false },
    { id: "2", name: "Stop B", naptanId: "490000002B", isTimingPoint: false },
  ],
  inbound: [],
};

function journey(index: number): IbusScheduledJourney {
  const runningNo = String(100 + index);
  return {
    tripId: `trip-${index}`,
    operatorCode: "CX",
    blockNo: `block-${runningNo}`,
    blockIdx: "",
    runningNo,
    garageNo: "123",
    direction: "1",
    destination: "towards Stop B",
    patternIdx: "pattern-1",
    startTime: "10:00",
    startSeconds: 36000,
    endSeconds: 36600,
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
        scheduledTime: "10:10",
        scheduledSeconds: 36600,
      },
    ],
  };
}

function schedule(count: number): IbusRouteSchedule {
  return {
    baseVersion: "20260606",
    routeId: "test",
    generatedAt: "2026-06-13T00:00:00.000Z",
    journeys: Array.from({ length: count }, (_, index) => journey(index + 1)),
  };
}

function journeyForRunningNo(runningNo: string): IbusScheduledJourney {
  return {
    ...journey(Number(runningNo) - 100),
    tripId: `trip-${runningNo}`,
    blockNo: `block-${runningNo}`,
    runningNo,
  };
}

function scheduleForRunningNos(runningNos: string[]): IbusRouteSchedule {
  return {
    baseVersion: "20260606",
    routeId: "test",
    generatedAt: "2026-06-13T00:00:00.000Z",
    journeys: runningNos.map(journeyForRunningNo),
  };
}

function liveVehicle(index: number): EstimatedVehiclePosition {
  const runningNo = String(100 + index);
  const vehicleId = `live-${index}`;
  return {
    vehicleId,
    routeNumber: "test",
    direction: "outbound",
    destinationName: "Stop B",
    expectedArrival: "2026-06-12T09:05:00.000Z",
    timeToStation: 300,
    nextPrediction: {
      id: `prediction-${index}`,
      routeId: "test",
      routeNumber: "test",
      naptanId: "490000002B",
      stopName: "Stop B",
      destinationName: "Stop B",
      direction: "outbound",
      timeToStation: 300,
      expectedArrival: "2026-06-12T09:05:00.000Z",
      vehicleId,
      tripId: `trip-${index}`,
      baseVersion: "20260606",
    },
    nextStop: null,
    stopIndex: 1,
    progress: 0.25,
    x: 100,
    y: 100,
    matched: true,
    adherence: "onTime",
    scheduleDeviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: null,
    matchedStopName: null,
    scheduleDataAvailable: true,
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    tripId: `trip-${index}`,
    baseVersion: "20260606",
    ibusRunningNo: runningNo,
    ibusBlockNo: `block-${runningNo}`,
  };
}

function liveVehicleForRunningNo(runningNo: string): EstimatedVehiclePosition {
  return {
    ...liveVehicle(Number(runningNo) - 100),
    vehicleId: `live-${runningNo}`,
    nextPrediction: {
      ...liveVehicle(Number(runningNo) - 100).nextPrediction,
      id: `prediction-${runningNo}`,
      vehicleId: `live-${runningNo}`,
      tripId: `trip-${runningNo}`,
    },
    tripId: `trip-${runningNo}`,
    ibusRunningNo: runningNo,
    ibusBlockNo: `block-${runningNo}`,
  };
}

interface RouteSanitySummary {
  activeScheduledJourneys: number;
  liveVehicleCount: number;
  matchedScheduledToLive: number;
  visibleScheduleGhosts: number;
  explainedTotal: number;
  hiddenOrBlockedCandidates: number;
}

function parseSummary(diagnostics: string[]): RouteSanitySummary {
  const line = diagnostics.find((diagnostic) =>
    diagnostic.startsWith("Schedule sanity summary: "),
  );
  expect(line).toBeDefined();
  return JSON.parse(line!.slice("Schedule sanity summary: ".length)) as RouteSanitySummary;
}

describe("appendScheduledGhostVehicles route sanity", () => {
  it("shows only supported high-confidence ghosts within active scheduled count", () => {
    const result = appendScheduledGhostVehicles({
      routeId: "test",
      route,
      layout: LOOP_LAYOUT,
      vehicles: Array.from({ length: 10 }, (_, index) => liveVehicle(index + 1)),
      schedule: schedule(12),
      now: new Date("2026-06-12T09:05:00.000Z").getTime(),
      dataUpdatedAt: new Date("2026-06-12T09:05:00.000Z").getTime(),
      liveBaseVersion: "20260606",
      livePredictionCount: 20,
      showScheduleGhosts: true,
      includeLowConfidence: false,
      collectDiagnostics: true,
      liveEnrichmentComplete: true,
    });

    const ghosts = result.vehicles.filter(
      (vehicle) => vehicle.isScheduledGhostCandidate,
    );
    const summary = parseSummary(result.diagnostics);

    expect(summary.activeScheduledJourneys).toBe(12);
    expect(summary.liveVehicleCount).toBe(10);
    expect(summary.matchedScheduledToLive).toBe(10);
    expect(summary.visibleScheduleGhosts).toBe(2);
    expect(summary.explainedTotal).toBe(12);
    expect(ghosts).toHaveLength(2);
    expect(ghosts.every((ghost) => ghost.scheduledGhostConfidence === "high")).toBe(
      true,
    );
  });

  it("hides unmatched journeys when they are grace-only weak candidates", () => {
    const result = appendScheduledGhostVehicles({
      routeId: "test",
      route,
      layout: LOOP_LAYOUT,
      vehicles: Array.from({ length: 10 }, (_, index) => liveVehicle(index + 1)),
      schedule: schedule(12),
      now: new Date("2026-06-12T09:18:00.000Z").getTime(),
      dataUpdatedAt: new Date("2026-06-12T09:18:00.000Z").getTime(),
      liveBaseVersion: "20260606",
      livePredictionCount: 20,
      showScheduleGhosts: true,
      includeLowConfidence: false,
      collectDiagnostics: true,
      liveEnrichmentComplete: true,
    });

    const ghosts = result.vehicles.filter(
      (vehicle) => vehicle.isScheduledGhostCandidate,
    );
    const summary = parseSummary(result.diagnostics);

    expect(summary.activeScheduledJourneys).toBe(12);
    expect(summary.visibleScheduleGhosts).toBe(0);
    expect(summary.hiddenOrBlockedCandidates).toBeGreaterThanOrEqual(2);
    expect(ghosts).toHaveLength(0);
  });

  it("reports active scheduled run states for advanced diagnostics", () => {
    const result = appendScheduledGhostVehicles({
      routeId: "test",
      route,
      layout: LOOP_LAYOUT,
      vehicles: [liveVehicle(1)],
      schedule: schedule(2),
      now: new Date("2026-06-12T09:05:00.000Z").getTime(),
      dataUpdatedAt: new Date("2026-06-12T09:05:00.000Z").getTime(),
      liveBaseVersion: "20260606",
      livePredictionCount: 2,
      showScheduleGhosts: true,
      includeLowConfidence: false,
      collectDiagnostics: true,
      liveEnrichmentComplete: true,
    });

    const activeRuns = result.diagnostics.filter((diagnostic) =>
      diagnostic.startsWith("Schedule active run: "),
    );
    expect(activeRuns).toHaveLength(2);
    expect(activeRuns[0]).toContain("\"matchedToLive\":true");
    expect(activeRuns[1]).toContain("\"displayedAsGhost\":true");
  });

  it("returns a structured route ghost comparison summary", () => {
    const result = appendScheduledGhostVehicles({
      routeId: "test",
      route,
      layout: LOOP_LAYOUT,
      vehicles: Array.from({ length: 10 }, (_, index) => liveVehicle(index + 1)),
      schedule: schedule(12),
      now: new Date("2026-06-12T09:05:00.000Z").getTime(),
      dataUpdatedAt: new Date("2026-06-12T09:05:00.000Z").getTime(),
      liveBaseVersion: "20260606",
      livePredictionCount: 20,
      showScheduleGhosts: true,
      includeLowConfidence: false,
      collectDiagnostics: true,
      liveEnrichmentComplete: true,
    });

    expect(result.ghostComparisonSummary).toEqual(
      expect.objectContaining({
        routeId: "test",
        routeScheduleLoaded: true,
        liveTflVehicleCount: 10,
        activeScheduledJourneyCount: 12,
        routeLevelSanityCapValue: 2,
      }),
    );
    expect(
      result.ghostComparisonSummary?.visibleScheduleGhostRunningNumbers,
    ).toEqual(["111", "112"]);
    expect(
      result.ghostComparisonSummary?.matchedActiveScheduledRunningNumbers,
    ).toContain("101");
  });

  it("classifies multiple debug runs", () => {
    const result = appendScheduledGhostVehicles({
      routeId: "test",
      route,
      layout: LOOP_LAYOUT,
      vehicles: [liveVehicle(1)],
      schedule: schedule(2),
      now: new Date("2026-06-12T09:05:00.000Z").getTime(),
      dataUpdatedAt: new Date("2026-06-12T09:05:00.000Z").getTime(),
      liveBaseVersion: "20260606",
      livePredictionCount: 2,
      showScheduleGhosts: true,
      includeLowConfidence: false,
      collectDiagnostics: true,
      debugRunningNos: ["101", "102", "999"],
      liveEnrichmentComplete: true,
    });

    expect(result.ghostRunDiagnostics).toHaveLength(3);
    expect(result.ghostRunDiagnostics?.[0]).toEqual(
      expect.objectContaining({
        runningNo: "101",
        displayedAsLive: true,
      }),
    );
    expect(result.ghostRunDiagnostics?.[1]).toEqual(
      expect.objectContaining({
        runningNo: "102",
        displayedAsScheduleGhost: true,
      }),
    );
    expect(result.ghostRunDiagnostics?.[2]).toEqual(
      expect.objectContaining({
        runningNo: "999",
        presentInSchedule: false,
      }),
    );
  });

  it("reports visible feed and disappeared ghosts separately", () => {
    const feed = {
      ...liveVehicle(20),
      ghostSource: "feed" as const,
      ibusRunningNo: "720",
    };
    const disappeared = {
      ...liveVehicle(21),
      ghostSource: "disappeared" as const,
      ibusRunningNo: "721",
    };

    const result = appendScheduledGhostVehicles({
      routeId: "test",
      route,
      layout: LOOP_LAYOUT,
      vehicles: [feed, disappeared],
      schedule: null,
      now: new Date("2026-06-12T09:05:00.000Z").getTime(),
      dataUpdatedAt: new Date("2026-06-12T09:05:00.000Z").getTime(),
      showScheduleGhosts: true,
      includeLowConfidence: false,
      collectDiagnostics: true,
    });

    expect(result.ghostComparisonSummary?.visibleFeedGhostRunningNumbers).toEqual([
      "720",
    ]);
    expect(
      result.ghostComparisonSummary?.visibleDisappearedGhostRunningNumbers,
    ).toEqual(["721"]);
    expect(result.ghostComparisonSummary?.feedGhostLifecycleNote).toContain(
      "local-only",
    );
  });

  it("does not let an unresolved extra live vehicle cap high-confidence missing scheduled runs", () => {
    const unresolvedLive = {
      ...liveVehicleForRunningNo("999"),
      vehicleId: "live-unresolved",
      ibusRunningNo: undefined,
      ibusBlockNo: undefined,
      tripId: "extra-live-trip",
      nextPrediction: {
        ...liveVehicleForRunningNo("999").nextPrediction,
        id: "prediction-unresolved",
        vehicleId: "live-unresolved",
        tripId: "extra-live-trip",
      },
    };

    const result = appendScheduledGhostVehicles({
      routeId: "test",
      route,
      layout: LOOP_LAYOUT,
      vehicles: [
        "561",
        "563",
        "564",
        "565",
        "566",
        "567",
        "568",
      ].map(liveVehicleForRunningNo).concat(unresolvedLive),
      schedule: scheduleForRunningNos([
        "561",
        "562",
        "563",
        "564",
        "565",
        "566",
        "567",
        "568",
        "570",
      ]),
      now: new Date("2026-06-12T09:05:00.000Z").getTime(),
      dataUpdatedAt: new Date("2026-06-12T09:05:00.000Z").getTime(),
      liveBaseVersion: "20260606",
      livePredictionCount: 8,
      showScheduleGhosts: true,
      includeLowConfidence: false,
      collectDiagnostics: true,
      debugRunningNos: ["562", "570"],
      liveEnrichmentComplete: true,
    });

    const ghosts = result.vehicles.filter(
      (vehicle) => vehicle.isScheduledGhostCandidate,
    );

    expect(
      ghosts.map((ghost) => ghost.scheduledGhostRunningNo).sort(),
    ).toEqual(["562", "570"]);
    expect(
      result.ghostComparisonSummary?.scheduledMissingLiveRunningNumbers,
    ).toEqual(["562", "570"]);
    expect(
      result.ghostComparisonSummary?.visibleScheduleGhostRunningNumbers,
    ).toEqual(["562", "570"]);
    expect(
      result.ghostComparisonSummary?.routeLevelSanityCapHiddenRunningNumbers,
    ).toEqual([]);
    expect(
      result.ghostComparisonSummary?.liveVehiclesWithoutResolvedRunningNumber,
    ).toBe(1);
    expect(result.ghostComparisonSummary?.sanityWarnings).toHaveLength(1);
    expect(result.ghostRunDiagnostics).toEqual([
      expect.objectContaining({
        runningNo: "562",
        displayedAsScheduleGhost: true,
      }),
      expect.objectContaining({
        runningNo: "570",
        displayedAsScheduleGhost: true,
      }),
    ]);
  });
});
