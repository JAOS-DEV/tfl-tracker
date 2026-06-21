import { normalizeRunningNumber } from "@/lib/runningNumber";
import type { IbusScheduledJourney } from "@/lib/ibus/scheduleTypes";

export interface ScheduleIndexes {
  byTripIdBaseVersion: Map<string, IbusScheduledJourney[]>;
  byRunningNo: Map<string, IbusScheduledJourney[]>;
  byRunningNoBlockNo: Map<string, IbusScheduledJourney[]>;
  byBlockNo: Map<string, IbusScheduledJourney[]>;
}

function appendIndex(
  map: Map<string, IbusScheduledJourney[]>,
  key: string,
  journey: IbusScheduledJourney,
): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(journey);
    return;
  }
  map.set(key, [journey]);
}

export function buildScheduleIndexes(
  journeys: IbusScheduledJourney[],
  baseVersion: string,
): ScheduleIndexes {
  const byTripIdBaseVersion = new Map<string, IbusScheduledJourney[]>();
  const byRunningNo = new Map<string, IbusScheduledJourney[]>();
  const byRunningNoBlockNo = new Map<string, IbusScheduledJourney[]>();
  const byBlockNo = new Map<string, IbusScheduledJourney[]>();

  for (const journey of journeys) {
    appendIndex(
      byTripIdBaseVersion,
      `${baseVersion}:${journey.tripId}`,
      journey,
    );

    const runningNo = normalizeRunningNumber(journey.runningNo);
    if (runningNo) {
      appendIndex(byRunningNo, runningNo, journey);
    }

    const blockNo = journey.blockNo.trim();
    if (runningNo && blockNo) {
      appendIndex(byRunningNoBlockNo, `${runningNo}:${blockNo}`, journey);
    }
    if (blockNo) {
      appendIndex(byBlockNo, blockNo, journey);
    }
  }

  return {
    byTripIdBaseVersion,
    byRunningNo,
    byRunningNoBlockNo,
    byBlockNo,
  };
}
