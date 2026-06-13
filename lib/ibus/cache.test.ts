import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheRelativePathForUrl,
  getIbusCachePath,
  isForceDownload,
  readCachedBuffer,
  writeCachedBuffer,
} from "@/lib/ibus/cache";

const TEST_BASE_VERSION = "20990101";
const TEST_RELATIVE = "Vehicle_20990101.zip";

describe("ibus cache", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(getIbusCachePath(TEST_BASE_VERSION, ""), {
      recursive: true,
      force: true,
    });
  });

  it("maps download URLs to cache-relative paths", () => {
    expect(
      cacheRelativePathForUrl(
        "20260606",
        "https://ibus.data.tfl.gov.uk/Base_Version_20260606/Vehicle_20260606.zip",
      ),
    ).toBe("Vehicle_20260606.zip");

    expect(
      cacheRelativePathForUrl(
        "20260606",
        "https://ibus.data.tfl.gov.uk/Base_Version_20260606/LG/schedule_LG_20260606.zip",
      ),
    ).toBe("LG/schedule_LG_20260606.zip");
  });

  it("reuses cached files when present", async () => {
    const payload = Buffer.from("cached-zip");
    await writeCachedBuffer(TEST_BASE_VERSION, TEST_RELATIVE, payload);

    await expect(readCachedBuffer(TEST_BASE_VERSION, TEST_RELATIVE)).resolves.toEqual(
      payload,
    );
  });

  it("bypasses cache when IBUS_FORCE_DOWNLOAD=1", async () => {
    vi.stubEnv("IBUS_FORCE_DOWNLOAD", "1");
    await writeCachedBuffer(TEST_BASE_VERSION, TEST_RELATIVE, Buffer.from("cached"));

    await expect(readCachedBuffer(TEST_BASE_VERSION, TEST_RELATIVE)).resolves.toBeNull();
    expect(isForceDownload()).toBe(true);
  });

  it("stores cache files under .ibus-cache/<baseVersion>/", async () => {
    await writeCachedBuffer(TEST_BASE_VERSION, TEST_RELATIVE, Buffer.from("zip"));

    const cachePath = getIbusCachePath(TEST_BASE_VERSION, TEST_RELATIVE);
    expect(cachePath).toContain(path.join(".ibus-cache", TEST_BASE_VERSION));
    await expect(fs.readFile(cachePath)).resolves.toBeDefined();
  });
});
