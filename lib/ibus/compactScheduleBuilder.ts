import type {
  IbusRouteSchedule,
  IbusScheduledStop,
} from "@/lib/ibus/scheduleTypes";
import {
  COMPACT_ROUTE_SCHEDULE_SCHEMA_VERSION,
  type CompactJourneyRecord,
  type CompactRouteScheduleV2,
  serviceDaysToBitmask,
} from "@/lib/ibus/compactScheduleTypes";

function stopDictionaryKey(stop: IbusScheduledStop): string {
  if (stop.naptanId) {
    return stop.naptanId;
  }
  if (stop.stopCode) {
    return `c:${stop.stopCode}`;
  }
  return `s:${stop.sequence}:${stop.stopName}`;
}

function upsertStopRecord(
  stops: CompactRouteScheduleV2["stops"],
  key: string,
  stop: IbusScheduledStop,
): void {
  const existing = stops[key];
  stops[key] = {
    n: stop.stopName || existing?.n,
    c: stop.stopCode ?? stop.naptanId ?? existing?.c,
  };
}

export function buildCompactRouteSchedule(
  schedule: IbusRouteSchedule,
): CompactRouteScheduleV2 {
  const stops: CompactRouteScheduleV2["stops"] = {};
  const patterns: CompactRouteScheduleV2["patterns"] = {};
  const dirs: CompactRouteScheduleV2["dirs"] = {};
  const journeys: CompactJourneyRecord[] = [];

  for (const journey of schedule.journeys) {
    if (!patterns[journey.patternIdx]) {
      patterns[journey.patternIdx] = journey.stops.map((stop) => {
        const key = stopDictionaryKey(stop);
        upsertStopRecord(stops, key, stop);
        return key;
      });
      dirs[journey.patternIdx] = journey.direction;
    }

    const offsets = journey.stops.map(
      (stop) => stop.scheduledSeconds - journey.startSeconds,
    );

    journeys.push({
      t: journey.tripId,
      ...(journey.runningNo ? { r: journey.runningNo } : {}),
      ...(journey.blockNo ? { b: journey.blockNo } : {}),
      ...(journey.garageNo ? { g: journey.garageNo } : {}),
      ...(journey.operatorCode ? { o: journey.operatorCode } : {}),
      d: journey.direction,
      p: journey.patternIdx,
      s: journey.startSeconds,
      e: journey.endSeconds,
      ...(serviceDaysToBitmask(journey.serviceDays) !== undefined
        ? { y: serviceDaysToBitmask(journey.serviceDays) }
        : {}),
      w: offsets,
    });
  }

  return {
    schemaVersion: COMPACT_ROUTE_SCHEDULE_SCHEMA_VERSION,
    baseVersion: schedule.baseVersion,
    routeId: schedule.routeId,
    generatedAt: schedule.generatedAt,
    stops,
    patterns,
    ...(Object.keys(dirs).length > 0 ? { dirs } : {}),
    journeys,
  };
}

export function serializeCompactRouteSchedule(
  schedule: CompactRouteScheduleV2,
): string {
  return `${JSON.stringify(schedule)}\n`;
}

export function estimateLegacyScheduleSizeBytes(
  schedule: IbusRouteSchedule,
): number {
  return Buffer.byteLength(`${JSON.stringify(schedule)}\n`, "utf8");
}

export function estimateCompactScheduleSizeBytes(
  schedule: CompactRouteScheduleV2,
): number {
  return Buffer.byteLength(serializeCompactRouteSchedule(schedule), "utf8");
}
