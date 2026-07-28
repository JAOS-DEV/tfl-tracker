"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  findNearestGeographicStop,
  formatMapDistance,
  readMapLocationEnabled,
  shouldFitUserWithRoute,
  writeMapLocationEnabled,
  type NearestMapStop,
} from "@/lib/mapUserLocation";
import type { GeoPoint, GeographicStop } from "@/lib/routeMapGeometry";
import {
  clearPositionWatch,
  getMapGeolocationErrorInfo,
  queryGeolocationPermission,
  requestCurrentPosition,
  watchCurrentPosition,
  type GeolocationErrorInfo,
} from "@/lib/nearbyStops";

export type MapUserLocationStatus = "idle" | "locating" | "ready" | "error";

export interface UseMapUserLocationResult {
  status: MapUserLocationStatus;
  position: GeoPoint | null;
  nearestStop: NearestMapStop | null;
  nearestStopLabel: string | null;
  error: GeolocationErrorInfo | null;
  fitUserAndRouteSignal: number;
  centerOnUserSignal: number;
  enableLocation: () => void;
  findMe: () => void;
}

function toGeoPoint(position: GeolocationPosition): GeoPoint {
  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
  };
}

function toErrorInfo(error: GeolocationPositionError | Error): GeolocationErrorInfo {
  if (
    typeof GeolocationPositionError !== "undefined" &&
    error instanceof GeolocationPositionError
  ) {
    return getMapGeolocationErrorInfo(error);
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as GeolocationPositionError).code === "number"
  ) {
    return getMapGeolocationErrorInfo(error as GeolocationPositionError);
  }

  return {
    title: "Location unavailable",
    message:
      error instanceof Error
        ? error.message
        : "Your device could not determine a location right now.",
  };
}

