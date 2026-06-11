"use client";

import { useQuery } from "@tanstack/react-query";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";
import { POLL_INTERVAL_MS } from "@/lib/storage";

interface StopArrivalsResponse {
  stopPointId: string;
  predictions: NormalizedVehiclePrediction[];
  fetchedAt: string;
}

async function fetchStopArrivals(
  stopPointId: string,
): Promise<StopArrivalsResponse> {
  const response = await fetch(
    `/api/tfl/stop-arrivals?stopPointId=${encodeURIComponent(stopPointId)}`,
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to load stop arrivals");
  }

  return response.json() as Promise<StopArrivalsResponse>;
}

export function useStopArrivals(stopPointId: string | null) {
  return useQuery({
    queryKey: ["stop-arrivals", stopPointId],
    queryFn: () => fetchStopArrivals(stopPointId as string),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
    enabled: Boolean(stopPointId),
  });
}
