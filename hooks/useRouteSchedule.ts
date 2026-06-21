"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { loadRouteSchedule } from "@/lib/ibusRouteSchedules";
import type { BaseVersionSelectionResult } from "@/lib/ibus/baseVersionSelection";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import { POLL_INTERVAL_MS } from "@/lib/storage";

export interface RouteScheduleQueryData {
  schedule: IbusRouteSchedule | null;
  selection: BaseVersionSelectionResult;
}

export function useRouteSchedule(
  routeId: string,
  enabled = true,
  liveBaseVersion?: string,
) {
  return useQuery({
    queryKey: ["route-schedule", routeId, liveBaseVersion ?? "auto"],
    queryFn: () => loadRouteSchedule(routeId, { liveBaseVersion }),
    enabled: Boolean(routeId) && enabled,
    staleTime: POLL_INTERVAL_MS * 4,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function getRouteScheduleFromQuery(
  data: RouteScheduleQueryData | undefined,
): IbusRouteSchedule | undefined {
  return data?.schedule ?? undefined;
}

export function getRouteScheduleSelectionFromQuery(
  data: RouteScheduleQueryData | undefined,
): BaseVersionSelectionResult | undefined {
  return data?.selection;
}
