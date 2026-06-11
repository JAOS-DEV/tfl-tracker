import { describe, expect, it } from "vitest";
import {
  normalizeLineSearch,
  normalizePredictions,
  normalizeRouteSequence,
  predictionsForStop,
} from "@/lib/tfl/normalizers";
import type { TflPrediction } from "@/lib/tfl/types";

describe("normalizeRouteSequence", () => {
  it("maps inbound and outbound stop sequences", () => {
    const route = normalizeRouteSequence("337", {
      lineId: "337",
      lineName: "337",
      stopPointSequences: [
        {
          direction: "outbound",
          stopPoint: [
            {
              id: "1",
              name: "Stop A",
              lat: 0,
              lon: 0,
              naptanId: "490000001A",
              stopLetter: "A",
            },
          ],
        },
        {
          direction: "inbound",
          stopPoint: [
            {
              id: "2",
              name: "Stop B",
              lat: 0,
              lon: 0,
              naptanId: "490000002B",
            },
          ],
        },
      ],
    });

    expect(route.routeId).toBe("337");
    expect(route.outbound).toHaveLength(1);
    expect(route.inbound).toHaveLength(1);
    expect(route.outbound[0]?.name).toBe("Stop A");
    expect(route.outbound[0]?.stopLetter).toBe("A");
  });
});

describe("normalizePredictions", () => {
  it("preserves line id and arrival metadata", () => {
    const predictions: TflPrediction[] = [
      {
        id: "1",
        lineId: "337",
        lineName: "337",
        naptanId: "490000001A",
        stationName: "Stop A",
        destinationName: "Richmond",
        direction: "outbound",
        timeToStation: 240,
        expectedArrival: "2026-06-11T12:04:00Z",
        vehicleId: "LTZ123",
        modeName: "bus",
        timestamp: "2026-06-11T12:00:00Z",
      },
    ];

    const normalized = normalizePredictions(predictions);

    expect(normalized[0]?.routeId).toBe("337");
    expect(normalized[0]?.routeNumber).toBe("337");
    expect(normalized[0]?.vehicleId).toBe("LTZ123");
  });
});

describe("predictionsForStop", () => {
  it("returns predictions sorted by time to station", () => {
    const predictions = normalizePredictions([
      {
        id: "2",
        lineId: "337",
        lineName: "337",
        naptanId: "490000001A",
        stationName: "Stop A",
        destinationName: "Richmond",
        direction: "outbound",
        timeToStation: 600,
        expectedArrival: "2026-06-11T12:10:00Z",
        modeName: "bus",
        timestamp: "2026-06-11T12:00:00Z",
      },
      {
        id: "1",
        lineId: "337",
        lineName: "337",
        naptanId: "490000001A",
        stationName: "Stop A",
        destinationName: "Richmond",
        direction: "outbound",
        timeToStation: 120,
        expectedArrival: "2026-06-11T12:02:00Z",
        modeName: "bus",
        timestamp: "2026-06-11T12:00:00Z",
      },
    ]);

    const forStop = predictionsForStop(predictions, "490000001A");

    expect(forStop).toHaveLength(2);
    expect(forStop[0]?.timeToStation).toBe(120);
  });
});

describe("normalizeLineSearch", () => {
  it("filters to bus routes only from TfL search response", () => {
    const results = normalizeLineSearch({
      searchMatches: [
        { lineId: "337", lineName: "337", mode: "bus" },
        { lineId: "piccadilly", lineName: "Piccadilly", mode: "tube" },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("337");
    expect(results[0]?.modeName).toBe("bus");
  });
});
