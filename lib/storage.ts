import type { ActiveRoute } from "@/lib/tfl/types";

export const STORAGE_KEYS = {
  activeRoutes: "tfl-tracker:active-routes",
  recentRoutes: "tfl-tracker:recent-routes",
  favouriteRoutes: "tfl-tracker:favourite-routes",
  routeAlertPreferences: "tfl-tracker:route-alert-preferences",
  theme: "tfl-tracker:theme",
  routeHistory: "tfl-tracker:route-history",
} as const;

export const MAX_ACTIVE_ROUTES = 3;
export const MAX_RECENT_ROUTES = 8;
export const POLL_INTERVAL_MS = 30_000;

export function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function addRecentRoute(
  recentRoutes: ActiveRoute[],
  route: ActiveRoute,
): ActiveRoute[] {
  const filtered = recentRoutes.filter((item) => item.routeId !== route.routeId);
  return [route, ...filtered].slice(0, MAX_RECENT_ROUTES);
}

export function addActiveRoute(
  activeRoutes: ActiveRoute[],
  route: ActiveRoute,
): ActiveRoute[] {
  if (activeRoutes.some((item) => item.routeId === route.routeId)) {
    return activeRoutes;
  }
  if (activeRoutes.length >= MAX_ACTIVE_ROUTES) {
    return activeRoutes;
  }
  return [...activeRoutes, route];
}

export function removeRecentRoute(
  recentRoutes: ActiveRoute[],
  routeId: string,
): ActiveRoute[] {
  return recentRoutes.filter((route) => route.routeId !== routeId);
}

