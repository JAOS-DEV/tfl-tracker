import { describe, expect, it } from "vitest";
import {
  buildVehicleScheduleMatch,
  calculateScheduleDeviationMinutes,
  classifyScheduleDeviation,
  findNearestScheduledTime,
  scheduleBadgeLabel,
  scheduleStatusLabel,
} from "@/lib/scheduleDeviation";
import type { NormalizedTimetable } from "@/lib/tfl/types";

const timetable: NormalizedTimetable = {
  routeId: "337",
  direction: "outbound",
  fromStopPointId: "490000001A",
  available: true,
  journeys: [
    {
      journeyId: "1",
      direction: "outbound",
      departureTime: "2026-06-11T08:00:00.000Z",
      stopTimes: [
        {
          stopId: "490000002B",
          naptanId: "490000002B",
          stopName: "Stop B",
          scheduledArrival: "2026-06-11T08:05:00.000Z",
        },
      ],
    },
  ],
};

describe("schedule deviation helpers", () => {
  it("finds the nearest scheduled time", () => {
    const nearest = findNearestScheduledTime(
      "2026-06-11T08:07:00.000Z",
      timetable.journeys[0].stopTimes,
    );
    expect(nearest?.naptanId).toBe("490000002B");
  });

  it("classifies early, on-time, and late deviations", () => {
    expect(classifyScheduleDeviation(-3)).toBe("early");
    expect(classifyScheduleDeviation(0)).toBe("onTime");
    expect(classifyScheduleDeviation(4)).toBe("late");
    expect(classifyScheduleDeviation(1.5)).toBe("unknown");
  });

  it("formats schedule labels", () => {
    expect(scheduleStatusLabel("late", 4)).toBe("+4 late");
    expect(scheduleStatusLabel("early", -2)).toBe("-2 early");
    expect(scheduleBadgeLabel("onTime", 0, "high")).toBe("OK");
    expect(scheduleBadgeLabel("unknown", null, "unknown")).toBe("?");
  });

  it("builds a high-confidence late match", () => {
    const match = buildVehicleScheduleMatch(
      {
        vehicleId: "V1",
        direction: "outbound",
        expectedArrival: "2026-06-11T08:09:00.000Z",
        matched: true,
        nextStop: {
          id: "1",
          name: "Stop B",
          naptanId: "490000002B",
          isTimingPoint: false,
        },
        destinationName: "Richmond",
        ghostStatus: "normal",
      },
      timetable,
      2,
    );

    expect(match.scheduleStatus).toBe("late");
    expect(match.scheduleMatchConfidence).toBe("medium");
    expect(
      calculateScheduleDeviationMinutes(
        "2026-06-11T08:09:00.000Z",
        "2026-06-11T08:05:00.000Z",
      ),
    ).toBe(4);
  });

  it("returns unknown when timetable is unavailable", () => {
    const match = buildVehicleScheduleMatch(
      {
        vehicleId: "V1",
        direction: "outbound",
        expectedArrival: "2026-06-11T08:09:00.000Z",
        matched: true,
        nextStop: null,
        destinationName: "Richmond",
        ghostStatus: "normal",
      },
      { ...timetable, available: false, journeys: [] },
      1,
    );

    expect(match.scheduleMatchConfidence).toBe("unknown");
    expect(match.scheduleExplanation).toContain("Timetable unavailable");
  });
});
