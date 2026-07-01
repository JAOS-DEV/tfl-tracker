import { describe, expect, it } from "vitest";
import {
  normalizeLineSearch,
  normalizeNearbyStops,
  normalizePredictions,
  normalizeBusPredictions,
  normalizeRouteSequence,
  normalizeStopSearch,
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
    expect(route.outbound[0]?.lat).toBeUndefined();
    expect(route.outbound[0]?.lon).toBeUndefined();
  });

  it("preserves valid stop coordinates from TfL route sequence", () => {
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
              lat: 51.4612,
              lon: -0.215,
              naptanId: "490000001A",
            },
          ],
        },
      ],
    });

    expect(route.outbound[0]?.lat).toBe(51.4612);
    expect(route.outbound[0]?.lon).toBe(-0.215);
  });

  it("preserves TfL road geometry for each route direction", () => {
    const route = normalizeRouteSequence("22", {
      lineId: "22",
      lineName: "22",
      lineStrings: [
        "[[[-0.228249,51.468027],[-0.227806,51.468388]]]",
        "[[[-0.142204,51.515973],[-0.141741,51.514581]]]",
      ],
      stopPointSequences: [
        { direction: "outbound", stopPoint: [] },
        { direction: "inbound", stopPoint: [] },
      ],
    });

    expect(route.routePaths?.outbound).toEqual([
      [
        { lat: 51.468027, lon: -0.228249 },
        { lat: 51.468388, lon: -0.227806 },
      ],
    ]);
    expect(route.routePaths?.inbound).toEqual([
      [
        { lat: 51.515973, lon: -0.142204 },
        { lat: 51.514581, lon: -0.141741 },
      ],
    ]);
  });

  it("ignores malformed TfL road geometry", () => {
    const route = normalizeRouteSequence("22", {
      lineStrings: ["not-json", "[[[999,51.5],[0,0]]]"],
      stopPointSequences: [
        { direction: "outbound", stopPoint: [] },
        { direction: "inbound", stopPoint: [] },
      ],
    });

    expect(route.routePaths).toBeUndefined();
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
    expect(normalized[0]?.vehicleRegistration).toBeUndefined();
  });

  it("extracts registration plates from vehicle ids", () => {
    const normalized = normalizePredictions([
      {
        id: "2",
        lineId: "37",
        lineName: "37",
        naptanId: "490000001A",
        stationName: "Stop A",
        destinationName: "Putney Heath",
        direction: "inbound",
        timeToStation: 240,
        expectedArrival: "2026-06-11T12:04:00Z",
        vehicleId: "BV66VKT",
        modeName: "bus",
        timestamp: "2026-06-11T12:00:00Z",
      },
    ]);

    expect(normalized[0]?.vehicleRegistration).toBe("BV66VKT");
  });

  it("extracts route 22 and 74 style registration plates from vehicle ids", () => {
    const normalized = normalizePredictions([
      {
        id: "22-1",
        lineId: "22",
        lineName: "22",
        naptanId: "490000001A",
        stationName: "Stop A",
        destinationName: "Putney Bridge",
        direction: "outbound",
        timeToStation: 240,
        expectedArrival: "2026-06-11T12:04:00Z",
        vehicleId: "LX75ZGV",
        modeName: "bus",
        timestamp: "2026-06-11T12:00:00Z",
      },
      {
        id: "74-1",
        lineId: "74",
        lineName: "74",
        naptanId: "490000002B",
        stationName: "Stop B",
        destinationName: "Wimbledon",
        direction: "inbound",
        timeToStation: 180,
        expectedArrival: "2026-06-11T12:03:00Z",
        vehicleId: "YY66OZO",
        modeName: "bus",
        timestamp: "2026-06-11T12:00:00Z",
      },
    ]);

    expect(normalized[0]?.vehicleRegistration).toBe("LX75ZGV");
    expect(normalized[1]?.vehicleRegistration).toBe("YY66OZO");
  });

  it("extracts fleet references from operator-style vehicle ids", () => {
    const normalized = normalizePredictions([
      {
        id: "3",
        lineId: "12",
        lineName: "12",
        naptanId: "490000001A",
        stationName: "Stop A",
        destinationName: "Dulwich",
        direction: "outbound",
        timeToStation: 240,
        expectedArrival: "2026-06-11T12:04:00Z",
        vehicleId: "LTZ1049",
        modeName: "bus",
        timestamp: "2026-06-11T12:00:00Z",
      },
    ]);

    expect(normalized[0]?.vehicleRegistration).toBeUndefined();
    expect(normalized[0]?.vehicleFleetReference).toBe("LTZ1049");
  });

  it("keeps registration and fleet parsing mutually exclusive for live vehicle ids", () => {
    const cases = [
      {
        vehicleId: "LX75ZGV",
        registration: "LX75ZGV",
        fleet: undefined,
      },
      {
        vehicleId: "LV25XUA",
        registration: "LV25XUA",
        fleet: undefined,
      },
      {
        vehicleId: "DEL92",
        registration: undefined,
        fleet: "DEL92",
      },
      {
        vehicleId: "WHV162",
        registration: undefined,
        fleet: "WHV162",
      },
      {
        vehicleId: "3047",
        registration: undefined,
        fleet: undefined,
      },
    ] as const;

    for (const testCase of cases) {
      const [normalized] = normalizePredictions([
        {
          id: testCase.vehicleId,
          lineId: "22",
          lineName: "22",
          naptanId: "490000001A",
          stationName: "Stop A",
          destinationName: "Putney Bridge",
          direction: "outbound",
          timeToStation: 120,
          expectedArrival: "2026-06-11T12:04:00Z",
          vehicleId: testCase.vehicleId,
          modeName: "bus",
          timestamp: "2026-06-11T12:00:00Z",
        },
      ]);

      expect(normalized?.vehicleRegistration).toBe(testCase.registration);
      expect(normalized?.vehicleFleetReference).toBe(testCase.fleet);
    }
  });

  it("preserves tripId and baseVersion from live predictions", () => {
    const normalized = normalizePredictions([
      {
        id: "4",
        lineId: "37",
        lineName: "37",
        naptanId: "490000001A",
        stationName: "Stop A",
        destinationName: "Putney Heath",
        direction: "inbound",
        timeToStation: 120,
        expectedArrival: "2026-06-11T12:02:00Z",
        vehicleId: "LV24EWY",
        tripId: "601608",
        baseVersion: "20260606",
        modeName: "bus",
        timestamp: "2026-06-11T12:00:00Z",
      },
    ]);

    expect(normalized[0]?.tripId).toBe("601608");
    expect(normalized[0]?.baseVersion).toBe("20260606");
  });

  it("preserves the TfL source timestamp for timing diagnostics", () => {
    const [normalized] = normalizePredictions([
      {
        id: "prediction-1",
        lineId: "14",
        lineName: "14",
        naptanId: "490000001A",
        stationName: "Stop A",
        destinationName: "Russell Square",
        direction: "inbound",
        timeToStation: 120,
        expectedArrival: "2026-07-01T01:32:00.000Z",
        modeName: "bus",
        timestamp: "2026-07-01T01:30:00.000Z",
      },
    ]);

    expect(normalized?.timestamp).toBe("2026-07-01T01:30:00.000Z");
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

describe("normalizeBusPredictions", () => {
  it("drops non-bus arrivals such as overground trains", () => {
    const normalized = normalizeBusPredictions([
      {
        id: "rail-1",
        lineId: "mildmay",
        lineName: "Mildmay",
        naptanId: "HUBCLJ",
        stationName: "Clapham Junction Rail Station",
        destinationName: "Stratford (London) Rail Station",
        direction: "",
        timeToStation: 120,
        expectedArrival: "2026-06-14T19:26:07Z",
        modeName: "overground",
        timestamp: "2026-06-14T19:26:02Z",
      },
      {
        id: "bus-1",
        lineId: "37",
        lineName: "37",
        naptanId: "490000050D",
        stationName: "Clapham Common Station",
        destinationName: "Putney Heath",
        direction: "outbound",
        timeToStation: 240,
        expectedArrival: "2026-06-14T19:30:00Z",
        modeName: "bus",
        timestamp: "2026-06-14T19:26:02Z",
      },
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.routeNumber).toBe("37");
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

describe("normalizeStopSearch", () => {
  it("filters to bus stops and normalizes route labels", () => {
    const results = normalizeStopSearch([
      {
        id: "490000001A",
        name: "Clapham Junction Station",
        stopLetter: "A",
        modes: ["bus"],
        lines: ["37", { id: "337", name: "337" }],
      },
      {
        id: "940GZZLUACT",
        name: "Acton Town",
        modes: ["tube"],
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      stopPointId: "490000001A",
      name: "Clapham Junction Station",
      stopLetter: "A",
      towards: undefined,
      modes: ["bus"],
      routesServed: ["37", "337"],
    });
  });

  it("excludes transport hub matches from bus stop search", () => {
    const results = normalizeStopSearch([
      {
        id: "HUBCLJ",
        name: "Clapham Junction",
        modes: ["bus", "overground", "national-rail"],
      },
      {
        id: "490000050D",
        name: "Clapham Common Station",
        modes: ["bus"],
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.stopPointId).toBe("490000050D");
  });
});

describe("normalizeNearbyStops", () => {
  it("sorts nearby bus stops by distance", () => {
    const results = normalizeNearbyStops([
      {
        id: "far",
        name: "Far Stop",
        modes: ["bus"],
        distance: 500,
      },
      {
        id: "near",
        name: "Near Stop",
        modes: ["bus"],
        distance: 50,
      },
    ]);

    expect(results.map((stop) => stop.stopPointId)).toEqual(["near", "far"]);
    expect(results[0]?.distanceMetres).toBe(50);
  });

  it("normalizes TfL nearby stop points that use commonName and naptanId", () => {
    const results = normalizeNearbyStops([
      {
        naptanId: "490000050G",
        commonName: "Clapham Common Station",
        indicator: "Stop G",
        modes: ["bus"],
        lines: [{ id: "37", name: "37" }],
        distance: 120,
      },
    ]);

    expect(results).toEqual([
      {
        stopPointId: "490000050G",
        name: "Clapham Common Station",
        stopLetter: "G",
        towards: undefined,
        modes: ["bus"],
        routesServed: ["37"],
        distanceMetres: 120,
      },
    ]);
  });

  it("derives stop letters from NaPTAN ids when TfL omits indicator data", () => {
    const results = normalizeStopSearch([
      {
        id: "4900000050D",
        name: "Clapham Common Station",
        modes: ["bus"],
        lines: ["37", "345"],
      },
      {
        id: "4900000050E",
        name: "Clapham Common Station",
        modes: ["bus"],
        lines: ["49"],
      },
    ]);

    expect(results.map((stop) => stop.stopLetter)).toEqual(["D", "E"]);
  });
});
