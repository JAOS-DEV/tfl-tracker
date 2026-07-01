import { describe, expect, it } from "vitest";
import {
  buildRouteMapVehicleMarkers,
  buildRouteDirectionMarkers,
  computeLeafletBounds,
  getGeographicStops,
  getRoutePolylineLatLngs,
  getRoutePolylinePathsLatLngs,
  getRoutePolylinePoints,
  hasRouteMapGeometry,
  projectGeoToSvg,
  resolveVehicleGeoPosition,
  ROUTE_MAP_UNAVAILABLE_MESSAGE,
} from "@/lib/routeMapGeometry";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
} from "@/lib/tfl/types";

const routeWithGeometry: NormalizedRoute = {
  routeId: "337",
  routeName: "337",
  outbound: [
    {
      id: "1",
      name: "Stop A",
      naptanId: "490000001A",
      lat: 51.46,
      lon: -0.21,
      isTimingPoint: false,
    },
    {
      id: "2",
      name: "Stop B",
      naptanId: "490000002B",
      lat: 51.47,
      lon: -0.2,
      isTimingPoint: false,
    },
    {
      id: "3",
      name: "Stop C",
      naptanId: "490000003C",
      lat: 51.48,
      lon: -0.19,
      isTimingPoint: false,
    },
  ],
  inbound: [],
};

const routeWithoutGeometry: NormalizedRoute = {
  routeId: "999",
  routeName: "999",
  outbound: [
    {
      id: "1",
      name: "Stop A",
      naptanId: "490000001A",
      isTimingPoint: false,
    },
  ],
  inbound: [],
};

function vehicle(
  overrides: Partial<EstimatedVehiclePosition> = {},
): EstimatedVehiclePosition {
  return {
    vehicleId: "LV24EUK",
    vehicleRegistration: "LV24EUK",
    routeNumber: "337",
    direction: "outbound",
    destinationName: "Clapham Junction",
    expectedArrival: "2026-06-14T12:00:00Z",
    timeToStation: 120,
    nextPrediction: {
      id: "pred-1",
      routeId: "337",
      routeNumber: "337",
      naptanId: "490000002B",
      stopName: "Stop B",
      direction: "outbound",
      destinationName: "Clapham Junction",
      expectedArrival: "2026-06-14T12:00:00Z",
      timeToStation: 120,
      vehicleId: "LV24EUK",
    },
    nextStop: routeWithGeometry.outbound[1] ?? null,
    stopIndex: 1,
    progress: 0.28,
    x: 0,
    y: 0,
    matched: true,
    adherence: "late",
    scheduleDeviationMinutes: 5,
    scheduleStatus: "late",
    scheduleStatusLabel: "Late +5",
    scheduleMatchConfidence: "high",
    matchedScheduledTime: null,
    matchedStopName: null,
    scheduleDataAvailable: true,
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    ibusRunningNo: "562",
    ibusFleetNo: "3049",
    ...overrides,
  } as EstimatedVehiclePosition;
}

