import type { QueryClient } from "@tanstack/react-query";
import type { ActiveRoute, RouteIntelligenceResult } from "@/lib/tfl/types";
import {
  vehicleCandidateFromPosition,
  type VehicleSearchCandidate,
} from "@/lib/vehicleSearch";

function scoreIntelligenceCacheKey(key: readonly unknown[]): number {
  const serialized = JSON.stringify(key);
  let score = 0;

  if (serialized.includes('"ibus"')) {
    score += 10;
  }
  if (serialized.includes('"full"')) {
    score += 5;
  }

  return score;
}

export function pickBestRouteIntelligence(
  entries: Array<[readonly unknown[], RouteIntelligenceResult | undefined]>,
): RouteIntelligenceResult | null {
  let best: RouteIntelligenceResult | null = null;
  let bestScore = -1;

  for (const [key, data] of entries) {
    if (!data?.vehicles?.length) {
      continue;
    }

    const score = scoreIntelligenceCacheKey(key) + data.vehicles.length;
    if (score > bestScore) {
      bestScore = score;
      best = data;
    }
  }

  return best;
}

export function collectActiveVehicleCandidates(
  queryClient: QueryClient,
  activeRoutes: ActiveRoute[],
): VehicleSearchCandidate[] {
  const candidates: VehicleSearchCandidate[] = [];

  for (const route of activeRoutes) {
    const cacheEntries = queryClient.getQueriesData<RouteIntelligenceResult>({
      queryKey: ["route-intelligence", route.routeId],
    });
    const intelligence = pickBestRouteIntelligence(cacheEntries);

    if (!intelligence?.vehicles?.length) {
      continue;
    }

    for (const vehicle of intelligence.vehicles) {
      candidates.push(
        vehicleCandidateFromPosition(
          route.routeId,
          vehicle,
          route.routeName,
        ),
      );
    }
  }

  return candidates;
}
