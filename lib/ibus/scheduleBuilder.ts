import type {
  ParsedJourneyDetail,
  ParsedJourneyDrive,
  ParsedJourneyWait,
  ParsedPattern,
  ParsedStopInPattern,
  ParsedStopPoint,
} from "@/lib/ibus/scheduleParsers";
import { secondsToHHMM } from "@/lib/ibus/scheduleParsers";
import type {
  IbusRouteSchedule,
  IbusScheduledJourney,
  IbusScheduledStop,
} from "@/lib/ibus/scheduleTypes";

const IN_SERVICE_JOURNEY_TYPE = 1;

export interface ScheduleBlockRecord {
  blockIdx: string;
  blockNo: string;
  runningNo: string;
  garageNo: string | null;
  operatorCode: string | null;
}

export interface BuildRouteScheduleInput {
  baseVersion: string;
  routeId: string;
  generatedAt: string;
  patterns: ParsedPattern[];
  stopsInPattern: ParsedStopInPattern[];
  stopPoints: Record<string, ParsedStopPoint>;
  journeys: ParsedJourneyDetail[];
  waits: ParsedJourneyWait[];
  drives: ParsedJourneyDrive[];
  blocks: ScheduleBlockRecord[];
  blockServiceDays: Record<string, number[]>;
}

export function buildBlockServiceDays(
  calendarEntries: Array<{ blockIdx: string; calendarDay: string; runsOnDay: boolean }>,
): Record<string, number[]> {
  const result: Record<string, Set<number>> = {};

  for (const entry of calendarEntries) {
    if (!entry.runsOnDay) {
      continue;
    }

    const day = new Date(`${entry.calendarDay}T12:00:00Z`).getUTCDay();
    result[entry.blockIdx] ??= new Set<number>();
    result[entry.blockIdx].add(day);
  }

  const normalized: Record<string, number[]> = {};
  for (const [blockIdx, days] of Object.entries(result)) {
    normalized[blockIdx] = [...days].sort((left, right) => left - right);
  }
  return normalized;
}

function groupStopsByPattern(
  stopsInPattern: ParsedStopInPattern[],
): Map<string, ParsedStopInPattern[]> {
  const grouped = new Map<string, ParsedStopInPattern[]>();

  for (const stop of stopsInPattern) {
    const existing = grouped.get(stop.patternIdx) ?? [];
    existing.push(stop);
    grouped.set(stop.patternIdx, existing);
  }

  for (const [patternIdx, stops] of grouped) {
    grouped.set(
      patternIdx,
      [...stops].sort((left, right) => left.sequenceNo - right.sequenceNo),
    );
  }

  return grouped;
}

function buildWaitMap(
  waits: ParsedJourneyWait[],
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (const wait of waits) {
    const journeyWaits = result.get(wait.journeyIdx) ?? new Map<string, number>();
    journeyWaits.set(wait.stopInPatternIdx, wait.waitSeconds);
    result.set(wait.journeyIdx, journeyWaits);
  }

  return result;
}

function buildDriveMap(
  drives: ParsedJourneyDrive[],
): Map<string, Map<string, { toStopInPatternIdx: string; driveSeconds: number }>> {
  const result = new Map<
    string,
    Map<string, { toStopInPatternIdx: string; driveSeconds: number }>
  >();

  for (const drive of drives) {
    const journeyDrives =
      result.get(drive.journeyIdx) ??
      new Map<string, { toStopInPatternIdx: string; driveSeconds: number }>();
    journeyDrives.set(drive.fromStopInPatternIdx, {
      toStopInPatternIdx: drive.toStopInPatternIdx,
      driveSeconds: drive.driveSeconds,
    });
    result.set(drive.journeyIdx, journeyDrives);
  }

  return result;
}

