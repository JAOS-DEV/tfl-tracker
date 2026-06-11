import { isIosDevice } from "@/lib/platform";

export interface GeolocationErrorInfo {
  title: string;
  message: string;
}

export type GeolocationPermissionState = PermissionState | "unsupported";

export function getGeolocationErrorInfo(
  error: GeolocationPositionError,
): GeolocationErrorInfo {
  if (error.code === error.PERMISSION_DENIED) {
    return getGeolocationDeniedInfo();
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return {
      title: "Location unavailable",
      message: "Your device could not determine a location right now.",
    };
  }

  return {
    title: "Location timed out",
    message: "Try again in a moment.",
  };
}

export function getGeolocationDeniedInfo(): GeolocationErrorInfo {
  if (isIosDevice()) {
    return {
      title: "Location access is blocked",
      message:
        "Safari only shows the location prompt the first time you tap this button. If you previously chose Don't Allow, open Settings → Safari → Location and choose Allow, or tap the AA icon in the address bar → Website Settings → Location → Allow, then try again.",
    };
  }

  return {
    title: "Location access is blocked",
    message:
      "Allow location access for this site in your browser settings, then tap Find stops near me again.",
  };
}

export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (
    typeof navigator === "undefined" ||
    !navigator.permissions?.query
  ) {
    return "unsupported";
  }

  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unsupported";
  }
}

export interface GeolocationRequestOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export function requestCurrentPosition(
  onSuccess: (position: GeolocationPosition) => void,
  onError: (error: GeolocationPositionError | Error) => void,
  options: GeolocationRequestOptions = {},
): void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError(new Error("Geolocation is not supported on this device."));
    return;
  }

  navigator.geolocation.getCurrentPosition(onSuccess, onError, {
    enableHighAccuracy: options.enableHighAccuracy ?? false,
    timeout: options.timeout ?? 12_000,
    maximumAge: options.maximumAge ?? 60_000,
  });
}
