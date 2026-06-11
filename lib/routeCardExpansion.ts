export type RouteExpansionState = Record<string, boolean>;

export function shouldRouteStartExpanded(
  routeIndex: number,
  routeCount: number,
): boolean {
  return routeCount <= 1 || routeIndex === 0;
}

export function mergeRouteExpansionState(
  current: RouteExpansionState,
  routeIds: string[],
): RouteExpansionState {
  const next: RouteExpansionState = {};

  for (let index = 0; index < routeIds.length; index += 1) {
    const routeId = routeIds[index];
    next[routeId] =
      routeId in current
        ? current[routeId]
        : shouldRouteStartExpanded(index, routeIds.length);
  }

  return next;
}

export function areAllRoutesExpanded(
  expandedByRouteId: RouteExpansionState,
  routeIds: string[],
): boolean {
  return routeIds.every((routeId) => expandedByRouteId[routeId] !== false);
}

export function setAllRoutesExpanded(
  routeIds: string[],
  expanded: boolean,
): RouteExpansionState {
  return Object.fromEntries(routeIds.map((routeId) => [routeId, expanded]));
}

export function isRouteExpanded(
  expandedByRouteId: RouteExpansionState,
  routeId: string,
  routeIndex: number,
  routeCount: number,
): boolean {
  if (routeId in expandedByRouteId) {
    return expandedByRouteId[routeId];
  }

  return shouldRouteStartExpanded(routeIndex, routeCount);
}