describe("routeMapGeometry", () => {
  it("uses geographic stop coordinates from the route sequence", () => {
    expect(getGeographicStops(routeWithGeometry, "outbound")).toHaveLength(3);
    expect(hasRouteMapGeometry(routeWithGeometry, "outbound")).toBe(true);
  });

  it("handles missing geometry gracefully", () => {
    expect(hasRouteMapGeometry(routeWithoutGeometry, "outbound")).toBe(false);
    expect(ROUTE_MAP_UNAVAILABLE_MESSAGE).toMatch(/Map unavailable/i);
  });

  it("projects vehicle positions from existing live progress data", () => {
    const point = resolveVehicleGeoPosition(
      vehicle({ progress: 0.28 }),
      routeWithGeometry,
    );

    expect(point?.lat).toBeGreaterThan(51.46);
    expect(point?.lat).toBeLessThan(51.48);
    expect(point?.lon).toBeGreaterThan(-0.21);
  });

  it("builds map markers with registration and running labels available", () => {
    const markers = buildRouteMapVehicleMarkers(
      [vehicle()],
      routeWithGeometry,
      "outbound",
    );

    expect(markers).toHaveLength(1);
    expect(markers[0]?.vehicle.vehicleRegistration).toBe("LV24EUK");
    expect(markers[0]?.vehicle.ibusRunningNo).toBe("562");
  });

  it("projects coordinates into svg space", () => {
    const viewport = {
      minLat: 51.45,
      maxLat: 51.49,
      minLon: -0.22,
      maxLon: -0.18,
    };

    const projected = projectGeoToSvg(
      { lat: 51.47, lon: -0.2 },
      viewport,
      100,
      100,
    );

    expect(projected.x).toBeGreaterThan(0);
    expect(projected.y).toBeGreaterThan(0);
  });

  it("builds leaflet bounds and polyline coordinates", () => {
    const stops = getGeographicStops(routeWithGeometry, "outbound");

    expect(getRoutePolylineLatLngs(stops)).toEqual([
      [51.46, -0.21],
      [51.47, -0.2],
      [51.48, -0.19],
    ]);

    const bounds = computeLeafletBounds(stops);
    expect(bounds?.[0][0]).toBeLessThan(bounds?.[1][0] ?? 0);
    expect(bounds?.[0][1]).toBeLessThan(bounds?.[1][1] ?? 0);
  });

  it("snaps terminus layovers to the correct geographic endpoint", () => {
    expect(
      resolveVehicleGeoPosition(
        vehicle({
          markerState: "terminus-layover",
          terminusLayoverKind: "leg-start",
          progress: 0.25,
        }),
        routeWithGeometry,
      ),
    ).toEqual({ lat: 51.46, lon: -0.21 });

    expect(
      resolveVehicleGeoPosition(
        vehicle({
          markerState: "terminus-layover",
          terminusLayoverKind: "leg-end",
          progress: 0.25,
        }),
        routeWithGeometry,
      ),
    ).toEqual({ lat: 51.48, lon: -0.19 });
  });

  it("prefers road-following TfL geometry over stop-to-stop segments", () => {
    const route: NormalizedRoute = {
      ...routeWithGeometry,
      routePaths: {
        outbound: [
          [
            { lat: 51.46, lon: -0.21 },
            { lat: 51.465, lon: -0.208 },
            { lat: 51.47, lon: -0.2 },
          ],
        ],
      },
    };

    expect(getRoutePolylinePathsLatLngs(route, "outbound")).toEqual([
      [
        [51.46, -0.21],
        [51.465, -0.208],
        [51.47, -0.2],
      ],
    ]);
    expect(getRoutePolylinePoints(route, "outbound")).toHaveLength(3);
  });

  it("falls back to stop coordinates when TfL road geometry is unavailable", () => {
    expect(getRoutePolylinePathsLatLngs(routeWithGeometry, "outbound")).toEqual([
      [
        [51.46, -0.21],
        [51.47, -0.2],
        [51.48, -0.19],
      ],
    ]);
  });

  it("places direction arrows along the ordered route path", () => {
    const markers = buildRouteDirectionMarkers(
      [
        [
          [51.5, -0.2],
          [51.5, -0.19],
          [51.5, -0.18],
          [51.5, -0.17],
          [51.5, -0.16],
        ],
      ],
      3,
    );

    expect(markers).toHaveLength(3);
    expect(markers.every((marker) => marker.bearing > 80 && marker.bearing < 100)).toBe(true);
    expect(markers.map((marker) => marker.point.lon)).toEqual([
      -0.19,
      -0.18,
      -0.17,
    ]);
  });

  it("does not add direction arrows to a path without a segment", () => {
    expect(buildRouteDirectionMarkers([[[51.5, -0.2]]])).toEqual([]);
  });

  it("uses the surrounding route direction when sampled points repeat", () => {
    const markers = buildRouteDirectionMarkers(
      [
        [
          [51.5, -0.2],
          [51.5, -0.19],
          [51.5, -0.19],
          [51.5, -0.18],
          [51.5, -0.17],
        ],
      ],
      3,
    );

    expect(
      markers.every((marker) => marker.bearing > 80 && marker.bearing < 100),
    ).toBe(true);
  });
});
