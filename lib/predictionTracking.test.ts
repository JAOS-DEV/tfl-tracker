import { describe, expect, it } from "vitest";
import {
  buildPredictionSnapshot,
  detectDisappearedPredictions,
  detectReappearedPredictions,
  isPredictionDataStale,
  resolvePredictionConfidence,
  updatePredictionTracking,
} from "@/lib/predictionTracking";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";

const basePrediction: NormalizedVehiclePrediction = {
  id: "pred-1",
  routeId: "337",
  routeNumber: "337",
  naptanId: "490000001A",
  stopName: "Stop A",
  destinationName: "Richmond",
  direction: "outbound",
  timeToStation: 180,
  expectedArrival: "2026-06-11T12:00:00Z",
  vehicleId: "BUS1",
};

describe("prediction tracking", () => {
  it("builds a snapshot of prediction keys", () => {
    expect(buildPredictionSnapshot([basePrediction])).toEqual(new Set(["BUS1"]));
  });

  it("marks predictions missing after one refresh", () => {
    const first = updatePredictionTracking(new Map(), [basePrediction], 1000);
    const second = updatePredictionTracking(first.states, [], 2000);
    const state = second.states.get("BUS1");

    expect(second.disappeared).toContain("BUS1");
    expect(state?.missingRefreshCount).toBe(1);
    expect(
      resolvePredictionConfidence(state, 2000, 2000),
    ).toBe("missing");
  });

  it("marks predictions disappeared after multiple refreshes", () => {
    let states = new Map();
    states = updatePredictionTracking(states, [basePrediction], 1000).states;
    states = updatePredictionTracking(states, [], 2000).states;
    const third = updatePredictionTracking(states, [], 3000);
    const state = third.states.get("BUS1");

    expect(state?.missingRefreshCount).toBe(2);
    expect(
      resolvePredictionConfidence(state, 3000, 3000),
    ).toBe("disappeared");
  });

  it("detects reappeared predictions", () => {
    let states = new Map();
    states = updatePredictionTracking(states, [basePrediction], 1000).states;
    states = updatePredictionTracking(states, [], 2000).states;
    const third = updatePredictionTracking(states, [basePrediction], 3000);

    expect(third.reappeared).toContain("BUS1");
    expect(
      resolvePredictionConfidence(third.states.get("BUS1"), 3000, 3000),
    ).toBe("reappeared");
  });

  it("detects stale prediction data", () => {
    const now = Date.now();
    const staleAt = now - 120_000;
    expect(isPredictionDataStale(staleAt, now)).toBe(true);
    expect(isPredictionDataStale(now, now)).toBe(false);
  });

  it("compares snapshots for disappeared and reappeared keys", () => {
    const previous = new Set(["BUS1", "BUS2"]);
    const current = new Set(["BUS2", "BUS3"]);
    const previousStates = new Map([
      [
        "BUS3",
        {
          key: "BUS3",
          vehicleId: "BUS3",
          missingRefreshCount: 1,
          lastSeenAt: 1000,
          justReappeared: false,
          wasDueSoon: false,
        },
      ],
    ]);

    expect(detectDisappearedPredictions(previous, current)).toEqual(["BUS1"]);
    expect(detectReappearedPredictions(previousStates, current)).toEqual([
      "BUS3",
    ]);
  });
});
