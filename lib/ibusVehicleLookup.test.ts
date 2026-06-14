import { describe, expect, it } from "vitest";
import {
  clearIbusVehicleReverseIndexCache,
  getCachedIbusVehicleReverseIndex,
  lookupRegistrationByFleetNumber,
  lookupVehicleByFleetNumber,
  lookupVehicleByRegistration,
} from "@/lib/ibusVehicleLookup";
import type { IbusVehicleRecord } from "@/lib/ibus/types";

const vehicleLookup: Record<string, IbusVehicleRecord> = {
  LX75ZGV: {
    fleetNo: "DEL92",
    bonnetNo: "DEL92",
    operatorAgency: "Go-Ahead",
    baseVersion: "20260606",
    source: "tfl-ibus-static",
  },
  BT66MSU: {
    fleetNo: "WHV142",
    bonnetNo: "WHV142",
    operatorAgency: "LG",
    baseVersion: "20260606",
    source: "tfl-ibus-static",
  },
  AMBIG1: {
    fleetNo: "DUP01",
    bonnetNo: "DUP01",
    operatorAgency: "Alpha",
    baseVersion: "20260606",
    source: "tfl-ibus-static",
  },
  AMBIG2: {
    fleetNo: "DUP01",
    bonnetNo: "DUP01",
    operatorAgency: "Beta",
    baseVersion: "20260606",
    source: "tfl-ibus-static",
  },
};

describe("ibusVehicleLookup", () => {
  it("looks up vehicle by registration", () => {
    expect(lookupVehicleByRegistration(vehicleLookup, "lx75zgv")?.fleetNo).toBe(
      "DEL92",
    );
  });

  it("resolves route 22-style fleet DEL92 to registration LX75ZGV", () => {
    const result = lookupRegistrationByFleetNumber(vehicleLookup, "DEL92");
    expect(result.status).toBe("matched");
    expect(result.registration).toBe("LX75ZGV");
  });

  it("returns ambiguous when fleet number maps to multiple registrations", () => {
    const result = lookupRegistrationByFleetNumber(vehicleLookup, "DUP01");
    expect(result.status).toBe("ambiguous");
    expect(result.registration).toBeNull();
  });

  it("scopes fleet lookup by operator agency when provided", () => {
    const result = lookupRegistrationByFleetNumber(
      vehicleLookup,
      "DUP01",
      "Alpha",
    );
    expect(result.status).toBe("matched");
    expect(result.registration).toBe("AMBIG1");
  });

  it("returns vehicle record from fleet lookup", () => {
    const result = lookupVehicleByFleetNumber(vehicleLookup, "DEL92");
    expect(result.status).toBe("matched");
    expect(result.registration).toBe("LX75ZGV");
    expect(result.operatorAgency).toBe("Go-Ahead");
  });

  it("caches reverse indexes per base version", () => {
    clearIbusVehicleReverseIndexCache();
    const first = getCachedIbusVehicleReverseIndex("20260606", vehicleLookup);
    const second = getCachedIbusVehicleReverseIndex("20260606", vehicleLookup);
    expect(first).toBe(second);
  });
});
