"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { NormalizedRoute, NormalizedTimetable, RouteDirection } from "@/lib/tfl/types";

async function fetchTimetable(
  routeId: string,
  fromStopPointId: string,
  direction: RouteDirection,
): Promise<NormalizedTimetable> {
  const params = new URLSearchParams({
    routeId,
    fromStopPointId,
    direction,
  });

  const response = await fetch(`/api/tfl/timetable?${params.toString()}`);
  const data = (await response.json()) as NormalizedTimetable;
  return data;
}

export function useRouteTimetable(
  routeId: string,
  route: NormalizedRoute | undefined,
  enabled = true,
): {
  timetables: Partial<Record<RouteDirection, NormalizedTimetable | null>>;
  isLoading: boolean;
} {
  const outboundStopId = route?.outbound[0]?.naptanId;
  const inboundStopId = route?.inbound[0]?.naptanId;

  const outboundQuery = useQuery({
    queryKey: ["timetable", routeId, "outbound", outboundStopId],
    queryFn: () => fetchTimetable(routeId, outboundStopId ?? "", "outbound"),
    enabled: enabled && Boolean(route && outboundStopId),
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  const inboundQuery = useQuery({
    queryKey: ["timetable", routeId, "inbound", inboundStopId],
    queryFn: () => fetchTimetable(routeId, inboundStopId ?? "", "inbound"),
    enabled: enabled && Boolean(route && inboundStopId),
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  const timetables = useMemo(
    () => ({
      outbound: outboundQuery.data ?? null,
      inbound: inboundQuery.data ?? null,
    }),
    [outboundQuery.data, inboundQuery.data],
  );

  return {
    timetables,
    isLoading: outboundQuery.isLoading || inboundQuery.isLoading,
  };
}
