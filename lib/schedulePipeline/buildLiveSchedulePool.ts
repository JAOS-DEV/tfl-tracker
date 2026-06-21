import {
  isJourneyActiveAtTime,
  isJourneyScheduledForServiceWindow,
} from "@/lib/scheduledGhostBuses";
import type { IbusRouteSchedule, IbusScheduledJourney } from "@/lib/ibus/scheduleTypes";

export interface LiveSchedulePool {
  allJourneys: IbusScheduledJourney[];
  activeJourneys: IbusScheduledJourney[];
  now: Date;
  nowSeconds: number;
  baseVersion: string;
}

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

export function buildLiveSchedulePool(
  routeSchedule: IbusRouteSchedule,
  now: number,
): LiveSchedulePool {
  const nowDate = new Date(now);
  const nowSeconds = londonDaySeconds(nowDate);
  const activeJourneys = routeSchedule.journeys.filter(
    (journey) =>
      isJourneyScheduledForServiceWindow(journey, nowDate, nowSeconds) &&
      isJourneyActiveAtTime(journey, nowSeconds),
  );

  return {
    allJourneys: routeSchedule.journeys,
    activeJourneys,
    now: nowDate,
    nowSeconds,
    baseVersion: routeSchedule.baseVersion,
  };
}
