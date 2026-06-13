"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { loadRouteSchedule } from "@/lib/ibusRouteSchedules";
import { POLL_INTERVAL_MS } from "@/lib/storage";

export function useRouteSchedule(routeId: string, enabled = true) {
  return useQuery({
    queryKey: ["route-schedule", routeId],
    queryFn: () => loadRouteSchedule(routeId),
    enabled: Boolean(routeId) && enabled,
    staleTime: POLL_INTERVAL_MS * 4,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}
