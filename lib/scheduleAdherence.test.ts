import { describe, expect, it } from "vitest";
import {
  applyScheduleAdherence,
  estimateScheduleAdherence,
} from "@/lib/scheduleAdherence";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

const baseVehicle: EstimatedVehiclePosition = {
  vehicleId: "BUS1",
  routeNumber: "337",
  direction: "outbound",
  destinationName: "Richmond",
  expectedArrival: "2026-06-11T12:04:00Z",
  timeToStation: 240,
  nextPrediction: {
    id: "1",
    routeId: "337",
    routeNumber: "337",
    naptanId: "490000002B",
    stopName: "Stop B",
    destinationName: "Richmond",
    direction: "outbound",
    timeToStation: 240,
    expectedArrival: "2026-06-11T12:04:00Z",
    vehicleId: "BUS1",
  },
  nextStop: {
    id: "2",
    name: "Stop B",
    naptanId: "490000002B",
    isTimingPoint: false,
  },
  stopIndex: 1,
  progress: 0.2,
  x: 200,
  y: 130,
  matched: true,
  adherence: "onTime",
};

describe("estimateScheduleAdherence", () => {
  it("marks a trailing vehicle as late compared to one further along", () => {
    const ahead: EstimatedVehiclePosition = {
      ...baseVehicle,
      vehicleId: "BUS2",
      stopIndex: 3,
      timeToStation: 120,
    };
    const behind: EstimatedVehiclePosition = {
      ...baseVehicle,
      vehicleId: "BUS1",
      stopIndex: 1,
      timeToStation: 500,
    };

    expect(estimateScheduleAdherence(behind, [behind, ahead])).toBe("late");
  });

  it("marks a leading vehicle as early compared to one further behind", () => {
    const ahead: EstimatedVehiclePosition = {
      ...baseVehicle,
      vehicleId: "BUS2",
      stopIndex: 3,
      timeToStation: 30,
    };
    const behind: EstimatedVehiclePosition = {
      ...baseVehicle,
      vehicleId: "BUS1",
      stopIndex: 1,
      timeToStation: 420,
    };

    expect(estimateScheduleAdherence(ahead, [behind, ahead])).toBe("early");
  });

  it("applies adherence to all vehicles", () => {
    const vehicles = applyScheduleAdherence([
      baseVehicle,
      { ...baseVehicle, vehicleId: "BUS2", stopIndex: 2, timeToStation: 180 },
    ]);

    expect(vehicles.every((vehicle) => vehicle.adherence)).toBe(true);
  });
});
