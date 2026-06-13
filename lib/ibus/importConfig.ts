export type RouteScheduleMode = "none" | "selected" | "all";

export interface RouteScheduleImportConfig {
  mode: RouteScheduleMode;
  routeIds: string[];
}

const ROUTE_ID_PATTERN = /^[A-Za-z0-9]+$/;

export function normalizeRouteId(routeId: string): string {
  return routeId.trim();
}

export function routeScheduleFilename(routeId: string): string {
  const normalized = normalizeRouteId(routeId);
  if (!ROUTE_ID_PATTERN.test(normalized)) {
    throw new Error(`Invalid route id for filename: ${routeId}`);
  }
  return `${normalized}.json`;
}

export function parseRouteScheduleEnv(
  value: string | undefined,
): RouteScheduleImportConfig {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { mode: "none", routeIds: [] };
  }

  if (trimmed.toLowerCase() === "all") {
    return { mode: "all", routeIds: [] };
  }

  const routeIds = trimmed
    .split(",")
    .map((routeId) => normalizeRouteId(routeId))
    .filter(Boolean);

  return {
    mode: "selected",
    routeIds,
  };
}
