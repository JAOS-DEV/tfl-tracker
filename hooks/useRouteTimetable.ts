"use client";

import { useQuery } from "@tanstack/react-query";
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
): {
  timetables: Partial<Record<RouteDirection, NormalizedTimetable | null>>;
  isLoading: boolean;
} {
  const outboundStopId = route?.outbound[0]?.naptanId;
  const inboundStopId = route?.inbound[0]?.naptanId;

  const outboundQuery = useQuery({
    queryKey: ["timetable", routeId, "outbound", outboundStopId],
    queryFn: () => fetchTimetable(routeId, outboundStopId ?? "", "outbound"),
    enabled: Boolean(route && outboundStopId),
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  const inboundQuery = useQuery({
    queryKey: ["timetable", routeId, "inbound", inboundStopId],
    queryFn: () => fetchTimetable(routeId, inboundStopId ?? "", "inbound"),
    enabled: Boolean(route && inboundStopId),
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  return {
    timetables: {
      outbound: outboundQuery.data ?? null,
      inbound: inboundQuery.data ?? null,
    },
    isLoading: outboundQuery.isLoading || inboundQuery.isLoading,
  };
}
