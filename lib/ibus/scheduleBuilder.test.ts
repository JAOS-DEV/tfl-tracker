import { describe, expect, it } from "vitest";
import { buildRouteSchedule } from "@/lib/ibus/scheduleBuilder";

describe("buildRouteSchedule", () => {
  it("combines journeys from every contract route for one passenger service", () => {
    const schedule = buildRouteSchedule({
      baseVersion: "20250619",
      routeId: "14",
      contractLineNos: ["14", "N14"],
      generatedAt: "2026-07-01T00:00:00.000Z",
      patterns: [
        { patternIdx: "day-pattern", contractLineNo: "14", direction: "1", patternType: 1 },
        {
          patternIdx: "night-pattern",
          contractLineNo: "N14",
          direction: "1",
          patternType: 1,
        },
      ],
      stopsInPattern: [
        {
          stopInPatternIdx: "day-stop",
          patternIdx: "day-pattern",
          stopPointIdx: "stop-a",
          sequenceNo: 1,
          timingPointCode: "A",
          destinationIdx: null,
        },
        {
          stopInPatternIdx: "night-stop",
          patternIdx: "night-pattern",
          stopPointIdx: "stop-a",
          sequenceNo: 1,
          timingPointCode: "A",
          destinationIdx: null,
        },
      ],
      stopPoints: {
        "stop-a": {
          stopPointIdx: "stop-a",
          stopCode: "A",
          stopName: "Russell Square",
          naptanId: "490000200E",
        },
      },
      journeys: [
        {
          journeyIdx: "day-journey",
          blockIdx: "day-block",
          patternIdx: "day-pattern",
          tripNo: "1",
          journeyType: 1,
          startSeconds: 23 * 60 * 60,
        },
        {
          journeyIdx: "night-journey",
          blockIdx: "night-block",
          patternIdx: "night-pattern",
          tripNo: "2",
          journeyType: 1,
          startSeconds: 26 * 60 * 60 + 30 * 60,
        },
      ],
      waits: [],
      drives: [],
      blocks: [
        {
          blockIdx: "day-block",
          blockNo: "day",
          runningNo: "1",
          garageNo: null,
          operatorCode: "LG",
        },
        {
          blockIdx: "night-block",
          blockNo: "night",
          runningNo: "2",
          garageNo: null,
          operatorCode: "LG",
        },
      ],
      blockServiceDays: {
        "day-block": [1],
        "night-block": [1],
      },
    });

    expect(schedule.journeys.map((journey) => journey.tripId)).toEqual([
      "day-journey",
      "night-journey",
    ]);
    expect(schedule.journeys[1]?.startSeconds).toBe(26 * 60 * 60 + 30 * 60);
  });
});
