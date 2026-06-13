import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupVehicleEnrichmentForVehicle } from "@/lib/vehicles/bustimes";

describe("lookupVehicleEnrichmentForVehicle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns not_found when Bustimes has no match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 0,
          results: [],
        }),
      }),
    );

    const result = await lookupVehicleEnrichmentForVehicle(undefined, "ZZ99ZZZ");

    expect(result?.status).toBe("not_found");
    expect(result?.enrichment).toBeNull();
  });

  it("returns unavailable when Bustimes fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    const result = await lookupVehicleEnrichmentForVehicle(undefined, "BT66MSU");

    expect(result?.status).toBe("unavailable");
    expect(result?.message).toBe("Vehicle details temporarily unavailable");
  });

  it("looks up fleet references when registration is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 1,
          results: [
            {
              reg: "LTZ1049",
              fleet_number: null,
              fleet_code: "LT49",
              operator: { name: "Arriva London" },
            },
          ],
        }),
      }),
    );

    const result = await lookupVehicleEnrichmentForVehicle("LTZ1049");

    expect(result?.status).toBe("found");
    expect(result?.queryMode).toBe("fleet_reference");
    expect(result?.enrichment?.fleetCode).toBe("LT49");
  });

  it("rejects ambiguous fleet search results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 12,
          results: [
            { reg: "CX11FZT", fleet_code: "142" },
            { reg: "LX17DZC", fleet_code: "142" },
          ],
        }),
      }),
    );

    const result = await lookupVehicleEnrichmentForVehicle("142");

    expect(result).toBeNull();
  });
});
