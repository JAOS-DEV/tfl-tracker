import { describe, expect, it } from "vitest";
import {
  getPreferredFleetLabel,
  normalizeBustimesVehicle,
} from "@/lib/vehicles/bustimes";

describe("normalizeBustimesVehicle", () => {
  it("maps Bustimes fields into app-friendly enrichment", () => {
    const enrichment = normalizeBustimesVehicle(
      {
        reg: "BT66MSU",
        fleet_number: null,
        fleet_code: "WHV142",
        vehicle_type: {
          name: "ADL Enviro400 MMC",
          fuel: "diesel",
          double_decker: true,
          electric: false,
        },
        operator: {
          id: "ABLO",
          slug: "abellio-london",
          name: "Transport UK / Abellio London",
        },
        garage: {
          code: "WL",
          name: "Walworth",
        },
        livery: {
          name: "London red",
        },
        withdrawn: false,
        special_features: null,
      },
      "2026-06-12T00:00:00.000Z",
    );

    expect(enrichment).toEqual({
      registration: "BT66MSU",
      fleetNumber: null,
      fleetCode: "WHV142",
      operatorId: "ABLO",
      operatorName: "Transport UK / Abellio London",
      operatorSlug: "abellio-london",
      garageCode: "WL",
      garageName: "Walworth",
      vehicleTypeName: "ADL Enviro400 MMC",
      fuel: "diesel",
      isDoubleDecker: true,
      isElectric: false,
      liveryName: "London red",
      withdrawn: false,
      specialFeatures: null,
      source: "bustimes",
      fetchedAt: "2026-06-12T00:00:00.000Z",
    });
  });
});

describe("getPreferredFleetLabel", () => {
  it("returns the preferred fleet label", () => {
    expect(
      getPreferredFleetLabel({
        registration: "BT66MSU",
        fleetNumber: "142",
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
      }),
    ).toBe("WHV142");
  });
});
