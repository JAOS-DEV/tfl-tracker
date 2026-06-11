"use client";

import { useQuery } from "@tanstack/react-query";
import type { StopDisruption } from "@/lib/tfl/types";

async function fetchStopDisruptions(
  stopPointIds: string[],
): Promise<StopDisruption[]> {
  const response = await fetch(
    `/api/tfl/stop-disruptions?stopPointIds=${encodeURIComponent(stopPointIds.join(","))}`,
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to load stop disruptions");
  }

  const data = (await response.json()) as { disruptions: StopDisruption[] };
  return data.disruptions;
}

export function useStopDisruptions(stopPointIds: string[]) {
  const queryKey = [...stopPointIds].sort().join(",");

  return useQuery({
    queryKey: ["stop-disruptions", queryKey],
    queryFn: () => fetchStopDisruptions(stopPointIds),
    staleTime: 300_000,
    enabled: stopPointIds.length > 0,
  });
}
