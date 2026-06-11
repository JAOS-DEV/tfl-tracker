"use client";

import { useQuery } from "@tanstack/react-query";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";
import { POLL_INTERVAL_MS } from "@/lib/storage";

interface LineArrivalsResponse {
  routeId: string;
  predictions: NormalizedVehiclePrediction[];
  fetchedAt: string;
}

async function fetchLineArrivals(
  routeId: string,
): Promise<LineArrivalsResponse> {
  const response = await fetch(
    `/api/tfl/line-arrivals?routeId=${encodeURIComponent(routeId)}`,
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to load line arrivals");
  }

  return response.json() as Promise<LineArrivalsResponse>;
}

export function useLineArrivals(routeId: string) {
  return useQuery({
    queryKey: ["line-arrivals", routeId],
    queryFn: () => fetchLineArrivals(routeId),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
    enabled: Boolean(routeId),
  });
}
