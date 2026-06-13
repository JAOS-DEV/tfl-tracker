import { describe, expect, it } from "vitest";
import {
  alignScheduledInstantToReference,
  buildScheduledDate,
  parseTflJourneyTime,
} from "@/lib/londonTime";

describe("parseTflJourneyTime", () => {
  it("maps TfL hour 24 to after-midnight times", () => {
    expect(parseTflJourneyTime("24", "14")).toEqual({
      hour: 0,
      minute: 14,
      hourTwentyFour: true,
    });
  });
});

describe("buildScheduledDate", () => {
  it("anchors late-evening journeys to the previous London day after midnight", () => {
    const reference = new Date("2026-06-12T23:52:00.000Z");
    expect(buildScheduledDate("23", "50", reference).toISOString()).toBe(
      "2026-06-12T22:50:00.000Z",
    );
  });

  it("maps TfL hour 24 journeys to just after midnight", () => {
    const reference = new Date("2026-06-12T23:52:00.000Z");
    expect(buildScheduledDate("24", "14", reference).toISOString()).toBe(
      "2026-06-12T23:14:00.000Z",
    );
  });

  it("keeps morning journeys on the current London day", () => {
    const reference = new Date("2026-06-13T07:30:00.000Z");
    expect(buildScheduledDate("08", "00", reference).toISOString()).toBe(
      "2026-06-13T07:00:00.000Z",
    );
  });
});

describe("alignScheduledInstantToReference", () => {
  it("re-anchors a stale scheduled instant onto the prediction day", () => {
    const aligned = alignScheduledInstantToReference(
      "2026-06-13T22:50:00.000Z",
      new Date("2026-06-12T23:58:26.000Z"),
    );

    expect(aligned.toISOString()).toBe("2026-06-12T22:50:00.000Z");
  });
});
