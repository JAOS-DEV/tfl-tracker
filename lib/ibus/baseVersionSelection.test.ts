import { describe, expect, it } from "vitest";
import {
  resolveStaticBaseVersionForLookup,
  selectBaseVersionForRoute,
} from "@/lib/ibus/baseVersionSelection";
import type { IbusMultiVersionManifest } from "@/lib/ibus/types";

const manifest: IbusMultiVersionManifest = {
  baseVersion: "20260606",
  generatedAt: "2026-06-14T00:00:00.000Z",
  activeBaseVersionFromXml: "20250619",
  availableBaseVersions: ["20250619", "20260606"],
  routeScheduleRoutesByBaseVersion: {
    "20250619": ["337", "14", "N22"],
    "20260606": ["337", "14", "N22", "156"],
  },
  runningShardPathTemplate: "/data/ibus/20260606/running-shards/{shard}.json",
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

describe("selectBaseVersionForRoute", () => {
  it("selects live baseVersion when route exists locally", () => {
    const result = selectBaseVersionForRoute({
      routeId: "337",
      liveBaseVersion: "20250619",
      manifest,
    });

    expect(result.selectedBaseVersion).toBe("20250619");
    expect(result.selectedBecause).toBe("live-version-local-match");
  });

  it("falls back to active XML version when live version missing locally", () => {
    const result = selectBaseVersionForRoute({
      routeId: "156",
      liveBaseVersion: "20250619",
      manifest,
    });

    expect(result.selectedBaseVersion).toBe("20260606");
    expect(result.selectedBecause).toBe("latest-local-fallback");
  });

  it("falls back to active XML version when live baseVersion absent", () => {
    const result = selectBaseVersionForRoute({
      routeId: "14",
      manifest,
    });

    expect(result.selectedBaseVersion).toBe("20250619");
    expect(result.selectedBecause).toBe("active-version-local-match");
  });

  it("returns no-local-version when route is unavailable", () => {
    const result = selectBaseVersionForRoute({
      routeId: "999",
      liveBaseVersion: "20250619",
      manifest,
    });

    expect(result.selectedBaseVersion).toBeNull();
    expect(result.selectedBecause).toBe("no-local-version");
  });
});

describe("resolveStaticBaseVersionForLookup", () => {
  it("prefers selected schedule version over stale manifest baseVersion", () => {
    const staleManifest: IbusMultiVersionManifest = {
      ...manifest,
      baseVersion: "20260606",
      availableBaseVersions: ["20250619"],
      activeBaseVersionFromXml: "20250619",
    };

    expect(
      resolveStaticBaseVersionForLookup(staleManifest, {
        selectedBaseVersion: "20250619",
      }),
    ).toBe("20250619");
  });

  it("falls back to active XML version when manifest baseVersion is stale", () => {
    const staleManifest: IbusMultiVersionManifest = {
      ...manifest,
      baseVersion: "20260606",
      availableBaseVersions: ["20250619"],
      activeBaseVersionFromXml: "20250619",
    };

    expect(resolveStaticBaseVersionForLookup(staleManifest)).toBe("20250619");
  });

  it("uses live baseVersion when it exists locally", () => {
    expect(
      resolveStaticBaseVersionForLookup(manifest, {
        liveBaseVersion: "20250619",
      }),
    ).toBe("20250619");
  });
});

describe("parseBaseVersionsEnv", () => {
  it("parses all mode", async () => {
    const { parseBaseVersionsEnv } = await import("@/lib/ibus/importConfig");
    expect(parseBaseVersionsEnv("all")).toEqual({
      mode: "all",
      baseVersions: [],
    });
  });
});
