import type { ServiceHealthMetrics } from "@/lib/tfl/types";

export type RouteAlertTone = "warning" | "danger" | "neutral";

export interface RouteAlert {
  id: string;
  label: string;
  tone: RouteAlertTone;
}

export interface RouteAlertPreferences {
  routeId: string;
  warnBunching: boolean;
  warnNoLiveBuses: boolean;
  warnStaleData: boolean;
  warnPossibleGhost: boolean;
  warnPredictionDisappeared: boolean;
  warnEstimatedLateBus: boolean;
  estimatedLateMinutes: number;
}

export const DEFAULT_ESTIMATED_LATE_MINUTES = 4;

export function createDefaultAlertPreferences(
  routeId: string,
): RouteAlertPreferences {
  return {
    routeId,
    warnBunching: true,
    warnNoLiveBuses: true,
    warnStaleData: true,
    warnPossibleGhost: true,
    warnPredictionDisappeared: false,
    warnEstimatedLateBus: false,
    estimatedLateMinutes: DEFAULT_ESTIMATED_LATE_MINUTES,
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
    const defaults = createDefaultAlertPreferences(routeId);
    result[routeId] = {
      ...defaults,
      ...raw,
      routeId,
      estimatedLateMinutes:
        typeof raw.estimatedLateMinutes === "number" &&
        raw.estimatedLateMinutes > 0
          ? raw.estimatedLateMinutes
          : defaults.estimatedLateMinutes,
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

  if (preferences.warnPossibleGhost && metrics.possibleGhostCount > 0) {
    alerts.push({
      id: "possible-ghost",
      label:
        metrics.possibleGhostCount === 1
          ? "Possible ghost"
          : `${metrics.possibleGhostCount} possible ghosts`,
      tone: "warning",
    });
  }

  if (
    preferences.warnPredictionDisappeared &&
    metrics.predictionDisappearedCount > 0
  ) {
    alerts.push({
      id: "prediction-disappeared",
      label: "Prediction disappeared",
      tone: "warning",
    });
  }

  if (
    preferences.warnEstimatedLateBus &&
    metrics.estimatedLateCount > 0 &&
    metrics.averageScheduleDeviationMinutes !== null &&
    metrics.averageScheduleDeviationMinutes >= preferences.estimatedLateMinutes
  ) {
    alerts.push({
      id: "estimated-late",
      label: "Estimated late bus",
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
