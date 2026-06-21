import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportIbusData } from "@/lib/ibus/exportIbusData";
import { getLocalIbusFixtureVersion } from "@/lib/ibus/testLocalFixtures";

const exportRoot = path.join(process.cwd(), "dist", "ibus-data-test");
const sourceRoot = path.join(process.cwd(), "public", "data", "ibus");

describe("exportIbusData", () => {
  afterEach(async () => {
    await fs.rm(exportRoot, { recursive: true, force: true });
  });

  it("creates uploadable folder structure from public/data/ibus", async () => {
    await fs.access(path.join(sourceRoot, "current.json"));

    const result = await exportIbusData(exportRoot);

    expect(result.outputRoot).toBe(exportRoot);
    expect(result.fileCount).toBeGreaterThan(0);

    const currentJson = path.join(exportRoot, "current.json");
    await fs.access(currentJson);

    const manifest = JSON.parse(await fs.readFile(currentJson, "utf8")) as {
      baseVersion: string;
    };
    const fixtureVersion = getLocalIbusFixtureVersion();
    expect(manifest.availableBaseVersions ?? [manifest.baseVersion]).toContain(
      fixtureVersion,
    );
    await fs.access(path.join(exportRoot, fixtureVersion));
  });
});
