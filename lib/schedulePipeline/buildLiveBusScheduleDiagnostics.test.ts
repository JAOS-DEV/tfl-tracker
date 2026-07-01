import { describe, expect, it } from "vitest";
import { buildLiveBusScheduleDiagnostic } from "@/lib/schedulePipeline/buildLiveBusScheduleDiagnostics";
import type { IndexedVehicleTimingResult } from "@/lib/schedulePipeline/types";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

describe("buildLiveBusScheduleDiagnostic", () => {
  it("reports a trusted match even when the ghost-active pool is empty", () => {
    const vehicle = {
      vehicleId: "BUS1",
      routeNumber: "14",
      matched: true,
      adherence: "onTime",
      scheduleStatus: "onTime",
      ghostStatus: "normal",
      nextStop: { id: "A", name: "Stop A", naptanId: "A" },
    } as EstimatedVehiclePosition;
    const timing = {
      vehicleId: "BUS1",
      rawDeviationMinutes: 0,
      matchReason: "runningNo/blockNo",
      display: {
        candidateMatch: true,
        trustedTiming: true,
        deviationMinutes: 0,
        scheduleStatus: "onTime",
        scheduleStatusLabel: "On time",
        scheduleMatchConfidence: "high",
        matchedScheduledTime: "2026-07-01T01:00:00.000Z",
        matchedStopName: "Stop A",
        scheduleDataAvailable: true,
        scheduleExplanation: "Matched",
      },
    } satisfies IndexedVehicleTimingResult;

    const diagnostic = buildLiveBusScheduleDiagnostic("14", vehicle, timing, {
      routeScheduleLoaded: true,
      routeScheduleLoading: false,
      activeScheduleCount: 0,
    });

    expect(diagnostic.unknownReason).toBe("trusted-schedule");
  });

  it("audits whether TfL expectedArrival agrees with timestamp plus timeToStation", () => {
    const vehicle = {
      vehicleId: "BUS1",
      routeNumber: "14",
      matched: true,
      adherence: "unknown",
      scheduleStatus: "unknown",
      ghostStatus: "normal",
      expectedArrival: "2026-07-01T01:32:05.000Z",
      timeToStation: 120,
      nextPrediction: {
        timestamp: "2026-07-01T01:30:00.000Z",
      },
      nextStop: { id: "A", name: "Stop A", naptanId: "A" },
    } as EstimatedVehiclePosition;

    const diagnostic = buildLiveBusScheduleDiagnostic("14", vehicle, undefined, {
      routeScheduleLoaded: true,
      routeScheduleLoading: false,
      activeScheduleCount: 1,
    });

    expect(diagnostic.liveTimingAudit).toEqual({
      apiTimestampUtc: "2026-07-01T01:30:00.000Z",
      timeToStationSeconds: 120,
      expectedArrivalUtc: "2026-07-01T01:32:05.000Z",
      timestampPlusTimeToStationUtc: "2026-07-01T01:32:00.000Z",
      consistencyDifferenceSeconds: 5,
    });
  });
});
