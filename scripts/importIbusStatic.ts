import fs from "node:fs/promises";
import path from "node:path";
import { runningShardForTripId } from "../lib/ibus/keys";
import {
  buildRouteSchedules,
  buildScheduleCorpus,
} from "../lib/ibus/routeScheduleImport";
import {
  buildRunningLookupRecords,
  parseGarageXml,
  parseVehicleXml,
} from "../lib/ibus/parsers";
import { IBUS_OPERATOR_CODES } from "../lib/ibus/operators";
import type {
  IbusCurrentManifest,
  IbusImportReport,
  IbusRunningRecord,
} from "../lib/ibus/types";
import { isCleanOldVersions, isForceDownload } from "../lib/ibus/cache";
import { parseRouteScheduleEnv } from "../lib/ibus/importConfig";
import {
  fetchIbusZipCached,
  prepareIbusImport,
} from "../lib/ibus/ibusFetch";
import { extractXmlFiles } from "../lib/ibus/zipExtract";

const SIZE_WARNING_ROUTE_SCHEDULE_TOTAL = 250 * 1024 * 1024;
const SIZE_WARNING_OUTPUT_TOTAL = 50 * 1024 * 1024;
const SIZE_WARNING_SINGLE_ROUTE = 5 * 1024 * 1024;
const SIZE_WARNING_SELECTED_ROUTE = 1024 * 1024;

