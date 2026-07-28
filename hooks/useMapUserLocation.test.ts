import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMapUserLocation } from "@/hooks/useMapUserLocation";
import { writeMapLocationEnabled } from "@/lib/mapUserLocation";
import type { GeographicStop } from "@/lib/routeMapGeometry";
import { STORAGE_KEYS } from "@/lib/storage";

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
    lat: 51.501,
    lon: -0.101,
    isTimingPoint: false,
  },
];

function mockGeolocation(options: {
  watchImpl?: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
  ) => number;
  permission?: PermissionState | "unsupported";
}): {
  clearWatch: ReturnType<typeof vi.fn>;
  watchPosition: ReturnType<typeof vi.fn>;
} {
  const clearWatch = vi.fn();
  const watchPosition = vi.fn(
    (
      success: PositionCallback,
      error?: PositionErrorCallback | null,
    ): number => {
      if (options.watchImpl) {
        return options.watchImpl(success, error);
      }
      return 42;
    },
  );

  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition,
      clearWatch,
      getCurrentPosition: vi.fn(),
    },
  });

  if (options.permission === "unsupported") {
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: undefined,
    });
  } else {
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(async () => ({
          state: options.permission ?? "prompt",
        })),
      },
    });
  }

  return { clearWatch, watchPosition };
}

describe("useMapUserLocation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts watching on Use my location and clears watch on unmount", async () => {
    const { clearWatch, watchPosition } = mockGeolocation({
      watchImpl: (success) => {
        success({
          coords: {
            latitude: 51.5002,
            longitude: -0.1002,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        } as GeolocationPosition);
        return 7;
      },
    });

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));

    expect(
      view.result.current.status === "idle" ||
        view.result.current.status === "locating",
    ).toBe(true);

    view.result.current.enableLocation();

    await waitFor(() => {
      expect(view.result.current.status).toBe("ready");
    });

    expect(watchPosition).toHaveBeenCalled();
    expect(view.result.current.position).toEqual({
      lat: 51.5002,
      lon: -0.1002,
    });
    expect(view.result.current.nearestStop?.stop.naptanId).toBe("A");
    expect(window.localStorage.getItem(STORAGE_KEYS.mapLocationEnabled)).toBe(
      "true",
    );
    expect(fetch).not.toHaveBeenCalled();

    view.unmount();
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("auto-resumes when preference is on and permission is granted", async () => {
    writeMapLocationEnabled(true);
    const { watchPosition } = mockGeolocation({
      permission: "granted",
      watchImpl: (success) => {
        success({
          coords: {
            latitude: 51.5002,
            longitude: -0.1002,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        } as GeolocationPosition);
        return 9;
      },
    });

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));

    await waitFor(() => {
      expect(view.result.current.status).toBe("ready");
    });

    expect(watchPosition).toHaveBeenCalled();
    expect(view.result.current.fitUserAndRouteSignal).toBe(0);
  });

  it("does not auto-resume when permission is prompt", async () => {
    writeMapLocationEnabled(true);
    const { watchPosition } = mockGeolocation({ permission: "prompt" });

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));

    await waitFor(() => {
      expect(view.result.current.status).toBe("idle");
    });

    expect(watchPosition).not.toHaveBeenCalled();
  });

  it("does not enable preference after a failed opt-in", async () => {
    const { watchPosition } = mockGeolocation({
      watchImpl: (_success, error) => {
        error?.({
          code: 1,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
          message: "denied",
        } as GeolocationPositionError);
        return 3;
      },
    });

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));
    view.result.current.enableLocation();

    await waitFor(() => {
      expect(view.result.current.status).toBe("error");
    });

    expect(watchPosition).toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEYS.mapLocationEnabled)).toBe(
      null,
    );
    expect(view.result.current.error?.title).toMatch(/blocked|unavailable/i);
  });

  it("Find me fits nearby users and centres far users", async () => {
    let latestSuccess: PositionCallback | undefined;
    mockGeolocation({
      watchImpl: (success) => {
        latestSuccess = success;
        return 1;
      },
    });

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));
    view.result.current.enableLocation();

    latestSuccess?.({
      coords: {
        latitude: 51.5001,
        longitude: -0.1001,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    } as GeolocationPosition);

    await waitFor(() => {
      expect(view.result.current.status).toBe("ready");
    });

    const nearbyFit = view.result.current.fitUserAndRouteSignal;
    expect(nearbyFit).toBeGreaterThan(0);

    act(() => {
      view.result.current.findMe();
    });
    expect(view.result.current.fitUserAndRouteSignal).toBe(nearbyFit + 1);

    latestSuccess?.({
      coords: {
        latitude: 52.5,
        longitude: -1.5,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    } as GeolocationPosition);

    await waitFor(() => {
      expect(view.result.current.nearestStop?.distanceMetres).toBeGreaterThan(
        2_000,
      );
    });

    const centerBefore = view.result.current.centerOnUserSignal;
    act(() => {
      view.result.current.findMe();
    });
    expect(view.result.current.centerOnUserSignal).toBe(centerBefore + 1);
  });
});
