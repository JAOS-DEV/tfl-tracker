import type { IbusCurrentManifest, IbusImportReport } from "@/lib/ibus/types";
import type { RouteScheduleImportConfig } from "@/lib/ibus/importConfig";
import {
  createIbusFetchContext,
  fetchIbusZipCached,
} from "@/lib/ibus/ibusFetch";
import {
  resolveIbusDownloadUrls,
  verifyDownloadMethod,
} from "@/lib/ibus/download";
import {
  buildRouteSchedules,
  buildScheduleCorpus,
} from "@/lib/ibus/routeScheduleImport";
import {
  buildRunningLookupRecords,
  parseGarageXml,
  parseVehicleXml,
} from "@/lib/ibus/parsers";
import { IBUS_OPERATOR_CODES } from "@/lib/ibus/operators";
import { runningShardForTripId } from "@/lib/ibus/keys";
import type { IbusRunningRecord } from "@/lib/ibus/types";
import fs from "node:fs/promises";
import path from "node:path";

const SIZE_WARNING_ROUTE_SCHEDULE_TOTAL = 250 * 1024 * 1024;
const SIZE_WARNING_OUTPUT_TOTAL = 50 * 1024 * 1024;
const SIZE_WARNING_SINGLE_ROUTE = 5 * 1024 * 1024;
const SIZE_WARNING_SELECTED_ROUTE = 1024 * 1024;

export interface ImportSingleVersionResult {
  baseVersion: string;
  outputRoot: string;
  importReport: IbusImportReport;
  currentManifest: IbusCurrentManifest;
  warnings: string[];
}

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

export async function computeDirectorySize(dirPath: string): Promise<number> {
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

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
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

export async function importSingleIbusBaseVersion(
  baseVersion: string,
  routeScheduleConfig: RouteScheduleImportConfig,
  options?: { forceDownload?: boolean },
): Promise<ImportSingleVersionResult> {
  const startedAt = Date.now();
  const warnings: string[] = [];
  const fileSizes: Record<string, number> = {};
  const operatorFoldersDetected = [...IBUS_OPERATOR_CODES];

  const urls = resolveIbusDownloadUrls(baseVersion);
  const context = createIbusFetchContext(baseVersion);
  const downloadVerification = await verifyDownloadMethod(baseVersion);
  warnings.push(...downloadVerification.warnings);

  const outputRoot = path.join("public", "data", "ibus", baseVersion);
  const shardDir = path.join(outputRoot, "running-shards");

  let vehicleRecords: Record<string, unknown> = {};
  const vehicleZip = await fetchIbusZipCached(context, urls.vehicleZip, "Vehicle zip");
  if (!vehicleZip) {
    warnings.push(`Vehicle zip missing: ${urls.vehicleZip}`);
  } else {
    const { extractXmlFiles } = await import("@/lib/ibus/zipExtract");
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
  const garageZip = await fetchIbusZipCached(context, urls.garageZip, "Garage zip");
  if (!garageZip) {
    warnings.push(`Garage zip missing: ${urls.garageZip}`);
  } else {
    const { extractXmlFiles } = await import("@/lib/ibus/zipExtract");
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
    const size = await writeJson(shardPath, records);
    fileSizes[`running-shards/${shard}.json`] = size;
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
  } else if (routeScheduleConfig.mode === "selected") {
    routeSchedulesRequested = routeScheduleConfig.routeIds.join(",");
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
    forceDownload: options?.forceDownload ?? false,
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
      operators:
        corpus.stats.operatorZipsDownloaded.length +
        corpus.stats.operatorZipsReusedFromCache.length,
      warnings: warnings.length,
    },
    ...(routeScheduleRoutes.length > 0 ? { routeScheduleRoutes } : {}),
  };

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[${baseVersion}] Import complete in ${elapsedSeconds}s — routes: ${routeSchedulesGenerated}, output: ${formatBytes(totalOutputSizeBytes)}`,
  );

  return {
    baseVersion,
    outputRoot,
    importReport,
    currentManifest,
    warnings,
  };
}
