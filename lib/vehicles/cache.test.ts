import { describe, expect, it } from "vitest";
import { VehicleEnrichmentCache } from "@/lib/vehicles/cache";

describe("VehicleEnrichmentCache", () => {
  it("caches successful results for 24 hours", () => {
    const cache = new VehicleEnrichmentCache();
    const now = Date.now();

    cache.set(
      {
        queryKey: "BT66MSU",
        queryMode: "registration",
        status: "found",
        enrichment: {
          registration: "BT66MSU",
          fleetNumber: null,
          fleetCode: "WHV142",
          operatorId: null,
          operatorName: null,
          operatorSlug: null,
          garageCode: null,
          garageName: null,
          vehicleTypeName: null,
          fuel: null,
          isDoubleDecker: false,
          isElectric: false,
          liveryName: null,
          withdrawn: false,
          specialFeatures: null,
          source: "bustimes",
          fetchedAt: "2026-06-12T00:00:00.000Z",
        },
      },
      now,
    );

    expect(cache.get("BT66MSU", now + 23 * 60 * 60 * 1000)?.status).toBe(
      "found",
    );
    expect(cache.get("BT66MSU", now + 25 * 60 * 60 * 1000)).toBeNull();
  });

  it("caches no-match results for 6 hours", () => {
    const cache = new VehicleEnrichmentCache();
    const now = Date.now();

    cache.set(
      {
        queryKey: "ZZ99ZZZ",
        queryMode: "registration",
        status: "not_found",
        enrichment: null,
      },
      now,
    );

    expect(cache.get("ZZ99ZZZ", now + 5 * 60 * 60 * 1000)?.status).toBe(
      "not_found",
    );
    expect(cache.get("ZZ99ZZZ", now + 7 * 60 * 60 * 1000)).toBeNull();
  });

  it("caches failure results briefly", () => {
    const cache = new VehicleEnrichmentCache();
    const now = Date.now();

    cache.set(
      {
        queryKey: "BT66MSU",
        queryMode: "registration",
        status: "unavailable",
        enrichment: null,
      },
      now,
    );

    expect(cache.get("BT66MSU", now + 4 * 60 * 1000)?.status).toBe(
      "unavailable",
    );
    expect(cache.get("BT66MSU", now + 6 * 60 * 1000)).toBeNull();
  });
});
