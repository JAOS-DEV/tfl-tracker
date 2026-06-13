import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  clearRouteScheduleCache,
  isRouteScheduleAvailable,
  loadRouteSchedule,
} from "@/lib/ibusRouteSchedules";
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

    const schedule = await loadRouteSchedule("156");

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

    const schedule = await loadRouteSchedule("999");

    expect(schedule).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("identifies manifest routes with generated schedule data", () => {
    expect(isRouteScheduleAvailable(manifest, "337")).toBe(true);
    expect(isRouteScheduleAvailable(manifest, "156")).toBe(false);
  });

  it("lists route 156 in the generated manifest and schedule file", () => {
    const manifestPath = path.join(
      process.cwd(),
      "public",
      "data",
      "ibus",
      "current.json",
    );
    const schedulePath = path.join(
      process.cwd(),
      "public",
      "data",
      "ibus",
      "20260606",
      "route-schedules",
      "156.json",
    );
    const current = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as IbusCurrentManifest;

    expect(current.routeScheduleRoutes).toContain("156");
    expect(fs.existsSync(schedulePath)).toBe(true);
  });
});
