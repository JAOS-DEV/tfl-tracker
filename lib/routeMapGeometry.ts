import {
  getDirectionLegProgressBounds,
} from "@/lib/routePositioning";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedStop,
  RouteDirection,
} from "@/lib/tfl/types";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface GeographicStop extends NormalizedStop {
  lat: number;
  lon: number;
}

export interface RouteMapViewport {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface SvgPoint {
  x: number;
  y: number;
}

export const ROUTE_MAP_UNAVAILABLE_MESSAGE =
  "Map unavailable for this route right now";

export function isValidGeoCoordinate(lat?: number, lon?: number): boolean {
  if (lat === undefined || lon === undefined) {
    return false;
  }

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

export function getDirectionStops(
  route: NormalizedRoute,
  direction: RouteDirection,
): NormalizedStop[] {
  return direction === "outbound" ? route.outbound : route.inbound;
}

export function getGeographicStops(
  route: NormalizedRoute,
  direction: RouteDirection,
): GeographicStop[] {
  return getDirectionStops(route, direction).filter(
    (stop): stop is GeographicStop =>
      isValidGeoCoordinate(stop.lat, stop.lon),
  );
}

export function hasRouteMapGeometry(
  route: NormalizedRoute,
  direction: RouteDirection,
): boolean {
  return getGeographicStops(route, direction).length >= 2;
}

export function computeRouteMapViewport(
  points: GeoPoint[],
  paddingRatio = 0.12,
): RouteMapViewport | null {
  if (points.length === 0) {
    return null;
  }

  let minLat = points[0]!.lat;
  let maxLat = points[0]!.lat;
  let minLon = points[0]!.lon;
  let maxLon = points[0]!.lon;

  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
  }

  const latSpan = Math.max(maxLat - minLat, 0.001);
  const lonSpan = Math.max(maxLon - minLon, 0.001);
  const latPadding = latSpan * paddingRatio;
  const lonPadding = lonSpan * paddingRatio;

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLon: minLon - lonPadding,
    maxLon: maxLon + lonPadding,
  };
}

export function projectGeoToSvg(
  point: GeoPoint,
  viewport: RouteMapViewport,
  width: number,
  height: number,
): SvgPoint {
  const lonSpan = viewport.maxLon - viewport.minLon;
  const latSpan = viewport.maxLat - viewport.minLat;
  const x = ((point.lon - viewport.minLon) / lonSpan) * width;
  const y = ((viewport.maxLat - point.lat) / latSpan) * height;

  return { x, y };
}

export function buildRouteMapPolyline(
  stops: GeographicStop[],
  viewport: RouteMapViewport,
  width: number,
  height: number,
): string {
  return stops
    .map((stop) => {
      const projected = projectGeoToSvg(stop, viewport, width, height);
      return `${projected.x},${projected.y}`;
    })
    .join(" ");
}

function interpolateGeoPoints(
  start: GeoPoint,
  end: GeoPoint,
  ratio: number,
): GeoPoint {
  const clamped = Math.max(0, Math.min(1, ratio));

  return {
    lat: start.lat + (end.lat - start.lat) * clamped,
    lon: start.lon + (end.lon - start.lon) * clamped,
  };
}

export function resolveVehicleGeoPosition(
  vehicle: EstimatedVehiclePosition,
  route: NormalizedRoute,
): GeoPoint | null {
  const stops = getGeographicStops(route, vehicle.direction);
  if (stops.length < 2) {
    return null;
  }

  if (vehicle.markerState === "terminus-layover") {
    if (vehicle.terminusLayoverKind === "leg-start") {
      const stop = stops[0]!;
      return { lat: stop.lat, lon: stop.lon };
    }
    if (vehicle.terminusLayoverKind === "leg-end") {
      const stop = stops[stops.length - 1]!;
      return { lat: stop.lat, lon: stop.lon };
    }
  }

  const directionStops = getDirectionStops(route, vehicle.direction);
  const { min, max } = getDirectionLegProgressBounds(
    vehicle.direction,
    directionStops.length,
  );
  const legSpan = max - min;
  const legProgress =
    legSpan <= 0 ? 0 : Math.max(0, Math.min(1, (vehicle.progress - min) / legSpan));
  const scaled = legProgress * (stops.length - 1);
  const startIndex = Math.min(Math.floor(scaled), stops.length - 2);
  const segmentRatio = scaled - startIndex;

  return interpolateGeoPoints(
    stops[startIndex]!,
    stops[startIndex + 1]!,
    segmentRatio,
  );
}

