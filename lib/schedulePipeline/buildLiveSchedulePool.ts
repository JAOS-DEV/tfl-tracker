import {
  isJourneyActiveAtTime,
  isJourneyScheduledForServiceWindow,
} from "@/lib/scheduledGhostBuses";
import type { IbusRouteSchedule, IbusScheduledJourney } from "@/lib/ibus/scheduleTypes";

export interface LiveSchedulePool {
  allJourneys: IbusScheduledJourney[];
  activeJourneys: IbusScheduledJourney[];
  liveMatchingJourneys: IbusScheduledJourney[];
  now: Date;
  nowSeconds: number;
  baseVersion: string;
}

const LIVE_MATCH_START_GRACE_MINUTES = 20;
const LIVE_MATCH_END_GRACE_MINUTES = 60;

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
  const liveMatchingJourneys = routeSchedule.journeys.filter(
    (journey) =>
      isJourneyScheduledForServiceWindow(
        journey,
        nowDate,
        nowSeconds,
        LIVE_MATCH_END_GRACE_MINUTES,
      ) &&
      isJourneyActiveAtTime(journey, nowSeconds, {
        startMinutes: LIVE_MATCH_START_GRACE_MINUTES,
        endMinutes: LIVE_MATCH_END_GRACE_MINUTES,
      }),
  );

  return {
    allJourneys: routeSchedule.journeys,
    activeJourneys,
    liveMatchingJourneys,
    now: nowDate,
    nowSeconds,
    baseVersion: routeSchedule.baseVersion,
  };
}
