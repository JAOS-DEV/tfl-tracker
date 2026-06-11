"use client";

import { useQuery } from "@tanstack/react-query";
import type { NormalizedRoute } from "@/lib/tfl/types";

async function fetchRouteSequence(routeId: string): Promise<NormalizedRoute> {
  const response = await fetch(
    `/api/tfl/route-sequence?routeId=${encodeURIComponent(routeId)}`,
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to load route sequence");
  }

  const data = (await response.json()) as { route: NormalizedRoute };
  return data.route;
}

export function useRouteSequence(routeId: string) {
  return useQuery({
    queryKey: ["route-sequence", routeId],
    queryFn: () => fetchRouteSequence(routeId),
    staleTime: 300_000,
    enabled: Boolean(routeId),
  });
}