export function buildRouteMapVehicleMarkers(
  vehicles: EstimatedVehiclePosition[],
  route: NormalizedRoute,
  direction: RouteDirection,
): Array<{ vehicle: EstimatedVehiclePosition; point: GeoPoint }> {
  return vehicles
    .filter((vehicle) => vehicle.direction === direction)
    .map((vehicle) => ({
      vehicle,
      point: resolveVehicleGeoPosition(vehicle, route),
    }))
    .filter(
      (
        entry,
      ): entry is { vehicle: EstimatedVehiclePosition; point: GeoPoint } =>
        entry.point !== null,
    );
}

export type LeafletBounds = [[number, number], [number, number]];

export function computeLeafletBounds(points: GeoPoint[]): LeafletBounds | null {
  const viewport = computeRouteMapViewport(points);
  if (!viewport) {
    return null;
  }

  return [
    [viewport.minLat, viewport.minLon],
    [viewport.maxLat, viewport.maxLon],
  ];
}

export function getRoutePolylineLatLngs(
  stops: GeographicStop[],
): Array<[number, number]> {
  return stops.map((stop) => [stop.lat, stop.lon]);
}

export function getRoutePolylinePoints(
  route: NormalizedRoute,
  direction: RouteDirection,
): GeoPoint[] {
  const routePaths = route.routePaths?.[direction];
  if (routePaths?.length) {
    return routePaths.flat();
  }

  return getGeographicStops(route, direction);
}

export function getRoutePolylinePathsLatLngs(
  route: NormalizedRoute,
  direction: RouteDirection,
): Array<Array<[number, number]>> {
  const routePaths = route.routePaths?.[direction];
  if (routePaths?.length) {
    return routePaths.map((path) =>
      path.map((point) => [point.lat, point.lon]),
    );
  }

  return [getRoutePolylineLatLngs(getGeographicStops(route, direction))];
}

export interface RouteDirectionMarker {
  point: GeoPoint;
  bearing: number;
}

function calculateBearing(
  start: [number, number],
  end: [number, number],
): number {
  const averageLatitude = ((start[0] + end[0]) / 2) * (Math.PI / 180);
  const east = (end[1] - start[1]) * Math.cos(averageLatitude);
  const north = end[0] - start[0];
  return (Math.atan2(east, north) * 180) / Math.PI;
}

function findDistinctPathPoint(
  path: Array<[number, number]>,
  originIndex: number,
  step: -1 | 1,
): [number, number] | null {
  const origin = path[originIndex]!;
  for (
    let index = originIndex + step;
    index >= 0 && index < path.length;
    index += step
  ) {
    const candidate = path[index]!;
    if (candidate[0] !== origin[0] || candidate[1] !== origin[1]) {
      return candidate;
    }
  }
  return null;
}

export function buildRouteDirectionMarkers(
  paths: Array<Array<[number, number]>>,
  maxMarkersPerPath = 4,
): RouteDirectionMarker[] {
  const markers: RouteDirectionMarker[] = [];

  for (const path of paths) {
    if (path.length < 2 || maxMarkersPerPath < 1) {
      continue;
    }

    const markerCount = Math.min(maxMarkersPerPath, path.length - 1);
    for (let markerIndex = 0; markerIndex < markerCount; markerIndex += 1) {
      const pathIndex = Math.min(
        path.length - 2,
        Math.round(
          ((markerIndex + 1) * (path.length - 1)) / (markerCount + 1),
        ),
      );
      const point = path[pathIndex]!;
      const previousPoint = findDistinctPathPoint(path, pathIndex, -1);
      const nextPoint = findDistinctPathPoint(path, pathIndex, 1);
      if (!previousPoint && !nextPoint) {
        continue;
      }
      markers.push({
        point: { lat: point[0], lon: point[1] },
        bearing: calculateBearing(
          previousPoint ?? point,
          nextPoint ?? point,
        ),
      });
    }
  }

  return markers;
}
