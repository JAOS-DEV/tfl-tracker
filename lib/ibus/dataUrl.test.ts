import { afterEach, describe, expect, it } from "vitest";
import {
  buildIbusDataUrl,
  buildIbusManifestUrl,
  buildIbusRouteScheduleUrl,
  buildIbusRunningShardUrl,
  getIbusDataBaseUrl,
  getIbusDataDiagnostics,
  getIbusDataSource,
} from "@/lib/ibus/dataUrl";

describe("ibus dataUrl", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL;
  });

  it("falls back to local /data/ibus when env var is unset", () => {
    expect(getIbusDataBaseUrl()).toBe("");
    expect(getIbusDataSource()).toBe("local");
    expect(buildIbusDataUrl("current.json")).toBe("/data/ibus/current.json");
    expect(buildIbusDataUrl("/current.json")).toBe("/data/ibus/current.json");
    expect(buildIbusDataUrl("/data/ibus/current.json")).toBe(
      "/data/ibus/current.json",
    );
  });

  it("builds remote URLs without trailing slash on base URL", () => {
    process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL =
      "https://cdn.example.com/data/ibus";

    expect(buildIbusManifestUrl()).toBe(
      "https://cdn.example.com/data/ibus/current.json",
    );
    expect(buildIbusRouteScheduleUrl("20250619", "337")).toBe(
      "https://cdn.example.com/data/ibus/20250619/route-schedules/337.json",
    );
    expect(buildIbusRunningShardUrl("20250619", "017")).toBe(
      "https://cdn.example.com/data/ibus/20250619/running-shards/017.json",
    );
    expect(getIbusDataSource()).toBe("remote");
  });

  it("strips trailing slash from remote base URL", () => {
    process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL =
      "https://cdn.example.com/data/ibus/";

    expect(buildIbusDataUrl("20250619/route-schedules/337.json")).toBe(
      "https://cdn.example.com/data/ibus/20250619/route-schedules/337.json",
    );
    expect(getIbusDataBaseUrl()).toBe("https://cdn.example.com/data/ibus");
  });

  it("reports diagnostics for local and remote modes", () => {
    expect(getIbusDataDiagnostics()).toEqual({
      ibusDataSource: "local",
      ibusDataBaseUrl: "/data/ibus",
      manifestUrl: "/data/ibus/current.json",
    });

    process.env.NEXT_PUBLIC_IBUS_DATA_BASE_URL = "https://cdn.example.com/data/ibus";
    expect(getIbusDataDiagnostics()).toEqual({
      ibusDataSource: "remote",
      ibusDataBaseUrl: "https://cdn.example.com/data/ibus",
      manifestUrl: "https://cdn.example.com/data/ibus/current.json",
    });
  });
});
