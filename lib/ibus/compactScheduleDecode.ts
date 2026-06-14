import { secondsToHHMM } from "@/lib/ibus/scheduleParsers";
import type {
  IbusRouteSchedule,
  IbusScheduledJourney,
  IbusScheduledStop,
} from "@/lib/ibus/scheduleTypes";
import {
  bitmaskToServiceDays,
  type CompactJourneyRecord,
  type CompactRouteScheduleV2,
  isCompactRouteScheduleV2,
} from "@/lib/ibus/compactScheduleTypes";

export function getJourneyPatternStopIds(
  schedule: CompactRouteScheduleV2,
  journey: CompactJourneyRecord,
): string[] {
  return schedule.patterns[journey.p] ?? [];
}

export function getJourneyStopTimes(
  journey: CompactJourneyRecord,
): number[] {
  return journey.w.map((offset) => journey.s + offset);
}

export function getJourneyStartEnd(journey: CompactJourneyRecord): {
  startSeconds: number;
  endSeconds: number;
} {
  return {
    startSeconds: journey.s,
    endSeconds: journey.e,
  };
}

export function getJourneyDestination(
  schedule: CompactRouteScheduleV2,
  journey: CompactJourneyRecord,
): string | null {
  const stopIds = getJourneyPatternStopIds(schedule, journey);
  const finalStopId = stopIds[stopIds.length - 1];
  if (!finalStopId) {
    return null;
  }

  const finalStop = schedule.stops[finalStopId];
  if (finalStop?.n) {
    return `towards ${finalStop.n}`;
  }

  return null;
}

export function decodeCompactJourneyStops(
  schedule: CompactRouteScheduleV2,
  journey: CompactJourneyRecord,
): IbusScheduledStop[] {
  const stopIds = getJourneyPatternStopIds(schedule, journey);
  const scheduledSeconds = getJourneyStopTimes(journey);

  return stopIds.map((stopId, index) => {
    const stop = schedule.stops[stopId];
    const seconds = scheduledSeconds[index] ?? journey.s;
    const isNaptanKey = /^490/.test(stopId);

    return {
      sequence: index + 1,
      stopName: stop?.n ?? "Unknown stop",
      stopCode: stop?.c ?? null,
      naptanId: isNaptanKey ? stopId : null,
      scheduledTime: secondsToHHMM(seconds),
      scheduledSeconds: seconds,
    };
  });
}

export function decodeCompactJourney(
  schedule: CompactRouteScheduleV2,
  journey: CompactJourneyRecord,
): IbusScheduledJourney {
  const stops = decodeCompactJourneyStops(schedule, journey);
  const direction = journey.d ?? schedule.dirs?.[journey.p] ?? "";

  return {
    tripId: journey.t,
    operatorCode: journey.o ?? null,
    blockNo: journey.b ?? "",
    blockIdx: "",
    runningNo: journey.r ?? "",
    garageNo: journey.g ?? null,
    direction,
    destination: getJourneyDestination(schedule, journey),
    patternIdx: journey.p,
    startTime: secondsToHHMM(journey.s),
    startSeconds: journey.s,
    endSeconds: journey.e,
    journeyType: 1,
    serviceDays: bitmaskToServiceDays(journey.y),
    stops,
  };
}

export function decodeCompactRouteSchedule(
  schedule: CompactRouteScheduleV2,
): IbusRouteSchedule {
  return {
    baseVersion: schedule.baseVersion,
    routeId: schedule.routeId,
    generatedAt: schedule.generatedAt,
    journeys: schedule.journeys.map((journey) =>
      decodeCompactJourney(schedule, journey),
    ),
  };
}

function isLegacyRouteSchedule(value: unknown): value is IbusRouteSchedule {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as IbusRouteSchedule).baseVersion === "string" &&
    Array.isArray((value as IbusRouteSchedule).journeys)
  );
}

export function normalizeRouteSchedule(raw: unknown): IbusRouteSchedule | null {
  if (isCompactRouteScheduleV2(raw)) {
    return decodeCompactRouteSchedule(raw);
  }

  if (isLegacyRouteSchedule(raw)) {
    return {
      baseVersion: raw.baseVersion,
      routeId: raw.routeId,
      generatedAt: raw.generatedAt,
      journeys: raw.journeys,
    };
  }

  return null;
}

export function getJourneyPatternStops(
  schedule: CompactRouteScheduleV2,
  journey: CompactJourneyRecord,
): IbusScheduledStop[] {
  return decodeCompactJourneyStops(schedule, journey);
}
