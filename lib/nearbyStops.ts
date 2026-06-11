export interface GeolocationErrorInfo {
  title: string;
  message: string;
}

export function getGeolocationErrorInfo(error: GeolocationPositionError): GeolocationErrorInfo {
  if (error.code === error.PERMISSION_DENIED) {
    return {
      title: "Location permission denied",
      message:
        "Allow location access in your browser settings to find nearby bus stops.",
    };
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

export function requestCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 60_000,
    });
  });
}
