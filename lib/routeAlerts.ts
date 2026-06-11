import { SERVICE_INTELLIGENCE_THRESHOLDS } from "@/lib/constants";
import type { ServiceHealthMetrics } from "@/lib/tfl/types";

export type RouteAlertTone = "warning" | "danger" | "neutral";

export interface RouteAlert {
  id: string;
  label: string;
  tone: RouteAlertTone;
}

export interface RouteAlertPreferences {
  routeId: string;
  warnLargeGap: boolean;
  largeGapMinutes: number;
  warnBunching: boolean;
  warnNoLiveBuses: boolean;
  warnStaleData: boolean;
}

export const DEFAULT_LARGE_GAP_MINUTES =
  SERVICE_INTELLIGENCE_THRESHOLDS.LARGE_GAP_THRESHOLD_MINUTES;

export function createDefaultAlertPreferences(
  routeId: string,
): RouteAlertPreferences {
  return {
    routeId,
    warnLargeGap: true,
    largeGapMinutes: DEFAULT_LARGE_GAP_MINUTES,
    warnBunching: true,
    warnNoLiveBuses: true,
    warnStaleData: true,
  };
}

export function normalizeAlertPreferencesMap(
  value: unknown,
): Record<string, RouteAlertPreferences> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: Record<string, RouteAlertPreferences> = {};

  for (const [routeId, prefs] of Object.entries(value)) {
    if (!prefs || typeof prefs !== "object") {
      continue;
    }

    const raw = prefs as Partial<RouteAlertPreferences>;
    result[routeId] = {
      routeId,
      warnLargeGap: raw.warnLargeGap ?? true,
      largeGapMinutes:
        typeof raw.largeGapMinutes === "number" && raw.largeGapMinutes > 0
          ? raw.largeGapMinutes
          : DEFAULT_LARGE_GAP_MINUTES,
      warnBunching: raw.warnBunching ?? true,
      warnNoLiveBuses: raw.warnNoLiveBuses ?? true,
      warnStaleData: raw.warnStaleData ?? true,
    };
  }

  return result;
}

export function getAlertPreferencesForRoute(
  map: Record<string, RouteAlertPreferences>,
  routeId: string,
): RouteAlertPreferences {
  return map[routeId] ?? createDefaultAlertPreferences(routeId);
}

export function setAlertPreferencesForRoute(
  map: Record<string, RouteAlertPreferences>,
  preferences: RouteAlertPreferences,
): Record<string, RouteAlertPreferences> {
  return {
    ...map,
    [preferences.routeId]: preferences,
  };
}

export function evaluateRouteAlerts(
  metrics: ServiceHealthMetrics,
  preferences: RouteAlertPreferences,
): RouteAlert[] {
  const alerts: RouteAlert[] = [];

  if (
    preferences.warnNoLiveBuses &&
    metrics.liveVehicleCount === 0
  ) {
    alerts.push({
      id: "no-live-vehicles",
      label: "No live vehicles detected",
      tone: "neutral",
    });
    return alerts;
  }

  if (
    preferences.warnLargeGap &&
    metrics.largestGapMinutes !== null &&
    metrics.largestGapMinutes >= preferences.largeGapMinutes
  ) {
    alerts.push({
      id: "large-gap",
      label: "Large predicted gap",
      tone: "warning",
    });
  }

  if (preferences.warnBunching && metrics.bunchingClusterCount > 0) {
    alerts.push({
      id: "bunching",
      label: "Possible bunching",
      tone: "warning",
    });
  }

  if (preferences.warnStaleData && metrics.isDataStale) {
    alerts.push({
      id: "stale-data",
      label: "TfL data may be stale",
      tone: "warning",
    });
  }

  return alerts;
}

export function formatAlertSummary(alerts: RouteAlert[]): string | null {
  if (alerts.length === 0) {
    return null;
  }
  return alerts.map((alert) => alert.label).join(" · ");
}
