import { describe, expect, it } from "vitest";
import type { IbusScheduledJourney } from "@/lib/ibus/scheduleTypes";
import { selectScheduleGhostJourneys } from "@/lib/schedulePipeline/selectScheduleGhostJourneys";

function journey(input: {
  runningNo: string;
  tripId?: string;
  startSeconds?: number;
  direction?: string;
}): IbusScheduledJourney {
  const startSeconds = input.startSeconds ?? 36_000;
  return {
    tripId: input.tripId ?? `trip-${input.runningNo}-${startSeconds}`,
    operatorCode: "CX",
    blockNo: `block-${input.runningNo}`,
    blockIdx: "",
    runningNo: input.runningNo,
    garageNo: "123",
    direction: input.direction ?? "1",
    destination: "Clapham Junction",
    patternIdx: "pattern-1",
    startTime: "10:00",
    startSeconds,
    endSeconds: startSeconds + 600,
    journeyType: 1,
    serviceDays: [4],
    stops: [],
  };
}

function board(
  runningNumbers: number[],
  startSeconds: number[],
): IbusScheduledJourney[] {
  return runningNumbers.flatMap((runningNo) =>
    startSeconds.map((startSecond) =>
      journey({
        runningNo: String(runningNo),
        startSeconds: startSecond,
        tripId: `trip-${runningNo}-${startSecond}`,
      }),
    ),
  );
}

const weekdayStarts = [18_000, 21_600, 36_000, 54_000, 72_000];
const currentRuns = [331, 332, 333, 334, 335, 336, 337, 338];
const oldRuns = [561, 562, 563, 564, 565, 566, 567, 568];

describe("selectScheduleGhostJourneys", () => {
  it("drops the unused duplicate board when live trips use the other one", () => {
    const todaysJourneys = [
      ...board(currentRuns, weekdayStarts),
      ...board(oldRuns, weekdayStarts),
    ];
    const activeJourneys = [
      journey({ runningNo: "335", startSeconds: 54_000, tripId: "trip-335-54000" }),
      journey({ runningNo: "566", startSeconds: 50_000, tripId: "trip-566-50000" }),
    ];

    const result = selectScheduleGhostJourneys({
      boardJourneys: todaysJourneys,
      activeJourneys,
      liveTripIds: ["trip-331-18000"],
    });

    expect(result.journeys.map((item) => item.runningNo)).toEqual(["335"]);
    expect(result.droppedRunningNumbers).toEqual([
      "561",
      "562",
      "563",
      "564",
      "565",
      "566",
      "567",
      "568",
    ]);
    expect(result.liveMatchedRunningNumbers).toEqual(["331"]);
  });

  it("keeps both boards when no live trip has matched either one yet", () => {
    const journeys = [
      ...board(currentRuns, weekdayStarts),
      ...board(oldRuns, weekdayStarts),
    ];

    const result = selectScheduleGhostJourneys({
      boardJourneys: journeys,
      activeJourneys: journeys,
      liveTripIds: [],
    });

    expect(result.droppedRunningNumbers).toEqual([]);
    expect(result.journeys).toHaveLength(journeys.length);
  });

  it("keeps both boards when live trips hit each of them", () => {
    const journeys = [
      ...board(currentRuns, weekdayStarts),
      ...board(oldRuns, weekdayStarts),
    ];

    const result = selectScheduleGhostJourneys({
      boardJourneys: journeys,
      activeJourneys: journeys,
      liveTripIds: ["trip-331-18000", "trip-561-18000"],
    });

    expect(result.droppedRunningNumbers).toEqual([]);
    expect(result.journeys).toHaveLength(journeys.length);
  });

  it("keeps a second running-number group that does not share departures", () => {
    const mainBoard = board([1, 2, 3, 4, 5, 6, 7, 8], weekdayStarts);
    const extraBoard = board([81, 82, 83, 84, 85, 86, 87], [20_000, 40_000, 60_000]);
    const journeys = [...mainBoard, ...extraBoard];

    const result = selectScheduleGhostJourneys({
      boardJourneys: journeys,
      activeJourneys: journeys,
      liveTripIds: ["trip-1-18000"],
    });

    expect(result.droppedRunningNumbers).toEqual([]);
    expect(result.journeys).toHaveLength(journeys.length);
  });

  it("keeps a much smaller extra set even when some departure times overlap", () => {
    const mainBoard = board(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      weekdayStarts,
    );
    const extraBoard = board([103, 104, 105, 106, 107], weekdayStarts);
    const journeys = [...mainBoard, ...extraBoard];

    const result = selectScheduleGhostJourneys({
      boardJourneys: journeys,
      activeJourneys: journeys,
      liveTripIds: ["trip-1-18000"],
    });

    expect(result.droppedRunningNumbers).toEqual([]);
  });
});
