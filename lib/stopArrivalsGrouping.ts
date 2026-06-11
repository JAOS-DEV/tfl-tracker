import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";

export interface RouteArrivalGroup {
  routeId: string;
  routeNumber: string;
  predictions: NormalizedVehiclePrediction[];
  isActiveRoute: boolean;
}

export function groupArrivalsByRoute(
  predictions: NormalizedVehiclePrediction[],
  activeRouteIds: string[] = [],
): RouteArrivalGroup[] {
  const activeSet = new Set(
    activeRouteIds.map((routeId) => routeId.toLowerCase()),
  );
  const groups = new Map<string, RouteArrivalGroup>();

  for (const prediction of predictions) {
    const routeNumber = prediction.routeNumber || prediction.routeId;
    const key = routeNumber.toLowerCase();
    const existing = groups.get(key);

    if (existing) {
      existing.predictions.push(prediction);
      continue;
    }

    groups.set(key, {
      routeId: prediction.routeId,
      routeNumber,
      predictions: [prediction],
      isActiveRoute:
        activeSet.has(prediction.routeId.toLowerCase()) ||
        activeSet.has(routeNumber.toLowerCase()),
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      predictions: [...group.predictions].sort(
        (left, right) => left.timeToStation - right.timeToStation,
      ),
    }))
    .sort((left, right) => {
      if (left.isActiveRoute !== right.isActiveRoute) {
        return left.isActiveRoute ? -1 : 1;
      }

      const leftNext = left.predictions[0]?.timeToStation ?? Number.MAX_SAFE_INTEGER;
      const rightNext =
        right.predictions[0]?.timeToStation ?? Number.MAX_SAFE_INTEGER;
      return leftNext - rightNext;
    });
}
