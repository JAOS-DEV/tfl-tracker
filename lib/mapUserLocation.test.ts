import { beforeEach, describe, expect, it } from "vitest";
import {
  distanceMetresBetween,
  findNearestGeographicStop,
  formatMapDistance,
  readMapLocationEnabled,
  shouldFitUserWithRoute,
  writeMapLocationEnabled,
} from "@/lib/mapUserLocation";
import { STORAGE_KEYS } from "@/lib/storage";
import type { GeographicStop } from "@/lib/routeMapGeometry";

const stops: GeographicStop[] = [
  {
    id: "1",
    name: "Stop A",
    naptanId: "A",
    lat: 51.5,
    lon: -0.1,
    isTimingPoint: false,
  },
  {
    id: "2",
    name: "Stop B",
    naptanId: "B",
    lat: 51.51,
    lon: -0.11,
    isTimingPoint: false,
  },
];

describe("mapUserLocation helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("computes finite haversine distances", () => {
    const metres = distanceMetresBetween(
      { lat: 51.5, lon: -0.1 },
      { lat: 51.5005, lon: -0.1 },
    );
    expect(metres).toBeGreaterThan(40);
    expect(metres).toBeLessThan(80);
  });

  it("formats metres and kilometres", () => {
    expect(formatMapDistance(240)).toBe("240 m");
    expect(formatMapDistance(2400)).toBe("2.4 km");
  });

  it("finds the nearest geographic stop", () => {
    const nearest = findNearestGeographicStop(
      { lat: 51.5001, lon: -0.1001 },
      stops,
    );
    expect(nearest?.stop.naptanId).toBe("A");
    expect(nearest?.distanceMetres).toBeLessThan(100);
  });

  it("applies the 2 km fit threshold", () => {
    expect(shouldFitUserWithRoute(1_999)).toBe(true);
    expect(shouldFitUserWithRoute(2_000)).toBe(true);
    expect(shouldFitUserWithRoute(2_001)).toBe(false);
  });

  it("stores only a boolean map-location preference", () => {
    expect(readMapLocationEnabled()).toBe(false);
    writeMapLocationEnabled(true);
    expect(readMapLocationEnabled()).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEYS.mapLocationEnabled)).toBe(
      "true",
    );
    expect(
      window.localStorage.getItem(STORAGE_KEYS.mapLocationEnabled),
    ).not.toMatch(/lat|lon|coord/i);
  });
});
