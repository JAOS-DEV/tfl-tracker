import type { LoopLayoutConfig } from "@/lib/constants";
import {
  applyScheduleGhostDuplicateGuard,
  getScheduledGhostCandidates,
  isJourneyActiveAtTime,
  isJourneyScheduledForToday,
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
  collectDiagnostics?: boolean;
}

export interface AppendScheduledGhostResult {
  vehicles: EstimatedVehiclePosition[];
  diagnostics: string[];
}

const STALE_ROUTE_DATA_MS = 90_000;

function londonDaySeconds(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const second = Number(parts.find((part) => part.type === "second")?.value ?? 0);
  return hour * 3600 + minute * 60 + second;
}

export function appendScheduledGhostVehicles(
  input: AppendScheduledGhostInput,
): AppendScheduledGhostResult {
  if (!input.showScheduleGhosts || !input.schedule) {
    return {
      vehicles: input.vehicles,
      diagnostics: input.collectDiagnostics
        ? [
            `Schedule ghosts skipped: enabled=${input.showScheduleGhosts}, scheduleLoaded=${Boolean(input.schedule)}.`,
          ]
        : [],
    };
  }

  const isRouteDataStale = input.now - input.dataUpdatedAt > STALE_ROUTE_DATA_MS;
  const liveVehicles = input.vehicles.filter(
    (vehicle) => !vehicle.isScheduledGhostCandidate,
  );
  const nowDate = new Date(input.now);
  const nowSeconds = londonDaySeconds(nowDate);
  const activeScheduledJourneyCount = input.schedule.journeys.filter(
    (journey) =>
      isJourneyScheduledForToday(journey, nowDate) &&
      isJourneyActiveAtTime(journey, nowSeconds),
  ).length;

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

  const guarded = applyScheduleGhostDuplicateGuard(
    input.routeId,
    liveVehicles,
    candidates,
    input.collectDiagnostics ?? false,
  );

  const scheduledGhosts = guarded.candidates.map(scheduledGhostToVehiclePosition);
  const diagnostics = input.collectDiagnostics
    ? [
        `Schedule ghosts route ${input.routeId}: journeys=${input.schedule.journeys.length}, active=${activeScheduledJourneyCount}, live=${liveVehicles.length}, candidates=${candidates.length}, appended=${scheduledGhosts.length}, stale=${isRouteDataStale}, baseVersion=${input.schedule.baseVersion}.`,
        ...guarded.diagnostics,
      ]
    : guarded.diagnostics;

  if (process.env.NODE_ENV === "development" && input.collectDiagnostics) {
    console.debug(diagnostics.join(" "));
  }

  return {
    vehicles: [...liveVehicles, ...scheduledGhosts],
    diagnostics,
  };
}
