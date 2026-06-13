import { describe, expect, it } from "vitest";
import fixture from "@/lib/tfl/fixtures/timetable-response.json";
import {
  flattenTimetableStopTimes,
  normalizeTimetable,
} from "@/lib/tfl/timetableNormalizers";

describe("normalizeTimetable", () => {
  it("normalizes fixture timetable journeys", () => {
    const timetable = normalizeTimetable(
      fixture,
      "337",
      "490000001A",
      "outbound",
      new Date("2026-06-11T07:30:00.000Z"),
    );

    expect(timetable.available).toBe(true);
    expect(timetable.journeys.length).toBeGreaterThan(0);
    expect(timetable.journeys[0]?.stopTimes.length).toBe(3);
  });

  it("returns unavailable timetable for malformed responses", () => {
    const timetable = normalizeTimetable(null, "337", "490000001A", "outbound");
    expect(timetable.available).toBe(false);
    expect(timetable.journeys).toEqual([]);
  });

  it("returns unavailable timetable when TfL reports an error", () => {
    const timetable = normalizeTimetable(
      { statusErrorMessage: "No timetable" },
      "337",
      "490000001A",
      "outbound",
    );
    expect(timetable.available).toBe(false);
    expect(timetable.unavailableReason).toContain("No timetable");
  });

  it("maps TfL hour 24 journeys near midnight", () => {
    const timetable = normalizeTimetable(
      {
        ...fixture,
        timetable: {
          ...fixture.timetable,
          routes: [
            {
              ...fixture.timetable.routes[0],
              schedules: [
                {
                  name: "Night",
                  knownJourneys: [{ hour: "24", minute: "14", intervalId: 1 }],
                },
              ],
            },
          ],
        },
      },
      "337",
      "490000001A",
      "outbound",
      new Date("2026-06-12T23:52:00.000Z"),
    );

    expect(timetable.journeys[0]?.departureTime).toBe("2026-06-12T23:14:00.000Z");
  });
});

describe("flattenTimetableStopTimes", () => {
  it("flattens stop times across journeys", () => {
    const timetable = normalizeTimetable(
      fixture,
      "337",
      "490000001A",
      "outbound",
      new Date("2026-06-11T07:30:00.000Z"),
    );

    expect(flattenTimetableStopTimes(timetable).length).toBeGreaterThan(0);
  });
});
