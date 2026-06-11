import { describe, expect, it } from "vitest";
import {
  getGeolocationDeniedInfo,
  getGeolocationErrorInfo,
  getNextNearbyStopsVisibleCount,
  getVisibleNearbyStops,
  NEARBY_STOPS_PAGE_SIZE,
} from "@/lib/nearbyStops";

describe("getGeolocationErrorInfo", () => {
  it("returns a friendly permission denied message", () => {
    const error = {
      code: 1,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
      message: "denied",
    } as GeolocationPositionError;

    const info = getGeolocationErrorInfo(error);
    expect(info.title).toMatch(/blocked/i);
    expect(info.message.length).toBeGreaterThan(0);
  });
});

describe("getGeolocationDeniedInfo", () => {
  it("returns actionable guidance", () => {
    const info = getGeolocationDeniedInfo();
    expect(info.title).toMatch(/blocked/i);
    expect(info.message).toMatch(/settings/i);
  });
});

describe("getVisibleNearbyStops", () => {
  it("returns the first page of nearby stops", () => {
    const stops = Array.from({ length: 25 }, (_, index) => index);
    const page = getVisibleNearbyStops(stops, NEARBY_STOPS_PAGE_SIZE);

    expect(page.visible).toHaveLength(10);
    expect(page.total).toBe(25);
    expect(page.hasMore).toBe(true);
  });

  it("reports no more pages when all stops are visible", () => {
    const stops = Array.from({ length: 6 }, (_, index) => index);
    const page = getVisibleNearbyStops(stops, NEARBY_STOPS_PAGE_SIZE);

    expect(page.visible).toHaveLength(6);
    expect(page.hasMore).toBe(false);
  });
});

describe("getNextNearbyStopsVisibleCount", () => {
  it("increments by one page without exceeding the total", () => {
    expect(getNextNearbyStopsVisibleCount(10, 25)).toBe(20);
    expect(getNextNearbyStopsVisibleCount(20, 25)).toBe(25);
  });
});