export function useMapUserLocation(
  geographicStops: GeographicStop[],
  options: { enabled?: boolean } = {},
): UseMapUserLocationResult {
  const enabled = options.enabled ?? true;
  const [status, setStatus] = useState<MapUserLocationStatus>("idle");
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [error, setError] = useState<GeolocationErrorInfo | null>(null);
  const [fitUserAndRouteSignal, setFitUserAndRouteSignal] = useState(0);
  const [centerOnUserSignal, setCenterOnUserSignal] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const watchGenerationRef = useRef(0);
  const firstFixHandledRef = useRef(false);
  const autoResumeSessionRef = useRef(false);
  const geographicStopsRef = useRef(geographicStops);

  useEffect(() => {
    geographicStopsRef.current = geographicStops;
  }, [geographicStops]);

  const stopWatching = useCallback((): void => {
    watchGenerationRef.current += 1;
    clearPositionWatch(watchIdRef.current);
    watchIdRef.current = null;
  }, []);

  const handlePositionSuccess = useCallback(
    (geoPosition: GeolocationPosition): void => {
      const nextPosition = toGeoPoint(geoPosition);
      setPosition(nextPosition);
      setError(null);
      setStatus("ready");
      writeMapLocationEnabled(true);

      if (firstFixHandledRef.current) {
        return;
      }

      firstFixHandledRef.current = true;

      if (autoResumeSessionRef.current) {
        return;
      }

      const nearest = findNearestGeographicStop(
        nextPosition,
        geographicStopsRef.current,
      );
      if (nearest && shouldFitUserWithRoute(nearest.distanceMetres)) {
        setFitUserAndRouteSignal((value) => value + 1);
      }
    },
    [],
  );

  const handlePositionError = useCallback(
    (watchError: GeolocationPositionError | Error): void => {
      stopWatching();
      setStatus("error");
      setError(toErrorInfo(watchError));
    },
    [stopWatching],
  );

  const attachWatch = useCallback(
    (generation: number): void => {
      const watchId = watchCurrentPosition(
        (geoPosition) => {
          if (generation !== watchGenerationRef.current) {
            return;
          }
          handlePositionSuccess(geoPosition);
        },
        (watchError) => {
          if (generation !== watchGenerationRef.current) {
            return;
          }
          // If we already have a fix from the button tap, keep it and ignore
          // later watch noise (common on iOS after permission is settled).
          if (firstFixHandledRef.current) {
            return;
          }
          handlePositionError(watchError);
        },
      );

      if (watchId === null) {
        if (!firstFixHandledRef.current) {
          setStatus("error");
          setError({
            title: "Location unavailable",
            message: "Geolocation is not supported on this device.",
          });
        }
        return;
      }

      watchIdRef.current = watchId;
    },
    [handlePositionError, handlePositionSuccess],
  );

  const beginLocating = useCallback(
    (fromAutoResume: boolean): number | null => {
      if (!enabled) {
        return null;
      }

      clearPositionWatch(watchIdRef.current);
      watchIdRef.current = null;

      const generation = watchGenerationRef.current + 1;
      watchGenerationRef.current = generation;
      firstFixHandledRef.current = false;
      autoResumeSessionRef.current = fromAutoResume;
      setStatus("locating");
      setError(null);
      return generation;
    },
    [enabled],
  );

  const startWatching = useCallback(
    (fromAutoResume: boolean): void => {
      const generation = beginLocating(fromAutoResume);
      if (generation === null) {
        return;
      }

      attachWatch(generation);
    },
    [attachWatch, beginLocating],
  );

  const enableLocation = useCallback((): void => {
    const generation = beginLocating(false);
    if (generation === null) {
      return;
    }

    // Prime with getCurrentPosition inside the tap gesture — required on iOS
    // Safari so the permission prompt can appear for this preview URL.
    requestCurrentPosition(
      (geoPosition) => {
        if (generation !== watchGenerationRef.current) {
          return;
        }
        handlePositionSuccess(geoPosition);
        attachWatch(generation);
      },
      (requestError) => {
        if (generation !== watchGenerationRef.current) {
          return;
        }
        handlePositionError(requestError);
      },
    );
  }, [attachWatch, beginLocating, handlePositionError, handlePositionSuccess]);

  const findMe = useCallback((): void => {
    if (!position) {
      return;
    }

    const nearest = findNearestGeographicStop(position, geographicStops);
    if (nearest && shouldFitUserWithRoute(nearest.distanceMetres)) {
      setFitUserAndRouteSignal((value) => value + 1);
      return;
    }

    setCenterOnUserSignal((value) => value + 1);
  }, [geographicStops, position]);

  useEffect(() => {
    if (!enabled) {
      return () => {
        stopWatching();
      };
    }

    let cancelled = false;

    async function maybeAutoResume(): Promise<void> {
      if (!readMapLocationEnabled()) {
        return;
      }

      const permission = await queryGeolocationPermission();
      if (cancelled) {
        return;
      }

      // Only auto-resume when the browser already reports granted. Never request
      // permission from an effect — iOS Safari will deny that without a prompt.
      if (permission !== "granted") {
        return;
      }

      startWatching(true);
    }

    void maybeAutoResume();

    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [enabled, startWatching, stopWatching]);

  const nearestStop = useMemo(() => {
    if (!position) {
      return null;
    }

    return findNearestGeographicStop(position, geographicStops);
  }, [geographicStops, position]);

  const nearestStopLabel = useMemo(() => {
    if (!nearestStop) {
      return null;
    }

    return `Nearest stop: ${nearestStop.stop.name} · ${formatMapDistance(nearestStop.distanceMetres)}`;
  }, [nearestStop]);

  return {
    status: enabled ? status : "idle",
    position: enabled ? position : null,
    nearestStop: enabled ? nearestStop : null,
    nearestStopLabel: enabled ? nearestStopLabel : null,
    error: enabled ? error : null,
    fitUserAndRouteSignal,
    centerOnUserSignal,
    enableLocation,
    findMe,
  };
}
