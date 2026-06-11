import { describe, expect, it } from "vitest";
import {
  buildRouteAlertBadges,
  calculateHeadway,
  calculateRouteSummary,
  detectBunching,
  detectLargeGap,
} from "@/lib/headway";
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
  it("summarizes live vehicles, gaps, and busiest stop", () => {
    const summary = calculateRouteSummary([
      basePrediction,
      {
        ...basePrediction,
        id: "2",
        vehicleId: "BUS2",
        naptanId: "490000001A",
        timeToStation: 720,
        expectedArrival: "2026-06-11T12:12:00Z",
      },
      {
        ...basePrediction,
        id: "3",
        vehicleId: "BUS3",
        naptanId: "490000002B",
        stopName: "Stop B",
        timeToStation: 900,
        expectedArrival: "2026-06-11T12:15:00Z",
      },
    ]);

    expect(summary.liveVehicleCount).toBe(3);
    expect(summary.averageGapMinutes).toBeGreaterThan(0);
    expect(summary.largestGapMinutes).toBeGreaterThanOrEqual(
      summary.averageGapMinutes ?? 0,
    );
    expect(summary.busiestStopName).toBe("Stop A");
    expect(summary.busiestStopCount).toBe(2);
  });
});

describe("gap and bunching detection", () => {
  it("detects large predicted gaps", () => {
    const predictions = [
      basePrediction,
      {
        ...basePrediction,
        id: "2",
        vehicleId: "BUS2",
        expectedArrival: "2026-06-11T12:20:00Z",
      },
    ];

    expect(detectLargeGap(predictions)).toBe(true);
    expect(detectBunching(predictions)).toBe(false);
  });

  it("detects possible bunching", () => {
    const predictions = [
      basePrediction,
      {
        ...basePrediction,
        id: "2",
        vehicleId: "BUS2",
        expectedArrival: "2026-06-11T12:05:00Z",
      },
    ];

    expect(detectBunching(predictions)).toBe(true);
  });

  it("builds alert badges", () => {
    const badges = buildRouteAlertBadges(
      calculateRouteSummary([
        basePrediction,
        {
          ...basePrediction,
          id: "2",
          vehicleId: "BUS2",
          expectedArrival: "2026-06-11T12:05:00Z",
        },
      ]),
    );

    expect(badges.some((badge) => badge.id === "bunching")).toBe(true);
  });
});
