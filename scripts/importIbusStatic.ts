import fs from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";
import { runningShardForTripId } from "../lib/ibus/keys";
import { buildRouteSchedules, discoverServiceLineNos } from "../lib/ibus/routeScheduleImport";
import {
  buildRunningLookupRecords,
  parseBlockXml,
  parseGarageXml,
  parseJourneyXml,
  parseVehicleXml,
} from "../lib/ibus/parsers";
import { IBUS_OPERATOR_CODES } from "../lib/ibus/operators";
import type {
  IbusCurrentManifest,
  IbusImportReport,
  IbusRunningRecord,
} from "../lib/ibus/types";
import { parseBaseVersionXml } from "../lib/ibus/baseVersion";

const IBUS_ROOT = "https://ibus.data.tfl.gov.uk";

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  const response = await fetch(url);
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function writeJson(filePath: string, value: unknown): Promise<number> {
  const content = `${JSON.stringify(value)}\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  return Buffer.byteLength(content, "utf8");
}

async function extractXmlFiles(
  zipBuffer: Buffer,
  matcher: (fileName: string) => boolean,
): Promise<Array<{ name: string; content: string }>> {
  const archive = await unzipper.Open.buffer(zipBuffer);
  const results: Array<{ name: string; content: string }> = [];

  for (const entry of archive.files) {
    if (entry.type !== "File" || !matcher(entry.path)) {
      continue;
    }

    const content = (await entry.buffer()).toString("utf8");
    results.push({ name: entry.path, content });
  }

  return results;
}

function shardRunningRecords(
  records: Record<string, IbusRunningRecord>,
): Record<string, Record<string, IbusRunningRecord>> {
  const shards: Record<string, Record<string, IbusRunningRecord>> = {};

  for (const [key, record] of Object.entries(records)) {
    const tripId = key.split(":")[1] ?? key;
    const shard = runningShardForTripId(tripId);
    shards[shard] ??= {};
    shards[shard][key] = record;
  }

  return shards;
}

async function main(): Promise<void> {
  const warnings: string[] = [];
  const fileSizes: Record<string, number> = {};
  const scheduleZipsDownloaded: string[] = [];
  const scheduleZipsSkipped: string[] = [];
  const operatorFoldersDetected: string[] = [];

  console.log("Fetching Base_Version.xml...");
  const baseVersionXml = await fetchText(`${IBUS_ROOT}/Base_Version.xml`);
  const baseVersion = parseBaseVersionXml(baseVersionXml);
  console.log(`Detected base version: ${baseVersion}`);

  const outputRoot = path.join("public", "data", "ibus", baseVersion);
  const shardDir = path.join(outputRoot, "running-shards");

  let vehicleRecords: Record<string, unknown> = {};
  const vehicleUrl = `${IBUS_ROOT}/Base_Version_${baseVersion}/Vehicle_${baseVersion}.zip`;
  console.log(`Downloading ${vehicleUrl}`);
  const vehicleZip = await fetchBuffer(vehicleUrl);
  if (!vehicleZip) {
    warnings.push(`Vehicle zip missing: ${vehicleUrl}`);
  } else {
    const xmlFiles = await extractXmlFiles(vehicleZip, (name) =>
      /vehicle/i.test(name),
    );
    for (const file of xmlFiles) {
      vehicleRecords = {
        ...vehicleRecords,
        ...parseVehicleXml(file.content, baseVersion),
      };
    }
    if (xmlFiles.length === 0) {
      warnings.push("Vehicle zip contained no Vehicle XML files");
    }
  }

  let garageRecords: Record<string, unknown> = {};
  const garageUrl = `${IBUS_ROOT}/Base_Version_${baseVersion}/Garage_${baseVersion}.zip`;
  console.log(`Downloading ${garageUrl}`);
  const garageZip = await fetchBuffer(garageUrl);
  if (!garageZip) {
    warnings.push(`Garage zip missing: ${garageUrl}`);
  } else {
    const xmlFiles = await extractXmlFiles(garageZip, (name) =>
      /garage/i.test(name),
    );
    for (const file of xmlFiles) {
      garageRecords = {
        ...garageRecords,
        ...parseGarageXml(file.content),
      };
    }
    if (xmlFiles.length === 0) {
      warnings.push("Garage zip contained no Garage XML files");
    }
  }

  const journeyLinks = [];
  const blockRecords = [];
  let journeyCount = 0;
  let blockCount = 0;

  for (const operatorCode of IBUS_OPERATOR_CODES) {
    operatorFoldersDetected.push(operatorCode);
    const scheduleUrl = `${IBUS_ROOT}/Base_Version_${baseVersion}/${operatorCode}/schedule_${operatorCode}_${baseVersion}.zip`;
    const scheduleZip = await fetchBuffer(scheduleUrl);

    if (!scheduleZip) {
      scheduleZipsSkipped.push(operatorCode);
      warnings.push(`Schedule zip missing for operator ${operatorCode}`);
      continue;
    }

    scheduleZipsDownloaded.push(operatorCode);
    console.log(`Parsed schedule zip for ${operatorCode}`);

    const xmlFiles = await extractXmlFiles(
      scheduleZip,
      (name) =>
        /(^|\/)Journey[^/]*\.xml$/i.test(name) ||
        /(^|\/)Block[^/]*\.xml$/i.test(name),
    );

    for (const file of xmlFiles) {
      if (
        /(^|\/)Journey[^/]*\.xml$/i.test(file.name) &&
        !/drive|wait|calendar/i.test(file.name)
      ) {
        const parsed = parseJourneyXml(file.content);
        journeyCount += parsed.length;
        journeyLinks.push(...parsed);
      }

      if (
        /(^|\/)Block[^/]*\.xml$/i.test(file.name) &&
        !/calendar/i.test(file.name)
      ) {
        const parsed = parseBlockXml(file.content);
        blockCount += parsed.length;
        blockRecords.push(...parsed);
      }
    }
  }

  const runningRecords = buildRunningLookupRecords(
    baseVersion,
    journeyLinks,
    blockRecords,
  );
  const shards = shardRunningRecords(runningRecords);

  fileSizes.vehicleLookup = await writeJson(
    path.join(outputRoot, "vehicle-lookup.json"),
    vehicleRecords,
  );
  fileSizes.garageLookup = await writeJson(
    path.join(outputRoot, "garage-lookup.json"),
    garageRecords,
  );

  let shardFileCount = 0;
  for (const [shard, records] of Object.entries(shards)) {
    const shardPath = path.join(shardDir, `${shard}.json`);
    fileSizes[`running-shards/${shard}.json`] = await writeJson(
      shardPath,
      records,
    );
    shardFileCount += 1;
  }

  const generatedAt = new Date().toISOString();
  const importReport: IbusImportReport = {
    baseVersion,
    generatedAt,
    operatorFoldersDetected,
    scheduleZipsDownloaded,
    scheduleZipsSkipped,
    journeyRecordsParsed: journeyCount,
    blockRecordsParsed: blockCount,
    runningNumberRecordsGenerated: Object.keys(runningRecords).length,
    garageRecordsGenerated: Object.keys(garageRecords).length,
    vehicleRecordsGenerated: Object.keys(vehicleRecords).length,
    shardCount: shardFileCount,
    fileSizes,
    warnings,
  };

  fileSizes.importReport = await writeJson(
    path.join(outputRoot, "import-report.json"),
    importReport,
  );

  const currentManifest: IbusCurrentManifest = {
    baseVersion,
    generatedAt,
    runningShardPathTemplate: `/data/ibus/${baseVersion}/running-shards/{shard}.json`,
    routeSchedulePathTemplate: `/data/ibus/${baseVersion}/route-schedules/{routeId}.json`,
    garageLookupPath: `/data/ibus/${baseVersion}/garage-lookup.json`,
    vehicleLookupPath: `/data/ibus/${baseVersion}/vehicle-lookup.json`,
    importReportPath: `/data/ibus/${baseVersion}/import-report.json`,
    counts: {
      runningNumbers: importReport.runningNumberRecordsGenerated,
      garages: importReport.garageRecordsGenerated,
      vehicles: importReport.vehicleRecordsGenerated,
      operators: scheduleZipsDownloaded.length,
      warnings: warnings.length,
    },
  };

  await writeJson(path.join("public", "data", "ibus", "current.json"), currentManifest);

  const routeScheduleEnv = process.env.IBUS_ROUTE_SCHEDULES?.trim();
  if (routeScheduleEnv) {
    const routeIds =
      routeScheduleEnv === "all"
        ? await discoverServiceLineNos(baseVersion)
        : routeScheduleEnv
            .split(",")
            .map((routeId) => routeId.trim())
            .filter(Boolean);

    console.log(`Building route schedules for ${routeIds.length} route(s)...`);
    const scheduleResult = await buildRouteSchedules({
      baseVersion,
      outputRoot,
      routeIds,
    });
    console.log(
      `Route schedules built: ${scheduleResult.routesBuilt.length}, skipped: ${scheduleResult.routesSkipped.length}`,
    );
    if (scheduleResult.warnings.length > 0) {
      warnings.push(...scheduleResult.warnings);
    }
  }

  console.log("Import complete");
  console.log(JSON.stringify(importReport, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
