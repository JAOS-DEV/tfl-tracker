"use client";

import { useQuery } from "@tanstack/react-query";
import type { RouteStatus } from "@/lib/tfl/types";

async function fetchLineStatus(routeId: string): Promise<RouteStatus> {
  const response = await fetch(
    `/api/tfl/line-status?routeId=${encodeURIComponent(routeId)}`,
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to load line status");
  }

  const data = (await response.json()) as { status: RouteStatus };
  return data.status;
}

export function useLineStatus(routeId: string) {
  return useQuery({
    queryKey: ["line-status", routeId],
    queryFn: () => fetchLineStatus(routeId),
    staleTime: 120_000,
    enabled: Boolean(routeId),
  });
}
