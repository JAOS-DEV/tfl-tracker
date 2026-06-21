import { describe, expect, it } from "vitest";
import { readLocalRouteSchedule } from "@/lib/ibus/testLocalFixtures";
import { normalizeRouteSchedule } from "@/lib/ibus/compactScheduleDecode";
import {
  buildBlueLiveBusScheduleDiagnostics,
  markerRingMeaning,
} from "@/lib/schedulePipeline/buildLiveBusScheduleDiagnostics";
import { buildLiveSchedulePool } from "@/lib/schedulePipeline/buildLiveSchedulePool";
import { buildScheduleIndexes } from "@/lib/schedulePipeline/buildScheduleIndexes";
import { matchLiveVehiclesToSchedule } from "@/lib/schedulePipeline/matchLiveVehicleToSchedule";
import { resolveAdherenceFromScheduleStatus } from "@/lib/ibusScheduleDeviation";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

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

describe("blue marker meaning", () => {
  it("uses sky blue for unknown schedule adherence on a positioned bus", () => {
    const vehicle = buildVehicle({
      scheduleStatus: "unknown",
      adherence: resolveAdherenceFromScheduleStatus("unknown"),
      matched: true,
    });

    expect(markerRingMeaning(vehicle)).toBe("unknownSchedule");
    expect(vehicle.matched).toBe(true);
  });

  it("does not treat trusted late buses as blue", () => {
    const vehicle = buildVehicle({
      scheduleStatus: "late",
      scheduleMatchConfidence: "medium",
      scheduleDeviationMinutes: 5,
      adherence: resolveAdherenceFromScheduleStatus("late"),
    });

    expect(markerRingMeaning(vehicle)).toBe("late");
  });

  it("never maps unknown schedule status to on-time adherence", () => {
    expect(resolveAdherenceFromScheduleStatus("unknown")).toBe("unknown");
    expect(resolveAdherenceFromScheduleStatus("onTime")).toBe("onTime");
  });
});

describe("live bus unknown diagnostics", () => {
  it("exposes unknown reason for blue buses", () => {
    const diagnostics = buildBlueLiveBusScheduleDiagnostics({
      routeId: "337",
      vehicles: [
        buildVehicle({
          scheduleStatus: "unknown",
          adherence: "unknown",
        }),
      ],
      timingResults: [
        {
          vehicleId: "BUS1",
          display: {
            candidateMatch: false,
            trustedTiming: false,
            deviationMinutes: null,
            scheduleStatus: "unknown",
            scheduleStatusLabel: "Schedule ?",
            scheduleMatchConfidence: "unknown",
            matchedScheduledTime: null,
            matchedStopName: "Stop A",
            scheduleDataAvailable: true,
            scheduleExplanation: "No matching active iBus journey for live bus",
            rejectionReason: "no-candidate-match",
          },
          rawDeviationMinutes: null,
          matchReason: null,
        },
      ],
      routeScheduleLoaded: true,
      routeScheduleLoading: false,
      activeScheduleCount: 1,
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.unknownReason).toBe("no-candidate-match");
    expect(diagnostics[0]?.positionKnown).toBe(true);
  });

  it("reports static-trip-not-found-live-version-differs for blue buses", () => {
    const diagnostics = buildBlueLiveBusScheduleDiagnostics({
      routeId: "337",
      vehicles: [
        buildVehicle({
          scheduleStatus: "unknown",
          adherence: "unknown",
          tripId: "639595",
          baseVersion: "20250619",
        }),
      ],
      timingResults: [
        {
          vehicleId: "BUS1",
          display: {
            candidateMatch: false,
            trustedTiming: false,
            deviationMinutes: null,
            scheduleStatus: "unknown",
            scheduleStatusLabel: "Schedule ?",
            scheduleMatchConfidence: "unknown",
            matchedScheduledTime: null,
            matchedStopName: "Stop A",
            scheduleDataAvailable: true,
            scheduleExplanation: "No matching active iBus journey for live bus",
            rejectionReason: "no-candidate-match",
          },
          rawDeviationMinutes: null,
          matchReason: null,
        },
      ],
      routeScheduleLoaded: true,
      routeScheduleLoading: false,
      activeScheduleCount: 10,
      liveDetails: new Map([
        [
          "BUS1",
          {
            runningLookupStatus: "static-trip-not-found-live-version-differs",
            liveBaseVersion: "20250619",
            staticBaseVersion: "20260606",
            baseVersionMatches: false,
            runningLookupNote:
              "TripId was not found in current static iBus data; live prediction reports a different baseVersion.",
          },
        ],
      ]),
    });

    expect(diagnostics[0]?.unknownReason).toBe(
      "static-trip-not-found-live-version-differs",
    );
  });

  it("reports missing next stop separately from position unmatched", () => {
    const diagnostics = buildBlueLiveBusScheduleDiagnostics({
      routeId: "337",
      vehicles: [
        buildVehicle({
          matched: true,
          nextStop: undefined,
          scheduleStatus: "unknown",
          adherence: "unknown",
        }),
      ],
      timingResults: [],
      routeScheduleLoaded: true,
      routeScheduleLoading: false,
      activeScheduleCount: 1,
    });

    expect(diagnostics[0]?.unknownReason).toBe("missing-next-stop");
  });
});

describe("route 14 schedule diagnostics fixture", () => {
  it("reports rejection counts for synthetic active journeys", () => {
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

    const vehicles = pool.activeJourneys.slice(0, 5).map((journey, index) =>
      buildVehicle({
        vehicleId: `BUS-${index}`,
        routeNumber: "14",
        tripId: journey.tripId,
        baseVersion: schedule!.baseVersion,
        ibusRunningNo: journey.runningNo,
        ibusBlockNo: journey.blockNo,
        nextStop: {
          id: journey.stops[0]?.stopCode ?? "1",
          name: journey.stops[0]?.stopName ?? "Stop A",
          naptanId: journey.stops[0]?.naptanId ?? "490000001A",
          isTimingPoint: false,
        },
      }),
    );

    const { timingResults } = matchLiveVehiclesToSchedule(
      vehicles,
      pool,
      indexes,
      route14,
    );

    const trustedCount = timingResults.filter(
      (result) => result.display.trustedTiming,
    ).length;
    const candidateCount = timingResults.filter(
      (result) => result.display.candidateMatch,
    ).length;

    expect(pool.activeJourneys.length).toBeGreaterThan(0);
    expect(pool.activeJourneys.length).toBeLessThan(100);
    expect(candidateCount).toBeGreaterThan(0);
    expect(trustedCount).toBeGreaterThan(0);
  });
});
