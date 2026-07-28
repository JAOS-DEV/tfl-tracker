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

function createPosition(lat: number, lon: number): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lon,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as GeolocationPosition;
}

function mockGeolocation(options: {
  getCurrentImpl?: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
  ) => void;
  watchImpl?: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
  ) => number;
  permission?: PermissionState | "unsupported";
}): {
  clearWatch: ReturnType<typeof vi.fn>;
  watchPosition: ReturnType<typeof vi.fn>;
  getCurrentPosition: ReturnType<typeof vi.fn>;
} {
  const clearWatch = vi.fn();
  const getCurrentPosition = vi.fn(
    (
      success: PositionCallback,
      error?: PositionErrorCallback | null,
    ): void => {
      if (options.getCurrentImpl) {
        options.getCurrentImpl(success, error);
        return;
      }
      success(createPosition(51.5002, -0.1002));
    },
  );
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
      getCurrentPosition,
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

  return { clearWatch, watchPosition, getCurrentPosition };
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

  it("primes location from a tap with getCurrentPosition then watches", async () => {
    const { clearWatch, watchPosition, getCurrentPosition } = mockGeolocation({});

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));
    view.result.current.enableLocation();

    await waitFor(() => {
      expect(view.result.current.status).toBe("ready");
    });

    expect(getCurrentPosition).toHaveBeenCalled();
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
    expect(clearWatch).toHaveBeenCalled();
  });

  it("auto-resumes when preference is on and permission is granted", async () => {
    writeMapLocationEnabled(true);
    const { watchPosition, getCurrentPosition } = mockGeolocation({
      permission: "granted",
      watchImpl: (success) => {
        success(createPosition(51.5002, -0.1002));
        return 9;
      },
    });

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));

    await waitFor(() => {
      expect(view.result.current.status).toBe("ready");
    });

    expect(watchPosition).toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(view.result.current.fitUserAndRouteSignal).toBe(0);
  });

  it("does not auto-resume when permission is prompt", async () => {
    writeMapLocationEnabled(true);
    const { watchPosition, getCurrentPosition } = mockGeolocation({
      permission: "prompt",
    });

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));

    await waitFor(() => {
      expect(view.result.current.status).toBe("idle");
    });

    expect(watchPosition).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("does not enable preference after a failed opt-in", async () => {
    const { getCurrentPosition } = mockGeolocation({
      getCurrentImpl: (_success, error) => {
        error?.({
          code: 1,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
          message: "denied",
        } as GeolocationPositionError);
      },
    });

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));
    view.result.current.enableLocation();

    await waitFor(() => {
      expect(view.result.current.status).toBe("error");
    });

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEYS.mapLocationEnabled)).toBe(
      null,
    );
    expect(view.result.current.error?.title).toMatch(/blocked|unavailable/i);
  });

  it("Find me fits nearby users and centres far users", async () => {
    let latestWatchSuccess: PositionCallback | undefined;
    mockGeolocation({
      getCurrentImpl: (success) => {
        success(createPosition(51.5001, -0.1001));
      },
      watchImpl: (success) => {
        latestWatchSuccess = success;
        return 1;
      },
    });

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));
    view.result.current.enableLocation();

    await waitFor(() => {
      expect(view.result.current.status).toBe("ready");
    });

    const nearbyFit = view.result.current.fitUserAndRouteSignal;
    expect(nearbyFit).toBeGreaterThan(0);

    act(() => {
      view.result.current.findMe();
    });
    expect(view.result.current.fitUserAndRouteSignal).toBe(nearbyFit + 1);

    latestWatchSuccess?.(createPosition(52.5, -1.5));

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

  it("ignores stale geolocation errors after the watch is cleared", async () => {
    let firstError: PositionErrorCallback | null = null;
    mockGeolocation({
      getCurrentImpl: (success) => {
        success(createPosition(51.5, -0.1));
      },
      watchImpl: (_success, error) => {
        firstError = error ?? null;
        return 11;
      },
    });

    const view = renderHook(() => useMapUserLocation(stops, { enabled: true }));
    view.result.current.enableLocation();

    await waitFor(() => {
      expect(view.result.current.status).toBe("ready");
    });

    view.unmount();

    act(() => {
      firstError?.({
        code: 3,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: "timeout",
      } as GeolocationPositionError);
    });
  });
});
