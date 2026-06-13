import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearIbusLookupCache,
  getIbusDetailsForPrediction,
} from "@/lib/ibusLookup";

describe("getIbusDetailsForPrediction", () => {
  beforeEach(() => {
    clearIbusLookupCache();
    vi.restoreAllMocks();
  });

  it("returns fleet number from TfL vehicle lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/data/ibus/current.json")) {
          return {
            ok: true,
            json: async () => ({
              baseVersion: "20260606",
              vehicleLookupPath: "/data/ibus/20260606/vehicle-lookup.json",
              garageLookupPath: "/data/ibus/20260606/garage-lookup.json",
              runningShardPathTemplate:
                "/data/ibus/20260606/running-shards/{shard}.json",
            }),
          };
        }

        if (url.endsWith("/data/ibus/20260606/vehicle-lookup.json")) {
          return {
            ok: true,
            json: async () => ({
              BT66MSU: {
                fleetNo: "WHV142",
                bonnetNo: "WHV142",
                operatorAgency: "LG",
                baseVersion: "20260606",
                source: "tfl-ibus-static",
              },
            }),
          };
        }

        return { ok: false };
      }),
    );

    const result = await getIbusDetailsForPrediction({
      vehicleId: "BT66MSU",
    });

    expect(result?.fleetNo).toBe("WHV142");
    expect(result?.fleetSource).toBe("tfl-ibus-static");
    expect(result?.status).toBe("partial");
    expect(result?.message).toContain("trip/base-version");
  });

  it("returns running number only with baseVersion and tripId", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/data/ibus/current.json")) {
          return {
            ok: true,
            json: async () => ({
              baseVersion: "20260606",
              vehicleLookupPath: "/data/ibus/20260606/vehicle-lookup.json",
              garageLookupPath: "/data/ibus/20260606/garage-lookup.json",
              runningShardPathTemplate:
                "/data/ibus/20260606/running-shards/{shard}.json",
            }),
          };
        }

        if (url.endsWith("/data/ibus/20260606/running-shards/222.json")) {
          return {
            ok: true,
            json: async () => ({
              "20260606:527326": {
                runningNo: "94",
                blockNo: "35094",
                blockIdx: "23224",
                garageNo: "350",
                operatorCode: "LG",
                source: "tfl-ibus-static",
              },
            }),
          };
        }

        if (url.endsWith("/data/ibus/20260606/garage-lookup.json")) {
          return {
            ok: true,
            json: async () => ({
              "350": {
                garageNo: "350",
                garageCode: "AF",
                garageName: "Test Garage",
                operatorCode: "LG",
                source: "tfl-ibus-static",
              },
            }),
          };
        }

        return { ok: true, json: async () => ({}) };
      }),
    );

    const result = await getIbusDetailsForPrediction({
      vehicleId: "BT66MSU",
      tripId: "527326",
      baseVersion: "20260606",
    });

    expect(result?.runningNo).toBe("94");
    expect(result?.runningNumberSource).toBe("tfl-ibus-static");
    expect(result?.garageCode).toBe("AF");
  });

  it("does not match running number without baseVersion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          baseVersion: "20260606",
          vehicleLookupPath: "/data/ibus/20260606/vehicle-lookup.json",
          garageLookupPath: "/data/ibus/20260606/garage-lookup.json",
          runningShardPathTemplate:
            "/data/ibus/20260606/running-shards/{shard}.json",
        }),
      })),
    );

    const result = await getIbusDetailsForPrediction({
      vehicleId: "BT66MSU",
      tripId: "527326",
    });

    expect(result?.runningNo).toBeUndefined();
    expect(result?.status).toBe("missing-live-trip");
  });

  it("reports base version mismatch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          baseVersion: "20260606",
          vehicleLookupPath: "/data/ibus/20260606/vehicle-lookup.json",
          garageLookupPath: "/data/ibus/20260606/garage-lookup.json",
          runningShardPathTemplate:
            "/data/ibus/20260606/running-shards/{shard}.json",
        }),
      })),
    );

    const result = await getIbusDetailsForPrediction({
      vehicleId: "BT66MSU",
      tripId: "527326",
      baseVersion: "20260620",
    });

    expect(result?.status).toBe("base-version-mismatch");
    expect(result?.message).toContain("20260620");
    expect(result?.message).toContain("20260606");
  });
});
