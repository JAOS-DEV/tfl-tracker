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
  normalizeUkRegistrationCandidate,
} from "@/lib/vehicles/registration";

describe("normalizeRegistration", () => {
  it("uppercases and removes spaces", () => {
    expect(normalizeRegistration(" bt66 msu ")).toBe("BT66MSU");
  });
});

describe("normalizeUkRegistrationCandidate", () => {
  it.each([
    "LV25XUA",
    "LX75ZFJ",
    "LX75ZGV",
    "YY66OZO",
    "LJ61GVZ",
    "BV66VJZ",
    "BV66ZSD",
    "BV66VKT",
    "BT66MSU",
  ])("accepts modern UK registration %s", (registration) => {
    expect(normalizeUkRegistrationCandidate(registration)).toBe(registration);
  });

  it.each(["DEL92", "WHV162", "3047", "123565"])(
    "rejects fleet or non-registration value %s",
    (value) => {
      expect(normalizeUkRegistrationCandidate(value)).toBeUndefined();
    },
  );
});

describe("isUkRegistrationPlate", () => {
  it("accepts current-style registrations with Z, V, U, and O", () => {
    expect(isUkRegistrationPlate("LX75ZGV")).toBe(true);
    expect(isUkRegistrationPlate("LV25XUA")).toBe(true);
    expect(isUkRegistrationPlate("YY66OZO")).toBe(true);
    expect(isUkRegistrationPlate("BV66VJZ")).toBe(true);
  });

  it("rejects operator fleet-style references", () => {
    expect(isUkRegistrationPlate("LTZ1049")).toBe(false);
    expect(isUkRegistrationPlate("MHV27")).toBe(false);
    expect(isUkRegistrationPlate("DEL92")).toBe(false);
    expect(isUkRegistrationPlate("WHV162")).toBe(false);
  });
});

describe("isFleetReference", () => {
  it("accepts common London fleet references", () => {
    expect(isFleetReference("LTZ1049")).toBe(true);
    expect(isFleetReference("MHV27")).toBe(true);
    expect(isFleetReference("WHV142")).toBe(true);
    expect(isFleetReference("DEL92")).toBe(true);
    expect(isFleetReference("WHV162")).toBe(true);
  });

  it("rejects ambiguous short numeric-like values", () => {
    expect(isFleetReference("142")).toBe(false);
    expect(isFleetReference("37")).toBe(false);
    expect(isFleetReference("3047")).toBe(false);
    expect(isFleetReference("123565")).toBe(false);
  });

  it("does not treat registration plates as fleet references", () => {
    expect(isFleetReference("LX75ZGV")).toBe(false);
    expect(isFleetReference("YY66OZO")).toBe(false);
  });
});

describe("extractVehicleRegistration", () => {
  it("returns normalized registration for plate-like vehicle ids", () => {
    expect(extractVehicleRegistration("lx75zgv")).toBe("LX75ZGV");
    expect(extractVehicleRegistration("yy66ozo")).toBe("YY66OZO");
    expect(extractVehicleRegistration("bv66vkt")).toBe("BV66VKT");
  });

  it("returns undefined for non-registration vehicle ids", () => {
    expect(extractVehicleRegistration("LTZ1049")).toBeUndefined();
    expect(extractVehicleRegistration("DEL92")).toBeUndefined();
    expect(extractVehicleRegistration(undefined)).toBeUndefined();
  });
});

describe("extractVehicleFleetReference", () => {
  it("returns fleet references for operator-style vehicle ids", () => {
    expect(extractVehicleFleetReference("LTZ1049")).toBe("LTZ1049");
    expect(extractVehicleFleetReference("MHV27")).toBe("MHV27");
    expect(extractVehicleFleetReference("DEL92")).toBe("DEL92");
  });
});

describe("vehicle identity parsing", () => {
  it.each([
    ["LX75ZGV", "LX75ZGV", undefined],
    ["LV25XUA", "LV25XUA", undefined],
    ["DEL92", undefined, "DEL92"],
    ["WHV162", undefined, "WHV162"],
  ])(
    "parses %s as registration=%s and fleet=%s",
    (vehicleId, registration, fleet) => {
      expect(extractVehicleRegistration(vehicleId)).toBe(registration);
      expect(extractVehicleFleetReference(vehicleId)).toBe(fleet);
      expect(Boolean(registration) && Boolean(fleet)).toBe(false);
    },
  );

  it("rejects numeric-only bonnet ids as registrations without treating them as fleet references", () => {
    expect(extractVehicleRegistration("3047")).toBeUndefined();
    expect(extractVehicleFleetReference("3047")).toBeUndefined();
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
