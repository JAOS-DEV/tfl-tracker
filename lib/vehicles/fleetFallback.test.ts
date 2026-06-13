import { describe, expect, it, vi } from "vitest";
import { clearFleetFallbackCache, lookupFleetFallback } from "@/lib/vehicles/fleetFallback";

describe("lookupFleetFallback", () => {
  it("returns bustimes fleet data when a registration match exists", async () => {
    clearFleetFallbackCache();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 1,
          results: [
            {
              reg: "BT66MSU",
              fleet_code: "WHV142",
              fleet_number: null,
              operator: { name: "Transport UK" },
            },
          ],
        }),
      }),
    );

    const result = await lookupFleetFallback("BT66MSU");
    expect(result.status).toBe("found");
    expect(result.fleetNo).toBe("WHV142");
    expect(result.source).toBe("bustimes");
  });
});
