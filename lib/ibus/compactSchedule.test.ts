import { describe, expect, it } from "vitest";
import {
  buildCompactRouteSchedule,
  estimateCompactScheduleSizeBytes,
  estimateLegacyScheduleSizeBytes,
} from "@/lib/ibus/compactScheduleBuilder";
import {
  decodeCompactRouteSchedule,
  getJourneyDestination,
  getJourneyPatternStops,
  getJourneyStopTimes,
  normalizeRouteSchedule,
} from "@/lib/ibus/compactScheduleDecode";
import {
  bitmaskToServiceDays,
  COMPACT_ROUTE_SCHEDULE_SCHEMA_VERSION,
  serviceDaysToBitmask,
} from "@/lib/ibus/compactScheduleTypes";
import { buildRouteSchedule } from "@/lib/ibus/scheduleBuilder";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";

const legacySchedule: IbusRouteSchedule = {
  baseVersion: "20260606",
  routeId: "337",
  generatedAt: "2026-06-13T00:00:00.000Z",
  blockServiceDays: { "100": [1, 2, 3, 4, 5] },
  journeys: [
    {
      tripId: "9001",
      operatorCode: "CX",
      blockNo: "35094",
      blockIdx: "100",
      runningNo: "94",
      garageNo: "350",
      direction: "1",
      destination: "towards Stop B",
      patternIdx: "10",
      startTime: "10:00",
      startSeconds: 36000,
      endSeconds: 36300,
      journeyType: 1,
      serviceDays: [1, 2, 3, 4, 5],
      stops: [
        {
          sequence: 1,
          stopName: "Stop A",
          stopCode: "A1",
          naptanId: "490000001A",
          scheduledTime: "10:00",
          scheduledSeconds: 36000,
        },
        {
          sequence: 2,
          stopName: "Stop B",
          stopCode: "B1",
          naptanId: "490000002B",
          scheduledTime: "10:05",
          scheduledSeconds: 36300,
        },
      ],
    },
  ],
};

describe("compact route schedules", () => {
  it("writes schemaVersion 2 with deduped stops and patterns", () => {
    const compact = buildCompactRouteSchedule(legacySchedule);

    expect(compact.schemaVersion).toBe(COMPACT_ROUTE_SCHEDULE_SCHEMA_VERSION);
    expect(Object.keys(compact.stops)).toEqual(["490000001A", "490000002B"]);
    expect(compact.patterns["10"]).toEqual(["490000001A", "490000002B"]);
    expect(compact.journeys[0]?.p).toBe("10");
    expect(compact.journeys[0]?.w).toEqual([0, 300]);
    expect(compact.journeys[0]?.t).toBe("9001");
  });

  it("omits repeated full stop objects from journeys", () => {
    const compact = buildCompactRouteSchedule(legacySchedule);
    const journey = compact.journeys[0] as unknown as Record<string, unknown>;

    expect(journey.stops).toBeUndefined();
    expect(journey.destination).toBeUndefined();
    expect(journey.blockIdx).toBeUndefined();
  });

  it("decodes compact journeys back to scheduled stop times", () => {
    const compact = buildCompactRouteSchedule(legacySchedule);
    const decoded = decodeCompactRouteSchedule(compact);

    expect(decoded.journeys[0]?.tripId).toBe("9001");
    expect(decoded.journeys[0]?.runningNo).toBe("94");
    expect(decoded.journeys[0]?.stops[1]?.scheduledSeconds).toBe(36300);
    expect(decoded.journeys[0]?.stops[1]?.naptanId).toBe("490000002B");
    expect(decoded.journeys[0]?.destination).toBe("towards Stop B");
  });

  it("supports service day bitmask round trip", () => {
    expect(serviceDaysToBitmask([1, 2, 3, 4, 5])).toBe(62);
    expect(bitmaskToServiceDays(62)).toEqual([1, 2, 3, 4, 5]);
  });

  it("normalizes legacy schedule JSON without schemaVersion", () => {
    const normalized = normalizeRouteSchedule(legacySchedule);

    expect(normalized?.journeys).toHaveLength(1);
    expect(normalized?.journeys[0]?.stops).toHaveLength(2);
  });

  it("provides helper accessors for pattern stops, times, and destination", () => {
    const compact = buildCompactRouteSchedule(legacySchedule);
    const journey = compact.journeys[0]!;

    expect(getJourneyPatternStops(compact, journey)).toHaveLength(2);
    expect(getJourneyStopTimes(journey)).toEqual([36000, 36300]);
    expect(getJourneyDestination(compact, journey)).toBe("towards Stop B");
  });

  it("is significantly smaller than legacy JSON in fixture test", () => {
    const compact = buildCompactRouteSchedule(legacySchedule);
    const legacySize = estimateLegacyScheduleSizeBytes(legacySchedule);
    const compactSize = estimateCompactScheduleSizeBytes(compact);

    expect(compactSize).toBeLessThan(legacySize);
  });

  it("builds compact output from schedule builder pipeline", () => {
    const built = buildRouteSchedule({
      baseVersion: "20260606",
      routeId: "337",
      generatedAt: "2026-06-13T00:00:00.000Z",
      patterns: [
        {
          patternIdx: "10",
          contractLineNo: "337",
          direction: "1",
          patternType: 1,
        },
      ],
      stopsInPattern: [
        {
          stopInPatternIdx: "501",
          patternIdx: "10",
          stopPointIdx: "1",
          sequenceNo: 1,
          timingPointCode: "A1",
          destinationIdx: null,
        },
        {
          stopInPatternIdx: "502",
          patternIdx: "10",
          stopPointIdx: "2",
          sequenceNo: 2,
          timingPointCode: "B1",
          destinationIdx: null,
        },
      ],
      stopPoints: {
        "1": {
          stopPointIdx: "1",
          stopCode: "A1",
          stopName: "Stop A",
          naptanId: "490000001A",
        },
        "2": {
          stopPointIdx: "2",
          stopCode: "B1",
          stopName: "Stop B",
          naptanId: "490000002B",
        },
      },
      journeys: [
        {
          journeyIdx: "9001",
          blockIdx: "100",
          patternIdx: "10",
          tripNo: "1",
          journeyType: 1,
          startSeconds: 36000,
        },
      ],
      waits: [
        {
          journeyIdx: "9001",
          stopInPatternIdx: "501",
          waitSeconds: 60,
        },
      ],
      drives: [
        {
          journeyIdx: "9001",
          fromStopInPatternIdx: "501",
          toStopInPatternIdx: "502",
          driveSeconds: 240,
        },
      ],
      blocks: [
        {
          blockIdx: "100",
          blockNo: "35094",
          runningNo: "94",
          garageNo: "350",
          operatorCode: "CX",
        },
      ],
      blockServiceDays: { "100": [1, 2, 3, 4, 5] },
    });

    const compact = buildCompactRouteSchedule(built);
    const decoded = decodeCompactRouteSchedule(compact);

    expect(compact.schemaVersion).toBe(2);
    expect(decoded.journeys[0]?.stops[1]?.scheduledSeconds).toBe(36300);
  });
});
