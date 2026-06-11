import type { ActiveRoute } from "@/lib/tfl/types";

export function orderRoutesByUrl(
  routeIds: string[],
  routes: ActiveRoute[],
): ActiveRoute[] {
  const routesById = new Map(
    routes.map((route) => [route.routeId.toLowerCase(), route]),
  );

  return routeIds
    .map((routeId) => routesById.get(routeId.toLowerCase()))
    .filter((route): route is ActiveRoute => route !== undefined);
}

export function getMissingRouteIds(
  routeIds: string[],
  activeRoutes: ActiveRoute[],
): string[] {
  const activeIds = new Set(
    activeRoutes.map((route) => route.routeId.toLowerCase()),
  );

  return routeIds.filter((routeId) => !activeIds.has(routeId.toLowerCase()));
}
