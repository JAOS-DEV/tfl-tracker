import { describe, expect, it } from "vitest";
import { groupArrivalsByRoute } from "@/lib/stopArrivalsGrouping";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";

function createPrediction(
  overrides: Partial<NormalizedVehiclePrediction>,
): NormalizedVehiclePrediction {
  return {
    id: "pred-1",
    routeId: "337",
    routeNumber: "337",
    naptanId: "490000001A",
    stopName: "Stop A",
    destinationName: "Richmond",
    direction: "outbound",
    timeToStation: 180,
    expectedArrival: "2026-01-01T12:00:00Z",
    ...overrides,
  };
}

describe("groupArrivalsByRoute", () => {
  it("groups predictions by route and prioritises active routes", () => {
    const groups = groupArrivalsByRoute(
      [
        createPrediction({ id: "1", routeId: "220", routeNumber: "220" }),
        createPrediction({ id: "2", routeId: "337", routeNumber: "337", timeToStation: 120 }),
        createPrediction({ id: "3", routeId: "337", routeNumber: "337", timeToStation: 300 }),
      ],
      ["337"],
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.routeNumber).toBe("337");
    expect(groups[0]?.isActiveRoute).toBe(true);
    expect(groups[0]?.predictions).toHaveLength(2);
    expect(groups[1]?.routeNumber).toBe("220");
    expect(groups[1]?.isActiveRoute).toBe(false);
  });
});
