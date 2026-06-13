import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBaseVersionXml } from "@/lib/ibus/baseVersion";
import {
  createRunningLookupKey,
  runningShardForTripId,
} from "@/lib/ibus/keys";
import {
  buildRunningLookupRecords,
  parseBlockXml,
  parseGarageXml,
  parseJourneyXml,
  parseVehicleXml,
} from "@/lib/ibus/parsers";

const fixture = (name: string): string =>
  readFileSync(path.join(__dirname, "fixtures", name), "utf8");

describe("parseBaseVersionXml", () => {
  it("parses the current base version", () => {
    expect(parseBaseVersionXml(fixture("base-version.xml"))).toBe("20260606");
  });
});

describe("parseVehicleXml", () => {
  it("maps registration to bonnet number", () => {
    const records = parseVehicleXml(fixture("vehicle.xml"), "20260606");
    expect(records.BT66MSU).toEqual({
      fleetNo: "WHV142",
      bonnetNo: "WHV142",
      operatorAgency: "LG",
      baseVersion: "20260606",
      source: "tfl-ibus-static",
    });
  });
});

describe("parseGarageXml", () => {
  it("maps garage number to garage metadata", () => {
    const records = parseGarageXml(fixture("garage.xml"));
    expect(records["350"]).toEqual({
      garageNo: "350",
      garageCode: "AF",
      garageName: "Test Garage",
      operatorCode: "LG",
      source: "tfl-ibus-static",
    });
  });
});

describe("deriveGarageNoFromBlock via parsers", () => {
  it("uses Garage_No from Block XML when provided", () => {
    const blocks = parseBlockXml(fixture("block-with-garage.xml"));
    expect(blocks[0]?.garageNo).toBe("456");
    expect(blocks[0]?.blockNo).toBe("123568");
    expect(blocks[0]?.runningNo).toBe("568");
  });
});

describe("running lookup chain", () => {
  it("builds running records from journey and block XML", () => {
    const journeys = parseJourneyXml(fixture("journey.xml"));
    const blocks = parseBlockXml(fixture("block.xml"));
    const records = buildRunningLookupRecords("20260606", journeys, blocks);

    expect(records["20260606:527326"]).toEqual({
      runningNo: "94",
      blockNo: "35094",
      blockIdx: "23224",
      garageNo: "350",
      operatorCode: "LG",
      source: "tfl-ibus-static",
    });
  });
});

describe("running shard helpers", () => {
  it("creates composite keys and numeric shards", () => {
    expect(createRunningLookupKey("20260606", "527326")).toBe(
      "20260606:527326",
    );
    expect(runningShardForTripId("601608")).toBe("008");
  });
});
