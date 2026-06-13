import type { LoopLayoutConfig } from "@/lib/constants";
import {
  getScheduledGhostCandidates,
  scheduledGhostToVehiclePosition,
} from "@/lib/scheduledGhostBuses";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
} from "@/lib/tfl/types";

export interface AppendScheduledGhostInput {
  routeId: string;
  route: NormalizedRoute;
  layout: LoopLayoutConfig;
  vehicles: EstimatedVehiclePosition[];
  schedule: IbusRouteSchedule | null | undefined;
  now: number;
  dataUpdatedAt: number;
  liveBaseVersion?: string;
  showScheduleGhosts: boolean;
  includeLowConfidence: boolean;
}

const STALE_ROUTE_DATA_MS = 90_000;

export function appendScheduledGhostVehicles(
  input: AppendScheduledGhostInput,
): EstimatedVehiclePosition[] {
  if (!input.showScheduleGhosts || !input.schedule) {
    return input.vehicles;
  }

  const isRouteDataStale = input.now - input.dataUpdatedAt > STALE_ROUTE_DATA_MS;
  const liveVehicles = input.vehicles.filter(
    (vehicle) => !vehicle.isScheduledGhostCandidate,
  );

  const candidates = getScheduledGhostCandidates({
    routeId: input.routeId,
    now: new Date(input.now),
    liveVehicles,
    scheduledJourneys: input.schedule.journeys,
    route: input.route,
    layout: input.layout,
    liveBaseVersion: input.liveBaseVersion,
    scheduleBaseVersion: input.schedule.baseVersion,
    isRouteDataStale,
    includeLowConfidence: input.includeLowConfidence,
  });

  const scheduledGhosts = candidates.map(scheduledGhostToVehiclePosition);
  return [...liveVehicles, ...scheduledGhosts];
}
