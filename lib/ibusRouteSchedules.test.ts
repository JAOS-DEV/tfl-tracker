import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearRouteScheduleCache,
  isRouteScheduleAvailable,
  loadRouteSchedule,
} from "@/lib/ibusRouteSchedules";
import {
  getLocalIbusFixtureVersion,
  localRouteSchedulePath,
  readLocalIbusManifest,
} from "@/lib/ibus/testLocalFixtures";
import type { IbusCurrentManifest } from "@/lib/ibus/types";

const manifest: IbusCurrentManifest = {
  baseVersion: "20260606",
  generatedAt: "2026-06-13T00:00:00.000Z",
  runningShardPathTemplate: "/data/ibus/20260606/running-shards/{shard}.json",
  routeSchedulePathTemplate:
    "/data/ibus/20260606/route-schedules/{routeId}.json",
  routeScheduleRoutes: ["337"],
  garageLookupPath: "/data/ibus/20260606/garage-lookup.json",
  vehicleLookupPath: "/data/ibus/20260606/vehicle-lookup.json",
  importReportPath: "/data/ibus/20260606/import-report.json",
  counts: {
    runningNumbers: 1,
    garages: 1,
    vehicles: 1,
    operators: 1,
    warnings: 0,
  },
};

describe("ibusRouteSchedules", () => {
  afterEach(() => {
    clearRouteScheduleCache();
    vi.restoreAllMocks();
  });

  it("treats routes missing from manifest as unavailable without fetching", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => manifest,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { schedule } = await loadRouteSchedule("156");

    expect(schedule).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/data/ibus/current.json");
  });

  it("returns null for 404 schedule files without throwing", async () => {
    const manifestWithMissingRoute: IbusCurrentManifest = {
      ...manifest,
      routeScheduleRoutes: ["337", "999"],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => manifestWithMissingRoute,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
    vi.stubGlobal("fetch", fetchMock);

    const { schedule } = await loadRouteSchedule("999");

    expect(schedule).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("identifies manifest routes with generated schedule data", () => {
    expect(isRouteScheduleAvailable(manifest, "337")).toBe(true);
    expect(isRouteScheduleAvailable(manifest, "156")).toBe(false);
  });

  it("lists route 156 in the generated manifest and schedule file", () => {
    const fixtureVersion = getLocalIbusFixtureVersion();
    const current = readLocalIbusManifest();
    const schedulePath = localRouteSchedulePath("156", fixtureVersion);
    const scheduleRaw = JSON.parse(fs.readFileSync(schedulePath, "utf8")) as {
      schemaVersion?: number;
    };

    const routes =
      current.routeScheduleRoutesByBaseVersion?.[fixtureVersion] ??
      current.routeScheduleRoutes ??
      [];
    expect(routes).toContain("156");
    expect(fs.existsSync(schedulePath)).toBe(true);
    expect(scheduleRaw.schemaVersion).toBe(2);
  });

  it("decodes compact v2 route schedules for runtime ghost detection", async () => {
    const compactManifest: IbusCurrentManifest = {
      ...manifest,
      routeScheduleRoutes: ["337"],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => compactManifest,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schemaVersion: 2,
          baseVersion: "20260606",
          routeId: "337",
          generatedAt: "2026-06-13T00:00:00.000Z",
          stops: {
            "490000001A": { n: "Stop A", c: "A1" },
            "490000002B": { n: "Stop B", c: "B1" },
          },
          patterns: { "10": ["490000001A", "490000002B"] },
          dirs: { "10": "1" },
          journeys: [
            {
              t: "9001",
              r: "94",
              b: "35094",
              d: "1",
              p: "10",
              s: 36000,
              e: 36300,
              w: [0, 300],
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { schedule } = await loadRouteSchedule("337");

    expect(schedule?.journeys[0]?.tripId).toBe("9001");
    expect(schedule?.journeys[0]?.stops).toHaveLength(2);
  });

  it("reuses the same promise for duplicate concurrent schedule loads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...manifest,
          routeScheduleRoutes: ["337"],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schemaVersion: 2,
          baseVersion: "20260606",
          routeId: "337",
          generatedAt: "2026-06-13T00:00:00.000Z",
          stops: { "490000001A": { n: "Stop A", c: "A1" } },
          patterns: { "10": ["490000001A"] },
          journeys: [
            {
              t: "9001",
              d: "1",
              p: "10",
              s: 36000,
              e: 36000,
              w: [0],
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      loadRouteSchedule("337"),
      loadRouteSchedule("337"),
    ]);

    expect(first.schedule?.journeys[0]?.tripId).toBe("9001");
    expect(second.schedule?.journeys[0]?.tripId).toBe("9001");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/data/ibus/20260606/route-schedules/337.json",
    );
  });

  it("loads manifest from remote base URL when env var is set", async () => {
    process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL = "https://cdn.example.com/data/ibus";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => manifest,
    });
    vi.stubGlobal("fetch", fetchMock);

    await loadRouteSchedule("156");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://cdn.example.com/data/ibus/current.json",
    );
    delete process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL;
  });

  it("loads selected route schedule from remote base URL", async () => {
    process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL = "https://cdn.example.com/data/ibus";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => manifest,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schemaVersion: 2,
          baseVersion: "20260606",
          routeId: "337",
          generatedAt: "2026-06-13T00:00:00.000Z",
          stops: { "490000001A": { n: "Stop A", c: "A1" } },
          patterns: { "10": ["490000001A"] },
          journeys: [{ t: "9001", d: "1", p: "10", s: 36000, e: 36000, w: [0] }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await loadRouteSchedule("337");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://cdn.example.com/data/ibus/20260606/route-schedules/337.json",
    );
    delete process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL;
  });

  it("selects live baseVersion when route exists locally", async () => {
    const multiManifest = {
      ...manifest,
      activeBaseVersionFromXml: "20250619",
      availableBaseVersions: ["20250619", "20260606"],
      routeScheduleRoutesByBaseVersion: {
        "20250619": ["337"],
        "20260606": ["337"],
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => multiManifest,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schemaVersion: 2,
          baseVersion: "20250619",
          routeId: "337",
          generatedAt: "2026-06-13T00:00:00.000Z",
          stops: { "490000001A": { n: "Stop A", c: "A1" } },
          patterns: { "10": ["490000001A"] },
          journeys: [{ t: "9001", d: "1", p: "10", s: 36000, e: 36000, w: [0] }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { schedule, selection } = await loadRouteSchedule("337", {
      liveBaseVersion: "20250619",
    });

    expect(selection.selectedBaseVersion).toBe("20250619");
    expect(selection.selectedBecause).toBe("live-version-local-match");
    expect(schedule?.baseVersion).toBe("20250619");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/data/ibus/20250619/route-schedules/337.json",
    );
  });

  it("does not fetch original TfL iBus ZIP URLs at runtime", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => manifest,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schemaVersion: 2,
          baseVersion: "20260606",
          routeId: "337",
          generatedAt: "2026-06-13T00:00:00.000Z",
          stops: {},
          patterns: {},
          journeys: [],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await loadRouteSchedule("337");

    for (const call of fetchMock.mock.calls) {
      const url = String(call[0]);
      expect(url).not.toContain("ibus.data.tfl.gov.uk");
      expect(url).not.toContain("/api/tfl/timetable");
    }
  });
});
