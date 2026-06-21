import { afterEach, describe, expect, it, vi } from "vitest";
import * as baseVersionDiscovery from "@/lib/ibus/baseVersionDiscovery";
import { verifyLocalIbusData } from "@/lib/ibus/verifyLocalIbusData";

describe("verifyLocalIbusData", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL;
    vi.restoreAllMocks();
  });

  it("passes when manifest matches a locally imported version", async () => {
    const localVersions = await baseVersionDiscovery.listLocalBaseVersions();
    const localVersion = localVersions.at(-1);
    expect(localVersion).toBeTruthy();

    vi.spyOn(baseVersionDiscovery, "fetchActiveBaseVersionFromXml").mockResolvedValue(
      localVersion!,
    );

    const result = await verifyLocalIbusData();
    expect(result.errors).toEqual([]);
    expect(result.activeVersionRouteCount).toBeGreaterThan(0);
  });

  it("errors when active version is missing locally", async () => {
    vi.spyOn(baseVersionDiscovery, "fetchActiveBaseVersionFromXml").mockResolvedValue(
      "20991231",
    );

    const result = await verifyLocalIbusData();
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("20991231"))).toBe(true);
  });

  it("warns when remote base URL env var is set", async () => {
    process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL = "https://cdn.example.com/data/ibus";
    const result = await verifyLocalIbusData();
    expect(
      result.warnings.some((warning) =>
        warning.includes("NEXT_PUBLIC_IBUS_DATA_BASE_URL"),
      ),
    ).toBe(true);
  });
});
