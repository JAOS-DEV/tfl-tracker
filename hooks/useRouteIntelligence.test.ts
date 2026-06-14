import { describe, expect, it } from "vitest";
import { resolveRouteIntelligenceOptions } from "@/hooks/useRouteIntelligence";

describe("resolveRouteIntelligenceOptions", () => {
  it("does not fetch TfL timetable data by default", () => {
    expect(resolveRouteIntelligenceOptions()).toEqual(
      expect.objectContaining({
        includeScheduleMatching: true,
        fetchTimetable: false,
        enrichLiveIbusDetails: true,
      }),
    );
  });

  it("keeps collapsed/light route intelligence off timetable and iBus enrichment", () => {
    expect(
      resolveRouteIntelligenceOptions({
        includeScheduleMatching: false,
        showScheduleGhosts: false,
      }),
    ).toEqual(
      expect.objectContaining({
        includeScheduleMatching: false,
        fetchTimetable: false,
        enrichLiveIbusDetails: false,
      }),
    );
  });

  it("only enables timetable fetching when explicitly requested", () => {
    expect(
      resolveRouteIntelligenceOptions({
        includeScheduleMatching: true,
        fetchTimetable: true,
      }).fetchTimetable,
    ).toBe(true);
  });

  it("loads compact route schedule for timing even when schedule ghosts are disabled", () => {
    const options = resolveRouteIntelligenceOptions({
      includeScheduleMatching: true,
      showScheduleGhosts: false,
      fetchTimetable: false,
    });

    expect(options.fetchTimetable).toBe(false);
    expect(options.includeScheduleMatching).toBe(true);
    expect(options.showScheduleGhosts).toBe(false);
  });
});
