import { describe, expect, it } from "vitest";
import { vehicleEnrichmentQuerySchema } from "@/lib/vehicles/schemas";

describe("vehicleEnrichmentQuerySchema", () => {
  it("normalizes a single registration", () => {
    expect(
      vehicleEnrichmentQuerySchema.parse({
        reg: " bt66msu ",
      }),
    ).toEqual({
      requests: [{ vehicleRegistration: "BT66MSU" }],
    });
  });

  it("normalizes and deduplicates batch registrations", () => {
    expect(
      vehicleEnrichmentQuerySchema.parse({
        regs: "BT66MSU, bt66msu ,BV66VKT",
      }),
    ).toEqual({
      requests: [
        { vehicleRegistration: "BT66MSU" },
        { vehicleRegistration: "BV66VKT" },
      ],
    });
  });

  it("accepts vehicleId lookups for fleet references", () => {
    expect(
      vehicleEnrichmentQuerySchema.parse({
        vehicleId: "ltz1049",
      }),
    ).toEqual({
      requests: [{ vehicleId: "LTZ1049" }],
    });
  });

  it("rejects missing query parameters", () => {
    expect(() => vehicleEnrichmentQuerySchema.parse({})).toThrow();
  });
});
