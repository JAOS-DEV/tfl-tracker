import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportIbusData } from "@/lib/ibus/exportIbusData";
import {
  getLocalIbusFixtureVersion,
  readLocalIbusManifest,
} from "@/lib/ibus/testLocalFixtures";
import type { IbusManifest } from "@/lib/ibus/types";

const exportRoot = path.join(process.cwd(), "dist", "ibus-data-test");
const sourceRoot = path.join(process.cwd(), "public", "data", "ibus");

describe("exportIbusData", () => {
  afterEach(async () => {
    await fs.rm(exportRoot, { recursive: true, force: true });
  });

  it(
    "creates uploadable folder structure from public/data/ibus",
    async () => {
      await fs.access(path.join(sourceRoot, "current.json"));

      const sourceManifest = readLocalIbusManifest();
      const result = await exportIbusData(exportRoot);

      expect(result.outputRoot).toBe(exportRoot);
      expect(result.fileCount).toBeGreaterThan(0);

      const currentJson = path.join(exportRoot, "current.json");
      await fs.access(currentJson);

      const exportedManifest = JSON.parse(
        await fs.readFile(currentJson, "utf8"),
      ) as IbusManifest;
      const fixtureVersion = getLocalIbusFixtureVersion();

      expect(exportedManifest.availableBaseVersions ?? [exportedManifest.baseVersion]).toContain(
        fixtureVersion,
      );
      expect(exportedManifest.availableBaseVersions).toEqual(
        sourceManifest.availableBaseVersions,
      );
      expect(exportedManifest.routeScheduleRoutesByBaseVersion).toEqual(
        sourceManifest.routeScheduleRoutesByBaseVersion,
      );
      expect(exportedManifest.activeBaseVersionFromXml).toBe(
        sourceManifest.activeBaseVersionFromXml,
      );

      const routesForVersion =
        exportedManifest.routeScheduleRoutesByBaseVersion?.[fixtureVersion] ??
        exportedManifest.routeScheduleRoutes;
      expect(routesForVersion?.length).toBeGreaterThan(0);

      await fs.access(path.join(exportRoot, fixtureVersion));
    },
    30_000,
  );
});