async function writeJson(filePath: string, data: unknown): Promise<number> {
  const json = `${JSON.stringify(data)}\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, json, "utf8");
  return Buffer.byteLength(json, "utf8");
}

async function listRouteScheduleRoutes(outputRoot: string): Promise<string[]> {
  const scheduleDir = path.join(outputRoot, "route-schedules");
  try {
    const files = await fs.readdir(scheduleDir);
    return files
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => fileName.replace(/\.json$/, ""))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

async function computeDirectorySize(dirPath: string): Promise<number> {
  let total = 0;

  async function walk(currentPath: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(entryPath);
        total += stat.size;
      }
    }
  }

  await walk(dirPath);
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
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

async function cleanOldBaseVersions(
  currentBaseVersion: string,
  warnings: string[],
): Promise<void> {
  if (!isCleanOldVersions()) {
    return;
  }

  const ibusRoot = path.join("public", "data", "ibus");
  let entries;
  try {
    entries = await fs.readdir(ibusRoot, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === currentBaseVersion) {
      continue;
    }

    if (!/^\d{8}$/.test(entry.name)) {
      continue;
    }

    const target = path.join(ibusRoot, entry.name);
    await fs.rm(target, { recursive: true, force: true });
    warnings.push(`Removed old base version folder: ${target}`);
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const warnings: string[] = [];
  const fileSizes: Record<string, number> = {};
  const operatorFoldersDetected = [...IBUS_OPERATOR_CODES];
  const routeScheduleConfig = parseRouteScheduleEnv(
    process.env.IBUS_ROUTE_SCHEDULES,
  );

  console.log("Fetching Base_Version.xml...");
  const { baseVersion, urls, context, downloadVerification } =
    await prepareIbusImport();
  warnings.push(...downloadVerification.warnings);

  console.log(`Detected base version: ${baseVersion}`);
  console.log(`Download method: ${downloadVerification.downloadMethod}`);

  const outputRoot = path.join("public", "data", "ibus", baseVersion);
  const shardDir = path.join(outputRoot, "running-shards");

  let vehicleRecords: Record<string, unknown> = {};
  console.log(`Downloading ${urls.vehicleZip}`);
  const vehicleZip = await fetchIbusZipCached(context, urls.vehicleZip, "Vehicle zip");
  if (!vehicleZip) {
    warnings.push(`Vehicle zip missing: ${urls.vehicleZip}`);
  } else {
    const xmlFiles = await extractXmlFiles(vehicleZip, (name) => /vehicle/i.test(name));
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
  console.log(`Downloading ${urls.garageZip}`);
  const garageZip = await fetchIbusZipCached(context, urls.garageZip, "Garage zip");
  if (!garageZip) {
    warnings.push(`Garage zip missing: ${urls.garageZip}`);
  } else {
    const xmlFiles = await extractXmlFiles(garageZip, (name) => /garage/i.test(name));
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

  console.log("Building schedule corpus from operator zips...");
  const corpusDepth = routeScheduleConfig.mode === "none" ? "core" : "full";
  const corpus = await buildScheduleCorpus(urls, context, { depth: corpusDepth });
  warnings.push(...context.warnings.filter((warning) => !warnings.includes(warning)));

  const blockRecords = corpus.allBlocks.map((block) => ({
    blockIdx: block.blockIdx,
    blockNo: block.blockNo,
    runningNo: block.runningNo,
    garageNo: block.garageNo,
    operatorCode: block.operatorCode,
  }));

  const runningRecords = buildRunningLookupRecords(
    baseVersion,
    corpus.journeyLinks,
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
    fileSizes[`running-shards/${shard}.json`] = await writeJson(shardPath, records);
    shardFileCount += 1;
  }

  const generatedAt = new Date().toISOString();
  let routeSchedulesRequested: string | null = null;
  let routeSchedulesGenerated = 0;
  let routeSchedulesSkipped = 0;
  let totalRouteScheduleSizeBytes = 0;
  let totalLegacyRouteScheduleSizeBytes = 0;
  let largestRouteSchedule: { routeId: string; sizeBytes: number } | null = null;
  let topLargestRouteSchedules: Array<{ routeId: string; sizeBytes: number }> = [];
  let scheduleResult: Awaited<ReturnType<typeof buildRouteSchedules>> | null = null;

  if (routeScheduleConfig.mode === "all") {
    routeSchedulesRequested = "all";
    console.log(
      `Building route schedules for all ${corpus.serviceLineNos.length} discovered route(s)...`,
    );
    scheduleResult = await buildRouteSchedules({
      baseVersion,
      outputRoot,
      routeIds: corpus.serviceLineNos,
      corpus,
      urls,
      context,
    });
    routeSchedulesGenerated = scheduleResult.routesBuilt.length;
    routeSchedulesSkipped = scheduleResult.routesSkipped.length;
    totalRouteScheduleSizeBytes = scheduleResult.totalRouteScheduleSize;
    totalLegacyRouteScheduleSizeBytes = scheduleResult.totalLegacyRouteScheduleSize;
    largestRouteSchedule = scheduleResult.largestRouteSchedule;
    topLargestRouteSchedules = scheduleResult.topLargestRouteSchedules;
    warnings.push(...scheduleResult.warnings);
    console.log(
      `Route schedules built: ${scheduleResult.routesBuilt.length}, skipped: ${scheduleResult.routesSkipped.length}`,
    );
  } else if (routeScheduleConfig.mode === "selected") {
    routeSchedulesRequested = routeScheduleConfig.routeIds.join(",");
    console.log(
      `Building route schedules for ${routeScheduleConfig.routeIds.length} selected route(s)...`,
    );
    scheduleResult = await buildRouteSchedules({
      baseVersion,
      outputRoot,
      routeIds: routeScheduleConfig.routeIds,
      corpus,
      urls,
      context,
    });
    routeSchedulesGenerated = scheduleResult.routesBuilt.length;
    routeSchedulesSkipped = scheduleResult.routesSkipped.length;
    totalRouteScheduleSizeBytes = scheduleResult.totalRouteScheduleSize;
    totalLegacyRouteScheduleSizeBytes = scheduleResult.totalLegacyRouteScheduleSize;
    largestRouteSchedule = scheduleResult.largestRouteSchedule;
    topLargestRouteSchedules = scheduleResult.topLargestRouteSchedules;
    warnings.push(...scheduleResult.warnings);
    console.log(
      `Route schedules built: ${scheduleResult.routesBuilt.length}, skipped: ${scheduleResult.routesSkipped.length}`,
    );
  }

  const averageRouteScheduleSizeBytes =
    routeSchedulesGenerated > 0
      ? Math.round(totalRouteScheduleSizeBytes / routeSchedulesGenerated)
      : 0;
  const estimatedCompactSavingsBytes = Math.max(
    0,
    totalLegacyRouteScheduleSizeBytes - totalRouteScheduleSizeBytes,
  );

  if (totalRouteScheduleSizeBytes > SIZE_WARNING_ROUTE_SCHEDULE_TOTAL) {
    warnings.push(
      `Total route schedule size exceeds 250 MB (${formatBytes(totalRouteScheduleSizeBytes)})`,
    );
  }

  if (largestRouteSchedule && largestRouteSchedule.sizeBytes > SIZE_WARNING_SINGLE_ROUTE) {
    warnings.push(
      `Route ${largestRouteSchedule.routeId} schedule exceeds 5 MB (${formatBytes(largestRouteSchedule.sizeBytes)})`,
    );
  }

  const route156Size = scheduleResult?.routeScheduleSizes["156"];
  if (route156Size && route156Size > SIZE_WARNING_SELECTED_ROUTE) {
    warnings.push(
      `Route 156 schedule exceeds 1 MB (${formatBytes(route156Size)})`,
    );
  }

  const routeScheduleRoutes =
    scheduleResult !== null
      ? [...scheduleResult.routesBuilt].sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true }),
        )
      : await listRouteScheduleRoutes(outputRoot);

  if (scheduleResult && routeScheduleConfig.mode === "selected") {
    const scheduleDir = path.join(outputRoot, "route-schedules");
    const keepRoutes = new Set(scheduleResult.routesBuilt);
    try {
      const files = await fs.readdir(scheduleDir);
      for (const fileName of files) {
        if (!fileName.endsWith(".json")) {
          continue;
        }
        const routeId = fileName.replace(/\.json$/, "");
        if (!keepRoutes.has(routeId)) {
          await fs.unlink(path.join(scheduleDir, fileName));
        }
      }
    } catch {
      // route-schedules directory may not exist yet
    }
  }
  const totalOutputSizeBytes = await computeDirectorySize(outputRoot);

  if (totalOutputSizeBytes > SIZE_WARNING_OUTPUT_TOTAL) {
    warnings.push(
      `Total public/data/ibus/${baseVersion} size exceeds 50 MB (${formatBytes(totalOutputSizeBytes)})`,
    );
  }

  const importReport: IbusImportReport = {
    baseVersion,
    generatedAt,
    downloadMethod: downloadVerification.downloadMethod,
    cacheUsed: context.stats.cacheHits > 0,
    forceDownload: isForceDownload(),
    operatorFoldersDetected,
    scheduleZipsDownloaded: corpus.stats.operatorZipsDownloaded,
    scheduleZipsReusedFromCache: corpus.stats.operatorZipsReusedFromCache,
    scheduleZipsSkipped: corpus.stats.operatorZipsSkipped,
    journeyRecordsParsed: corpus.stats.journeyRecordsParsed,
    blockRecordsParsed: corpus.stats.blockRecordsParsed,
    waitRecordsParsed: corpus.stats.waitRecordsParsed,
    driveRecordsParsed: corpus.stats.driveRecordsParsed,
    stopRecordsParsed: corpus.stats.stopRecordsParsed,
    patternRecordsParsed: corpus.stats.patternRecordsParsed,
    runningNumberRecordsGenerated: Object.keys(runningRecords).length,
    garageRecordsGenerated: Object.keys(garageRecords).length,
    vehicleRecordsGenerated: Object.keys(vehicleRecords).length,
    shardCount: shardFileCount,
    routeSchedulesRequested,
    routeSchedulesGenerated,
    routeSchedulesSkipped,
    routeScheduleRoutes,
    routeScheduleSchemaVersion: 2,
    compactScheduleEnabled: true,
    totalRouteScheduleSizeBytes,
    totalLegacyRouteScheduleSizeBytes,
    averageRouteScheduleSizeBytes,
    largestRouteSchedule,
    topLargestRouteSchedules,
    estimatedCompactSavingsBytes,
    totalOutputSizeBytes,
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
      operators: corpus.stats.operatorZipsDownloaded.length +
        corpus.stats.operatorZipsReusedFromCache.length,
      warnings: warnings.length,
    },
    ...(routeScheduleRoutes.length > 0 ? { routeScheduleRoutes } : {}),
  };

  await writeJson(path.join("public", "data", "ibus", "current.json"), currentManifest);
  await cleanOldBaseVersions(baseVersion, warnings);

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("");
  console.log("iBus import complete");
  console.log(`Base version: ${baseVersion}`);
  console.log(`Download method: ${downloadVerification.downloadMethod}`);
  console.log(
    `Operators parsed: ${corpus.stats.operatorZipsDownloaded.length + corpus.stats.operatorZipsReusedFromCache.length}`,
  );
  console.log(`Running records: ${importReport.runningNumberRecordsGenerated}`);
  console.log(`Vehicle records: ${importReport.vehicleRecordsGenerated}`);
  console.log(`Garage records: ${importReport.garageRecordsGenerated}`);
  console.log(`Route schedules generated: ${routeSchedulesGenerated}`);
  console.log(`Total schedule size: ${formatBytes(totalRouteScheduleSizeBytes)}`);
  if (estimatedCompactSavingsBytes > 0) {
    console.log(
      `Estimated compact savings: ${formatBytes(estimatedCompactSavingsBytes)} (legacy ${formatBytes(totalLegacyRouteScheduleSizeBytes)})`,
    );
  }
  if (largestRouteSchedule) {
    console.log(
      `Largest route: ${largestRouteSchedule.routeId}.json, ${formatBytes(largestRouteSchedule.sizeBytes)}`,
    );
  }
  if (topLargestRouteSchedules.length > 0) {
    console.log(
      `Top routes: ${topLargestRouteSchedules
        .slice(0, 5)
        .map((entry) => `${entry.routeId} (${formatBytes(entry.sizeBytes)})`)
        .join(", ")}`,
    );
  }
  console.log(`Total output size: ${formatBytes(totalOutputSizeBytes)}`);
  console.log(`Cache hits: ${context.stats.cacheHits}, downloads: ${context.stats.downloads}`);
  console.log(`Elapsed: ${elapsedSeconds}s`);
  console.log(`Warnings: ${warnings.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
