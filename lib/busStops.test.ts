import { describe, expect, it } from "vitest";
import {
  isBusModePrediction,
  isTfLBusStopCandidate,
  isTransportHubStop,
} from "@/lib/busStops";

describe("busStops", () => {
  it("detects TfL transport hub stop ids", () => {
    expect(isTransportHubStop("HUBCLJ")).toBe(true);
    expect(isTransportHubStop("490000050D")).toBe(false);
  });

  it("accepts individual bus stops and rejects interchange hubs", () => {
    expect(
      isTfLBusStopCandidate({
        id: "490000050D",
        modes: ["bus"],
      }),
    ).toBe(true);

    expect(
      isTfLBusStopCandidate({
        id: "HUBCLJ",
        modes: ["bus", "overground", "national-rail"],
      }),
    ).toBe(false);

    expect(
      isTfLBusStopCandidate({
        id: "490000050G",
        stopType: "TransportInterchange",
        modes: ["bus"],
      }),
    ).toBe(false);
  });

  it("filters predictions to bus mode only", () => {
    expect(isBusModePrediction({ modeName: "bus" })).toBe(true);
    expect(isBusModePrediction({ modeName: "overground" })).toBe(false);
  });
});
