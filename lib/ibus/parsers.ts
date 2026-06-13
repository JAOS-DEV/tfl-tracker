import { deriveGarageNoFromBlock } from "@/lib/ibus/keys";
import type {
  IbusGarageRecord,
  IbusRunningRecord,
  IbusVehicleRecord,
} from "@/lib/ibus/types";
import { asArray, parseIbusXml, readAttribute, readText } from "@/lib/ibus/xmlUtils";
import { normalizeIbusRegistration } from "@/lib/ibus/keys";

interface ParsedJourneyLink {
  journeyIdx: string;
  blockIdx: string;
}

interface ParsedBlockRecord {
  blockIdx: string;
  blockNo: string;
  runningNo: string;
  garageNo: string | null;
  operatorCode: string | null;
}

export function parseVehicleXml(
  xml: string,
  baseVersion: string,
): Record<string, IbusVehicleRecord> {
  const parsed = parseIbusXml<{
    Vehicle_Data?: { Vehicle?: unknown };
  }>(xml);

  const records: Record<string, IbusVehicleRecord> = {};

  for (const vehicle of asArray(parsed.Vehicle_Data?.Vehicle)) {
    if (!vehicle || typeof vehicle !== "object") {
      continue;
    }

    const row = vehicle as Record<string, unknown>;
    const registration = readText(row.Registration_Number as string);
    const bonnetNo = readText(row.Bonnet_No as string);

    if (!registration || !bonnetNo) {
      continue;
    }

    const key = normalizeIbusRegistration(registration);
    records[key] = {
      fleetNo: bonnetNo,
      bonnetNo,
      operatorAgency: readText(row.Operator_Agency as string),
      baseVersion,
      source: "tfl-ibus-static",
    };
  }

  return records;
}

export function parseGarageXml(
  xml: string,
): Record<string, IbusGarageRecord> {
  const parsed = parseIbusXml<{
    Network_Data?: { Garage?: unknown };
  }>(xml);

  const records: Record<string, IbusGarageRecord> = {};

  for (const garage of asArray(parsed.Network_Data?.Garage)) {
    if (!garage || typeof garage !== "object") {
      continue;
    }

    const row = garage as Record<string, unknown>;
    const garageNo = readAttribute(row, ["Garage_No", "aGarage_No"]);
    if (!garageNo) {
      continue;
    }

    records[garageNo] = {
      garageNo,
      garageCode: readText(row.Garage_Code as string),
      garageName: readText(row.Garage_Name as string),
      operatorCode: readAttribute(row, ["Operator_Code", "aOperator_Code"]),
      source: "tfl-ibus-static",
    };
  }

  return records;
}

export function parseJourneyXml(xml: string): ParsedJourneyLink[] {
  const parsed = parseIbusXml<{
    Schedule_Data?: { Journey?: unknown };
  }>(xml);

  const links: ParsedJourneyLink[] = [];

  for (const journey of asArray(parsed.Schedule_Data?.Journey)) {
    if (!journey || typeof journey !== "object") {
      continue;
    }

    const row = journey as Record<string, unknown>;
    const journeyIdx = readAttribute(row, ["Journey_Idx", "aJourney_Idx"]);
    const blockIdx = readAttribute(row, ["Block_Idx", "aBlock_Idx"]);

    if (!journeyIdx || !blockIdx) {
      continue;
    }

    links.push({ journeyIdx, blockIdx });
  }

  return links;
}

export function parseBlockXml(xml: string): ParsedBlockRecord[] {
  const parsed = parseIbusXml<{
    Schedule_Data?: { Block?: unknown };
  }>(xml);

  const blocks: ParsedBlockRecord[] = [];

  for (const block of asArray(parsed.Schedule_Data?.Block)) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const row = block as Record<string, unknown>;
    const blockIdx = readAttribute(row, ["Block_Idx", "aBlock_Idx"]);
    const blockNo = readText(row.Block_No as string);
    const runningNo = readText(row.Running_No as string);
    const garageNoFromXml =
      readAttribute(row, ["Garage_No", "aGarage_No"]) ??
      readText(row.Garage_No as string);

    if (!blockIdx || !blockNo || !runningNo) {
      continue;
    }

    blocks.push({
      blockIdx,
      blockNo,
      runningNo,
      garageNo: deriveGarageNoFromBlock(blockNo, runningNo, garageNoFromXml),
      operatorCode: readAttribute(row, ["Operator_Code", "aOperator_Code"]),
    });
  }

  return blocks;
}

export function buildRunningLookupRecords(
  baseVersion: string,
  journeyLinks: ParsedJourneyLink[],
  blocks: ParsedBlockRecord[],
): Record<string, IbusRunningRecord> {
  const blockByIdx = new Map(
    blocks.map((block) => [block.blockIdx, block] as const),
  );
  const records: Record<string, IbusRunningRecord> = {};

  for (const journey of journeyLinks) {
    const block = blockByIdx.get(journey.blockIdx);
    if (!block) {
      continue;
    }

    const key = `${baseVersion}:${journey.journeyIdx}`;
    records[key] = {
      runningNo: block.runningNo,
      blockNo: block.blockNo,
      blockIdx: block.blockIdx,
      garageNo: block.garageNo,
      operatorCode: block.operatorCode,
      source: "tfl-ibus-static",
    };
  }

  return records;
}