export function computeJourneyStops(
  journey: ParsedJourneyDetail,
  patternStops: ParsedStopInPattern[],
  stopPoints: Record<string, ParsedStopPoint>,
  waitMap: Map<string, number>,
  driveMap: Map<string, { toStopInPatternIdx: string; driveSeconds: number }>,
): IbusScheduledStop[] {
  if (patternStops.length === 0) {
    return [];
  }

  const stops: IbusScheduledStop[] = [];
  let currentSeconds = journey.startSeconds;
  const firstStop = patternStops[0];
  const firstPoint = stopPoints[firstStop.stopPointIdx];

  stops.push({
    sequence: firstStop.sequenceNo,
    stopName: firstPoint?.stopName ?? "Unknown stop",
    stopCode: firstStop.timingPointCode ?? firstPoint?.stopCode ?? null,
    naptanId: firstPoint?.naptanId ?? null,
    scheduledTime: secondsToHHMM(currentSeconds),
    scheduledSeconds: currentSeconds,
  });

  for (let index = 0; index < patternStops.length - 1; index += 1) {
    const current = patternStops[index];
    const waitSeconds = waitMap.get(current.stopInPatternIdx) ?? 0;
    currentSeconds += waitSeconds;

    const drive = driveMap.get(current.stopInPatternIdx);
    if (!drive) {
      break;
    }

    currentSeconds += drive.driveSeconds;
    const nextStop = patternStops.find(
      (stop) => stop.stopInPatternIdx === drive.toStopInPatternIdx,
    );
    if (!nextStop) {
      break;
    }

    const stopPoint = stopPoints[nextStop.stopPointIdx];
    stops.push({
      sequence: nextStop.sequenceNo,
      stopName: stopPoint?.stopName ?? "Unknown stop",
      stopCode: nextStop.timingPointCode ?? stopPoint?.stopCode ?? null,
      naptanId: stopPoint?.naptanId ?? null,
      scheduledTime: secondsToHHMM(currentSeconds),
      scheduledSeconds: currentSeconds,
    });
  }

  return stops;
}

export function buildRouteSchedule(
  input: BuildRouteScheduleInput,
): IbusRouteSchedule {
  const routePatternIds = new Set(
    input.patterns
      .filter((pattern) => pattern.contractLineNo === input.routeId)
      .map((pattern) => pattern.patternIdx),
  );
  const patternByIdx = new Map(
    input.patterns.map((pattern) => [pattern.patternIdx, pattern] as const),
  );
  const stopsByPattern = groupStopsByPattern(input.stopsInPattern);
  const blockByIdx = new Map(
    input.blocks.map((block) => [block.blockIdx, block] as const),
  );
  const waitMaps = buildWaitMap(input.waits);
  const driveMaps = buildDriveMap(input.drives);
  const journeys: IbusScheduledJourney[] = [];

  for (const journey of input.journeys) {
    if (journey.journeyType !== IN_SERVICE_JOURNEY_TYPE) {
      continue;
    }

    if (!routePatternIds.has(journey.patternIdx)) {
      continue;
    }

    const pattern = patternByIdx.get(journey.patternIdx);
    const block = blockByIdx.get(journey.blockIdx);
    const patternStops = stopsByPattern.get(journey.patternIdx) ?? [];
    const stops = computeJourneyStops(
      journey,
      patternStops,
      input.stopPoints,
      waitMaps.get(journey.journeyIdx) ?? new Map<string, number>(),
      driveMaps.get(journey.journeyIdx) ?? new Map(),
    );

    if (stops.length === 0) {
      continue;
    }

    const endSeconds = stops[stops.length - 1]?.scheduledSeconds ?? journey.startSeconds;
    const finalStopName = stops[stops.length - 1]?.stopName;
    journeys.push({
      tripId: journey.journeyIdx,
      operatorCode: block?.operatorCode ?? null,
      blockNo: block?.blockNo ?? "",
      blockIdx: journey.blockIdx,
      runningNo: block?.runningNo ?? "",
      garageNo: block?.garageNo ?? null,
      direction: pattern?.direction ?? "1",
      destination: finalStopName ? `towards ${finalStopName}` : null,
      patternIdx: journey.patternIdx,
      startTime: secondsToHHMM(journey.startSeconds),
      startSeconds: journey.startSeconds,
      endSeconds,
      journeyType: journey.journeyType,
      serviceDays: input.blockServiceDays[journey.blockIdx] ?? [],
      stops,
    });
  }

  return {
    baseVersion: input.baseVersion,
    routeId: input.routeId,
    generatedAt: input.generatedAt,
    blockServiceDays: input.blockServiceDays,
    journeys,
  };
}
