import { describe, expect, it } from "vitest";
import {
  buildPrimaryVehicleLookupKey,
  buildVehicleLookupKeys,
  extractVehicleFleetReference,
  isFleetReference,
} from "@/lib/vehicles/lookupKey";
import {
  extractVehicleRegistration,
  isUkRegistrationPlate,
  normalizeRegistration,
} from "@/lib/vehicles/registration";

describe("normalizeRegistration", () => {
  it("uppercases and removes spaces", () => {
    expect(normalizeRegistration(" bt66 msu ")).toBe("BT66MSU");
  });
});

describe("isUkRegistrationPlate", () => {
  it("accepts current-style registrations", () => {
    expect(isUkRegistrationPlate("BV66VKT")).toBe(true);
    expect(isUkRegistrationPlate("BT66MSU")).toBe(true);
  });

  it("rejects operator fleet-style references", () => {
    expect(isUkRegistrationPlate("LTZ1049")).toBe(false);
    expect(isUkRegistrationPlate("MHV27")).toBe(false);
  });
});

describe("isFleetReference", () => {
  it("accepts common London fleet references", () => {
    expect(isFleetReference("LTZ1049")).toBe(true);
    expect(isFleetReference("MHV27")).toBe(true);
    expect(isFleetReference("WHV142")).toBe(true);
  });

  it("rejects ambiguous short numeric-like values", () => {
    expect(isFleetReference("142")).toBe(false);
    expect(isFleetReference("37")).toBe(false);
  });
});

describe("extractVehicleRegistration", () => {
  it("returns normalized registration for plate-like vehicle ids", () => {
    expect(extractVehicleRegistration("bv66vkt")).toBe("BV66VKT");
  });

  it("returns undefined for non-registration vehicle ids", () => {
    expect(extractVehicleRegistration("LTZ1049")).toBeUndefined();
    expect(extractVehicleRegistration(undefined)).toBeUndefined();
  });
});

describe("extractVehicleFleetReference", () => {
  it("returns fleet references for operator-style vehicle ids", () => {
    expect(extractVehicleFleetReference("LTZ1049")).toBe("LTZ1049");
    expect(extractVehicleFleetReference("MHV27")).toBe("MHV27");
  });
});

describe("buildVehicleLookupKeys", () => {
  it("tries registration before fleet reference when both are available", () => {
    expect(
      buildVehicleLookupKeys("BV66VKT", "BV66VKT").map((item) => item.mode),
    ).toEqual(["registration"]);
  });

  it("falls back to fleet reference when only operator-style id exists", () => {
    expect(buildPrimaryVehicleLookupKey("LTZ1049")).toEqual({
      queryKey: "LTZ1049",
      mode: "fleet_reference",
    });
  });
});
