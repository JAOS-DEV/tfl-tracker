import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearIbusLookupCache,
  getIbusDetailsForPrediction,
  resolveLiveRunningDetailsForPredictions,
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

  it("reports static trip not found when live baseVersion differs", async () => {
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

    expect(result?.status).toBe("not-found");
    expect(result?.message).toBe(
      "TripId was not found in current static iBus data; live prediction reports a different baseVersion.",
    );
  });
});

describe("resolveLiveRunningDetailsForPredictions", () => {
  beforeEach(() => {
    clearIbusLookupCache();
    vi.restoreAllMocks();
  });

  it("enriches fleet numbers from vehicle lookup alongside running numbers", async () => {
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

        return { ok: true, json: async () => ({}) };
      }),
    );

    const result = await resolveLiveRunningDetailsForPredictions([
      {
        vehicleId: "BT66MSU",
        tripId: "527326",
        baseVersion: "20260606",
      },
    ]);

    expect(result.get("BT66MSU")).toMatchObject({
      runningNo: "94",
      blockNo: "35094",
      fleetNo: "WHV142",
      operatorCode: "LG",
      registration: "BT66MSU",
      registrationSource: "live-tfl-prediction",
      registrationLookupStatus: "matched",
      runningLookupStatus: "matched",
      vehicleLookupStatus: "matched",
    });
  });

  it("resolves registration from fleet-only TfL vehicle ids via reverse lookup", async () => {
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
              LX75ZGV: {
                fleetNo: "DEL92",
                bonnetNo: "DEL92",
                operatorAgency: "Go-Ahead",
                baseVersion: "20260606",
                source: "tfl-ibus-static",
              },
            }),
          };
        }

        if (url.endsWith("/data/ibus/20260606/running-shards/222.json")) {
          return {
            ok: true,
            json: async () => ({
              "20260606:527326": {
                runningNo: "61",
                blockNo: "22061",
                blockIdx: "23224",
                garageNo: "220",
                operatorCode: "CX",
                source: "tfl-ibus-static",
              },
            }),
          };
        }

        return { ok: true, json: async () => ({}) };
      }),
    );

    const result = await resolveLiveRunningDetailsForPredictions([
      {
        vehicleId: "DEL92",
        tripId: "527326",
        baseVersion: "20260606",
      },
    ]);

    expect(result.get("DEL92")).toMatchObject({
      runningNo: "61",
      blockNo: "22061",
      operatorCode: "CX",
      fleetNo: "DEL92",
      registration: "LX75ZGV",
      registrationSource: "ibus-fleet-reverse-lookup",
      registrationLookupStatus: "matched",
      runningLookupStatus: "matched",
      vehicleLookupStatus: "matched",
    });
  });

  it("keeps live TfL registration when iBus static lookup does not match", async () => {
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
            json: async () => ({}),
          };
        }

        return { ok: true, json: async () => ({}) };
      }),
    );

    const result = await resolveLiveRunningDetailsForPredictions([
      {
        vehicleId: "LV25XUA",
        tripId: "527326",
        baseVersion: "20260606",
      },
    ]);

    expect(result.get("LV25XUA")).toMatchObject({
      registration: "LV25XUA",
      registrationSource: "live-tfl-prediction",
      registrationLookupStatus: "not-found",
      runningLookupStatus: "not-found",
      vehicleLookupStatus: "not-found",
    });
  });

  it("keeps fleet id and leaves registration unavailable when reverse lookup fails", async () => {
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
            json: async () => ({}),
          };
        }

        return { ok: true, json: async () => ({}) };
      }),
    );

    const result = await resolveLiveRunningDetailsForPredictions([
      {
        vehicleId: "DEL99",
        tripId: "527326",
        baseVersion: "20260606",
      },
    ]);

    expect(result.get("DEL99")).toMatchObject({
      fleetNo: "DEL99",
      registrationLookupStatus: "not-found",
      runningLookupStatus: "not-found",
      vehicleLookupStatus: "not-found",
    });
    expect(result.get("DEL99")?.registration).toBeUndefined();
  });

  it("reuses the same running shard promise for duplicate concurrent lookups", async () => {
    clearIbusLookupCache();
    const fetchMock = vi.fn(async (url: string) => {
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
          json: async () => ({}),
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

      return { ok: false };
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      resolveLiveRunningDetailsForPredictions([
        {
          vehicleId: "BUS1",
          tripId: "527326",
          baseVersion: "20260606",
        },
      ]),
      resolveLiveRunningDetailsForPredictions([
        {
          vehicleId: "BUS2",
          tripId: "527326",
          baseVersion: "20260606",
        },
      ]),
    ]);

    const shardCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith("/data/ibus/20260606/running-shards/222.json"),
    );
    expect(shardCalls).toHaveLength(1);
  });

  it("resolves running from static shard when live baseVersion differs", async () => {
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
          return { ok: true, json: async () => ({}) };
        }

        if (url.endsWith("/data/ibus/20260606/running-shards/017.json")) {
          return {
            ok: true,
            json: async () => ({
              "20260606:601361": {
                runningNo: "561",
                blockNo: "123561",
                operatorCode: "CX",
                source: "tfl-ibus-static",
              },
            }),
          };
        }

        return { ok: false };
      }),
    );

    const result = await resolveLiveRunningDetailsForPredictions([
      {
        vehicleId: "LV24EUK",
        tripId: "601361",
        baseVersion: "20250619",
      },
    ]);

    expect(result.get("LV24EUK")).toMatchObject({
      runningNo: "561",
      blockNo: "123561",
      operatorCode: "CX",
      runningLookupStatus: "matched",
      liveBaseVersion: "20250619",
      staticBaseVersion: "20260606",
      baseVersionMatches: false,
      runningLookupNote:
        "Live prediction reports a different baseVersion, but tripId matched current static iBus data.",
    });
  });

  it("reports static-trip-not-found-live-version-differs when tripId is absent from static shard", async () => {
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
          return { ok: true, json: async () => ({}) };
        }

        if (url.endsWith("/data/ibus/20260606/running-shards/107.json")) {
          return { ok: true, json: async () => ({}) };
        }

        return { ok: false };
      }),
    );

    const result = await resolveLiveRunningDetailsForPredictions([
      {
        vehicleId: "LV24EUK",
        tripId: "639595",
        baseVersion: "20250619",
      },
    ]);

    expect(result.get("LV24EUK")).toMatchObject({
      runningLookupStatus: "static-trip-not-found-live-version-differs",
      baseVersionMatches: false,
      runningLookupNote:
        "TripId was not found in current static iBus data; live prediction reports a different baseVersion.",
    });
    expect(result.get("LV24EUK")?.runningNo).toBeUndefined();
  });
});
