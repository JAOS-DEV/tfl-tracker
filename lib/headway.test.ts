import { describe, expect, it } from "vitest";
import { calculateHeadway, calculateRouteSummary } from "@/lib/headway";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";

const basePrediction: NormalizedVehiclePrediction = {
  id: "1",
  routeId: "337",
  routeNumber: "337",
  naptanId: "490000001A",
  stopName: "Stop A",
  destinationName: "Richmond",
  direction: "outbound",
  timeToStation: 240,
  expectedArrival: "2026-06-11T12:04:00Z",
  vehicleId: "BUS1",
};

describe("calculateHeadway", () => {
  it("returns next and gap minutes", () => {
    const headway = calculateHeadway([
      basePrediction,
      {
        ...basePrediction,
        id: "2",
        vehicleId: "BUS2",
        timeToStation: 720,
        expectedArrival: "2026-06-11T12:12:00Z",
      },
    ]);

    expect(headway.nextMinutes).toBe(4);
    expect(headway.gapMinutes).toBe(8);
  });

  it("handles empty predictions", () => {
    expect(calculateHeadway([])).toEqual({
      nextMinutes: null,
      gapMinutes: null,
    });
  });
});

describe("calculateRouteSummary", () => {
  it("summarizes live vehicles and average gap", () => {
    const summary = calculateRouteSummary([
      basePrediction,
      {
        ...basePrediction,
        id: "2",
        vehicleId: "BUS2",
        timeToStation: 720,
        expectedArrival: "2026-06-11T12:12:00Z",
      },
    ]);

    expect(summary.liveVehicleCount).toBe(2);
    expect(summary.averageGapMinutes).toBe(8);
    expect(summary.earliestArrival).toBe("2026-06-11T12:04:00Z");
    expect(summary.latestArrival).toBe("2026-06-11T12:12:00Z");
  });
});
