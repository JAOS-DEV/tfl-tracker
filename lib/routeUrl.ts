import type { RouteVisualMode } from "@/lib/tfl/types";
import { MAX_ACTIVE_ROUTES } from "@/lib/storage";

export interface AppUrlState {
  routeIds: string[];
  view?: RouteVisualMode;
  stopPointId?: string;
}

export function parseRoutesParam(routesParam: string | null): string[] {
  if (!routesParam) {
    return [];
  }

  const seen = new Set<string>();
  const routeIds: string[] = [];

  for (const segment of routesParam.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    routeIds.push(trimmed);

    if (routeIds.length >= MAX_ACTIVE_ROUTES) {
      break;
    }
  }

  return routeIds;
}

export function serializeRoutesParam(routeIds: string[]): string | null {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const routeId of routeIds) {
    const normalized = routeId.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(routeId.trim());
    if (unique.length >= MAX_ACTIVE_ROUTES) {
      break;
    }
  }

  return unique.length > 0 ? unique.join(",") : null;
}

export function parseViewParam(viewParam: string | null): RouteVisualMode | undefined {
  if (viewParam === "loop" || viewParam === "list") {
    return viewParam;
  }
  return undefined;
}

export function parseStopParam(stopParam: string | null): string | undefined {
  const trimmed = stopParam?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseAppUrlState(searchParams: URLSearchParams): AppUrlState {
  return {
    routeIds: parseRoutesParam(searchParams.get("routes")),
    view: parseViewParam(searchParams.get("view")),
    stopPointId: parseStopParam(searchParams.get("stop")),
  };
}

export function buildAppSearchUrl(state: AppUrlState): string {
  const params = new URLSearchParams();
  const serializedRoutes = serializeRoutesParam(state.routeIds);

  if (serializedRoutes) {
    params.set("routes", serializedRoutes);
  }

  if (state.view) {
    params.set("view", state.view);
  }

  if (state.stopPointId) {
    params.set("stop", state.stopPointId);
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function buildRoutesSearchUrl(
  routeIds: string[],
  view?: RouteVisualMode,
): string {
  return buildAppSearchUrl({ routeIds, view });
}

export function buildStopSearchUrl(stopPointId: string): string {
  return buildAppSearchUrl({ routeIds: [], stopPointId });
}
