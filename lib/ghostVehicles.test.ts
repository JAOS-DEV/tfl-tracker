import { describe, expect, it } from "vitest";
import { appendTrackedGhostVehicles } from "@/lib/ghostVehicles";
import type {
  NormalizedVehiclePrediction,
  PredictionTrackingState,
} from "@/lib/tfl/types";

const prediction: NormalizedVehiclePrediction = {
  id: "pred-1",
  routeId: "14",
  routeNumber: "14",
  naptanId: "490000001A",
  stopName: "Stop A",
  destinationName: "Russell Square",
  direction: "outbound",
  timeToStation: 60,
  expectedArrival: "2026-06-12T09:05:00.000Z",
  vehicleId: "BUS124",
};

describe("appendTrackedGhostVehicles", () => {
  it("keeps last-known iBus details on local feed/disappeared ghosts", () => {
    const now = new Date("2026-06-12T09:05:00.000Z").getTime();
    const state: PredictionTrackingState = {
      key: "BUS124",
      vehicleId: "BUS124",
      missingRefreshCount: 2,
      lastSeenAt: now - 60_000,
      justReappeared: false,
      lastTimeToStation: 60,
      wasDueSoon: true,
      lastPrediction: prediction,
      lastProgress: 0.4,
      lastX: 120,
      lastY: 160,
      lastVehicleRegistration: "LT124",
      lastIbusRunningNo: "124",
      lastIbusBlockNo: "B124",
    };

    const vehicles = appendTrackedGhostVehicles(
      [],
      new Map([["BUS124", state]]),
      now,
      now,
    );

    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]).toEqual(
      expect.objectContaining({
        vehicleId: "BUS124",
        vehicleRegistration: "LT124",
        ibusRunningNo: "124",
        ibusBlockNo: "B124",
        ghostSource: "disappeared",
      }),
    );
  });
});
