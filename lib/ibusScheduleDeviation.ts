import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import { buildLiveSchedulePool } from "@/lib/schedulePipeline/buildLiveSchedulePool";
import { buildScheduleIndexes } from "@/lib/schedulePipeline/buildScheduleIndexes";
import {
  matchLiveVehicleToSchedule,
  matchLiveVehiclesToSchedule,
} from "@/lib/schedulePipeline/matchLiveVehicleToSchedule";
import type { ScheduleDisplayState } from "@/lib/schedulePipeline/types";
import { buildVehicleScheduleMatch } from "@/lib/scheduleDeviation";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  VehicleScheduleMatch,
} from "@/lib/tfl/types";

export { ibusScheduledSecondsToInstant } from "@/lib/ibusScheduleDeviationTime";

function displayStateToVehicleMatch(
  display: ScheduleDisplayState,
): VehicleScheduleMatch {
  return {
    deviationMinutes: display.deviationMinutes,
    scheduleStatus: display.scheduleStatus,
    scheduleStatusLabel: display.scheduleStatusLabel,
    scheduleMatchConfidence: display.scheduleMatchConfidence,
    matchedScheduledTime: display.matchedScheduledTime,
    matchedStopName: display.matchedStopName,
    scheduleDataAvailable: display.scheduleDataAvailable,
    scheduleExplanation: display.scheduleExplanation,
    matchedJourneyId: display.matchedJourneyId,
  };
}

export function buildIbusVehicleScheduleMatch(
  vehicle: EstimatedVehiclePosition,
  routeSchedule: IbusRouteSchedule,
  route: NormalizedRoute,
  now: Date,
): VehicleScheduleMatch {
  if (vehicle.ghostStatus === "suspectedGhost") {
    return buildVehicleScheduleMatch(vehicle, null, 1, route);
  }

  const pool = buildLiveSchedulePool(routeSchedule, now.getTime());
  const indexes = buildScheduleIndexes(pool.activeJourneys, pool.baseVersion);
  const timing = matchLiveVehicleToSchedule(
    vehicle,
    pool,
    indexes,
    route,
    pool.baseVersion,
  );

  return displayStateToVehicleMatch(timing.display);
}

export function matchVehiclesToIbusRouteSchedule(
  vehicles: EstimatedVehiclePosition[],
  routeSchedule: IbusRouteSchedule,
  route: NormalizedRoute,
  now: number,
): EstimatedVehiclePosition[] {
  const pool = buildLiveSchedulePool(routeSchedule, now);
  const indexes = buildScheduleIndexes(pool.activeJourneys, pool.baseVersion);

  return matchLiveVehiclesToSchedule(
    vehicles,
    pool,
    indexes,
    route,
  ).vehicles;
}

export function resolveAdherenceFromScheduleStatus(
  scheduleStatus: EstimatedVehiclePosition["scheduleStatus"],
): EstimatedVehiclePosition["adherence"] {
  if (scheduleStatus === "late") {
    return "late";
  }
  if (scheduleStatus === "early") {
    return "early";
  }
  if (scheduleStatus === "onTime") {
    return "onTime";
  }
  return "unknown";
}
