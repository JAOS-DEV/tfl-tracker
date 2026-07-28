import type { GeoPoint, GeographicStop } from "@/lib/routeMapGeometry";
import { STORAGE_KEYS, readJsonStorage, writeJsonStorage } from "@/lib/storage";

export const MAP_USER_LOCATION_FIT_THRESHOLD_METRES = 2_000;
export const MAP_USER_LOCATION_STREET_ZOOM = 16;

const EARTH_RADIUS_METRES = 6_371_000;

export interface NearestMapStop {
  stop: GeographicStop;
  distanceMetres: number;
}

export function distanceMetresBetween(
  left: GeoPoint,
  right: GeoPoint,
): number {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(right.lat - left.lat);
  const longitudeDelta = toRadians(right.lon - left.lon);
  const startLatitude = toRadians(left.lat);
  const endLatitude = toRadians(right.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METRES *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function formatMapDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) {
    return "0 m";
  }

  if (metres < 1_000) {
    return `${Math.round(metres)} m`;
  }

  return `${(metres / 1_000).toFixed(1)} km`;
}

export function findNearestGeographicStop(
  user: GeoPoint,
  stops: GeographicStop[],
): NearestMapStop | null {
  if (stops.length === 0) {
    return null;
  }

  let nearest: NearestMapStop | null = null;

  for (const stop of stops) {
    const distanceMetres = distanceMetresBetween(user, stop);
    if (!nearest || distanceMetres < nearest.distanceMetres) {
      nearest = { stop, distanceMetres };
    }
  }

  return nearest;
}

export function shouldFitUserWithRoute(distanceMetres: number): boolean {
  return (
    Number.isFinite(distanceMetres) &&
    distanceMetres <= MAP_USER_LOCATION_FIT_THRESHOLD_METRES
  );
}

export function readMapLocationEnabled(): boolean {
  const stored = readJsonStorage<boolean | null>(
    STORAGE_KEYS.mapLocationEnabled,
    null,
  );
  return stored === true;
}

export function writeMapLocationEnabled(enabled: boolean): void {
  writeJsonStorage(STORAGE_KEYS.mapLocationEnabled, enabled === true);
}
