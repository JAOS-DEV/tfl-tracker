export type AppErrorKind =
  | "missing-api-key"
  | "tfl-unavailable"
  | "route-not-found"
  | "no-predictions"
  | "rate-limit"
  | "network-offline"
  | "invalid-shared-url"
  | "timetable-unavailable"
  | "schedule-uncertain"
  | "generic";

export interface FriendlyError {
  kind: AppErrorKind;
  title: string;
  message: string;
  action?: string;
}

function includesAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

export function formatFriendlyError(
  error: unknown,
  context?: {
    isOffline?: boolean;
    invalidRouteIds?: string[];
  },
): FriendlyError {
  if (context?.isOffline) {
    return {
      kind: "network-offline",
      title: "You appear to be offline",
      message:
        "Live TfL data cannot be refreshed without a network connection. Saved routes and local history remain on this device.",
      action: "Check your connection and try again.",
    };
  }

  if (context?.invalidRouteIds && context.invalidRouteIds.length > 0) {
    const ids = context.invalidRouteIds.join(", ");
    return {
      kind: "invalid-shared-url",
      title: "Some routes from this shared link could not be loaded",
      message: `Skipped route${context.invalidRouteIds.length === 1 ? "" : "s"}: ${ids}.`,
      action: "Check the route numbers and try adding them manually.",
    };
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";

  if (includesAny(message, ["TFL_API_KEY", "missing or invalid"])) {
    return {
      kind: "missing-api-key",
      title: "TfL API key not configured",
      message:
        "The server cannot reach TfL Open Data because TFL_API_KEY is missing or invalid.",
      action: "Add a valid key to .env.local and restart the dev server.",
    };
  }

  if (includesAny(message, ["429", "rate limit", "too many requests"])) {
    return {
      kind: "rate-limit",
      title: "Too many requests",
      message:
        "TfL or this app is temporarily rate limiting requests. Live data will resume shortly.",
      action: "Wait a moment, then retry.",
    };
  }

  if (
    includesAny(message, [
      "route not found",
      "no bus route found",
      "failed to load route sequence",
      "line not found",
    ])
  ) {
    return {
      kind: "route-not-found",
      title: "Route not found",
      message,
      action: "Check the route number and try again.",
    };
  }

  if (
    includesAny(message, [
      "no predictions",
      "no arrivals",
      "live arrivals unavailable",
    ])
  ) {
    return {
      kind: "no-predictions",
      title: "No predictions available",
      message:
        "TfL returned no live arrival predictions for this route right now.",
      action: "The service may be between buses or temporarily unavailable.",
    };
  }

  if (
    includesAny(message, [
      "failed to fetch",
      "networkerror",
      "network request failed",
      "load failed",
    ])
  ) {
    return {
      kind: "network-offline",
      title: "Network error",
      message:
        "Could not reach the server. Live TfL data may be unavailable until connectivity returns.",
      action: "Check your connection and retry.",
    };
  }

  if (
    includesAny(message, [
      "timetable unavailable",
      "no timetable",
      "timetable requires disambiguation",
    ])
  ) {
    return {
      kind: "timetable-unavailable",
      title: "Timetable unavailable",
      message:
        "Live arrivals still work, but estimated schedule position cannot be compared with timetable data right now.",
      action: "Schedule badges may show as uncertain until timetable data returns.",
    };
  }

  if (includesAny(message, ["schedule match uncertain", "schedule uncertain"])) {
    return {
      kind: "schedule-uncertain",
      title: "Schedule match uncertain",
      message,
      action: "This is an estimate only and may not match official running data.",
    };
  }

  if (
    includesAny(message, [
      "tfl api",
      "unified api",
      "upstream",
      "service unavailable",
      "502",
      "503",
      "504",
    ])
  ) {
    return {
      kind: "tfl-unavailable",
      title: "TfL data temporarily unavailable",
      message,
      action: "Retry in a few moments.",
    };
  }

  return {
    kind: "generic",
    title: "Something went wrong",
    message,
    action: "Try again, or remove and re-add the route.",
  };
}
