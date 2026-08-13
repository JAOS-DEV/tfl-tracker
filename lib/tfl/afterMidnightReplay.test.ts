import { describe, expect, it } from "vitest";
import {
  buildAfterMidnightReplayFromSchedule,
  buildAfterMidnightReplayUrl,
  resolveAfterMidnightReplayScenario,
} from "@/lib/tfl/afterMidnightReplay";
import { buildAfterMidnightReplay } from "@/lib/tfl/afterMidnightReplayServer";
import { normalizeRouteSchedule } from "@/lib/ibus/compactScheduleDecode";
import {
  getLocalIbusFixtureVersion,
  readLocalRouteSchedule,
} from "@/lib/ibus/testLocalFixtures";

describe("after-midnight replay", () => {
  it("resolves a supported scenario only outside production", () => {
    expect(resolveAfterMidnightReplayScenario("0230", "development")).toBe(
      "0230",
    );
    expect(resolveAfterMidnightReplayScenario("0230", "production")).toBeNull();
    expect(
      resolveAfterMidnightReplayScenario("0230", "production", true),
    ).toBe("0230");
  });

  it("rejects unknown scenarios", () => {
    expect(resolveAfterMidnightReplayScenario("0300", "development")).toBeNull();
    expect(resolveAfterMidnightReplayScenario(null, "development")).toBeNull();
  });

  it("builds raw Route 14 predictions around a fixed after-midnight London clock", () => {
    const replay = buildAfterMidnightReplay("14", "0115");

    expect(replay.simulatedNow).toBe("2026-07-01T00:15:00.000Z");
    expect(replay.rawPredictions.length).toBeGreaterThan(0);
  });

  it.each(["0015", "0045", "0115", "0130", "0230"] as const)(
    "maps every %s replay prediction to its real scheduled journey and stop",
    (scenario) => {
      const version = getLocalIbusFixtureVersion();
      const schedule = normalizeRouteSchedule(
        readLocalRouteSchedule("14", version),
      );
      expect(schedule).not.toBeNull();

      const replay = buildAfterMidnightReplayFromSchedule(
        "14",
        scenario,
        schedule,
      );
      expect(replay.rawPredictions.length).toBeGreaterThan(0);

      for (const prediction of replay.rawPredictions) {
        expect(prediction.baseVersion).toBe(schedule!.baseVersion);

        const journey = schedule!.journeys.find(
          (candidate) => candidate.tripId === prediction.tripId,
        );
        const stop = journey?.stops.find(
          (candidate) => candidate.naptanId === prediction.naptanId,
        );

        expect(journey, `missing journey ${prediction.tripId}`).toBeDefined();
        expect(stop, `missing stop ${prediction.naptanId}`).toBeDefined();

        const serviceDayStartUtc = Date.parse("2026-06-29T23:00:00.000Z");
        const scheduledArrival =
          serviceDayStartUtc + stop!.scheduledSeconds * 1_000;
        const liveArrival = Date.parse(prediction.expectedArrival);
        expect(Math.abs(liveArrival - scheduledArrival)).toBeLessThanOrEqual(
          5 * 60 * 1_000,
        );
      }
    },
  );

  it("resolves trip IDs from the current schedule instead of hardcoded fixtures", () => {
    const schedule = normalizeRouteSchedule(
      readLocalRouteSchedule("14", getLocalIbusFixtureVersion()),
    );
    expect(schedule).not.toBeNull();

    const replay = buildAfterMidnightReplayFromSchedule("14", "0230", schedule);
    expect(replay.rawPredictions.length).toBeGreaterThan(0);

    for (const prediction of replay.rawPredictions) {
      expect(
        schedule!.journeys.some(
          (journey) => journey.tripId === prediction.tripId,
        ),
      ).toBe(true);
    }
  });

  it("simulates Route 14 buses during the overnight service at 02:30", () => {
    const replay = buildAfterMidnightReplay("14", "0230");
    expect(replay.rawPredictions.length).toBeGreaterThan(0);
  });

  it("returns no synthetic buses for routes other than Route 14", () => {
    expect(buildAfterMidnightReplay("22", "0230").rawPredictions).toEqual([]);
  });

  it("adds and removes replay without disturbing active routes", () => {
    expect(buildAfterMidnightReplayUrl("http://localhost:3000/?routes=14", "0230"))
      .toBe("http://localhost:3000/?routes=14&replay=0230");
    expect(
      buildAfterMidnightReplayUrl(
        "http://localhost:3000/?routes=14&replay=0230",
        null,
      ),
    ).toBe("http://localhost:3000/?routes=14");
  });
});
