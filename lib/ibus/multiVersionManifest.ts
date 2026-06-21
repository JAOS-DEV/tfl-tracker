import fs from "node:fs/promises";
import path from "node:path";
import type {
  IbusBaseVersionSummary,
  IbusCurrentManifest,
  IbusMultiVersionManifest,
} from "@/lib/ibus/types";
import {
  computeDirectorySize,
  formatBytes,
} from "@/lib/ibus/importSingleVersion";
import type { ImportSingleVersionResult } from "@/lib/ibus/importSingleVersion";
import { getIbusDataRoot, listLocalBaseVersions } from "@/lib/ibus/baseVersionDiscovery";

export interface StaticSizeReportRow {
  baseVersion: string;
  routeCount: number;
  scheduleBytes: number;
  runningLookupBytes: number;
  totalBytes: number;
}

export interface StaticSizeReport {
  rows: StaticSizeReportRow[];
  totalPublicDataIbusBytes: number;
  totalAddedBytes: number;
  largestSingleJsonFile: { path: string; bytes: number } | null;
  fileCount: number;
  averageRouteScheduleSizeBytes: number;
  largestRouteScheduleFiles: Array<{ routeId: string; baseVersion: string; bytes: number }>;
  estimatedGitVercelImpact: string;
}

async function countFiles(dirPath: string): Promise<number> {
  let count = 0;

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
        count += 1;
      }
    }
  }

  await walk(dirPath);
  return count;
}

async function findLargestJsonFile(
  ibusRoot: string,
): Promise<{ path: string; bytes: number } | null> {
  let largest: { path: string; bytes: number } | null = null;

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
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        const stat = await fs.stat(entryPath);
        if (!largest || stat.size > largest.bytes) {
          largest = {
            path: entryPath.replace(/\\/g, "/"),
            bytes: stat.size,
          };
        }
      }
    }
  }

  await walk(ibusRoot);
  return largest;
}

export async function buildStaticSizeReport(
  importResults: ImportSingleVersionResult[],
  previousTotalBytes = 0,
): Promise<StaticSizeReport> {
  const ibusRoot = getIbusDataRoot();
  const rows: StaticSizeReportRow[] = [];

  for (const result of importResults) {
    const scheduleBytes = result.importReport.totalRouteScheduleSizeBytes;
    const runningLookupBytes = Object.entries(result.importReport.fileSizes)
      .filter(([key]) => key.startsWith("running-shards/"))
      .reduce((sum, [, size]) => sum + size, 0);

    rows.push({
      baseVersion: result.baseVersion,
      routeCount: result.importReport.routeSchedulesGenerated,
      scheduleBytes,
      runningLookupBytes,
      totalBytes: result.importReport.totalOutputSizeBytes,
    });
  }

  const totalPublicDataIbusBytes = await computeDirectorySize(ibusRoot);
  const fileCount = await countFiles(ibusRoot);
  const largestSingleJsonFile = await findLargestJsonFile(ibusRoot);

  const largestRouteScheduleFiles: StaticSizeReport["largestRouteScheduleFiles"] = [];
  let totalRouteSchedules = 0;
  let totalScheduleBytes = 0;

  for (const result of importResults) {
    for (const entry of result.importReport.topLargestRouteSchedules.slice(0, 3)) {
      largestRouteScheduleFiles.push({
        routeId: entry.routeId,
        baseVersion: result.baseVersion,
        bytes: entry.sizeBytes,
      });
    }
    totalRouteSchedules += result.importReport.routeSchedulesGenerated;
    totalScheduleBytes += result.importReport.totalRouteScheduleSizeBytes;
  }

  largestRouteScheduleFiles.sort((left, right) => right.bytes - left.bytes);

  const averageRouteScheduleSizeBytes =
    totalRouteSchedules > 0
      ? Math.round(totalScheduleBytes / totalRouteSchedules)
      : 0;

  let estimatedGitVercelImpact = "Likely acceptable for Git/Vercel deploy";
  if (totalPublicDataIbusBytes > 1024 * 1024 * 1024) {
    estimatedGitVercelImpact =
      "Too large for typical Git/Vercel repo deploy — consider external static CDN/storage";
  } else if (totalPublicDataIbusBytes > 500 * 1024 * 1024) {
    estimatedGitVercelImpact =
      "Large for Git/Vercel — may slow deploys; monitor build output size";
  }

  return {
    rows,
    totalPublicDataIbusBytes,
    totalAddedBytes: Math.max(0, totalPublicDataIbusBytes - previousTotalBytes),
    largestSingleJsonFile,
    fileCount,
    averageRouteScheduleSizeBytes,
    largestRouteScheduleFiles: largestRouteScheduleFiles.slice(0, 10),
    estimatedGitVercelImpact,
  };
}

export function printStaticSizeReport(report: StaticSizeReport): void {
  console.log("");
  console.log("=== iBus static size report ===");
  console.log(
    "BaseVersion | Route count | Schedule total | Running lookup total | Total",
  );
  for (const row of report.rows) {
    console.log(
      `${row.baseVersion} | ${row.routeCount} | ${formatBytes(row.scheduleBytes)} | ${formatBytes(row.runningLookupBytes)} | ${formatBytes(row.totalBytes)}`,
    );
  }
  console.log("");
  console.log(`Total public/data/ibus size: ${formatBytes(report.totalPublicDataIbusBytes)}`);
  console.log(`Total added size: ${formatBytes(report.totalAddedBytes)}`);
  console.log(
    `Largest single JSON file: ${report.largestSingleJsonFile ? `${report.largestSingleJsonFile.path} (${formatBytes(report.largestSingleJsonFile.bytes)})` : "none"}`,
  );
  console.log(`Number of files: ${report.fileCount}`);
  console.log(
    `Average route schedule size: ${formatBytes(report.averageRouteScheduleSizeBytes)}`,
  );
  if (report.largestRouteScheduleFiles.length > 0) {
    console.log(
      `Largest route schedules: ${report.largestRouteScheduleFiles
        .slice(0, 5)
        .map(
          (entry) =>
            `${entry.baseVersion}/${entry.routeId} (${formatBytes(entry.bytes)})`,
        )
        .join(", ")}`,
    );
  }
  console.log(`Estimated Git/Vercel impact: ${report.estimatedGitVercelImpact}`);
}

export function buildMultiVersionManifest(input: {
  activeBaseVersionFromXml: string;
  importResults: ImportSingleVersionResult[];
  generatedAt?: string;
}): IbusMultiVersionManifest {
  const availableBaseVersions = input.importResults
    .map((result) => result.baseVersion)
    .sort();
  const latestBaseVersion =
    availableBaseVersions[availableBaseVersions.length - 1] ??
    input.activeBaseVersionFromXml;
  const preferredBaseVersion = availableBaseVersions.includes(
    input.activeBaseVersionFromXml,
  )
    ? input.activeBaseVersionFromXml
    : latestBaseVersion;

  const routeScheduleRoutesByBaseVersion: Record<string, string[]> = {};
  const summaryByBaseVersion: Record<string, IbusBaseVersionSummary> = {};

  for (const result of input.importResults) {
    routeScheduleRoutesByBaseVersion[result.baseVersion] =
      result.importReport.routeScheduleRoutes;
    const runningLookupBytes = Object.entries(result.importReport.fileSizes)
      .filter(([key]) => key.startsWith("running-shards/"))
      .reduce((sum, [, size]) => sum + size, 0);

    summaryByBaseVersion[result.baseVersion] = {
      routeCount: result.importReport.routeSchedulesGenerated,
      scheduleBytes: result.importReport.totalRouteScheduleSizeBytes,
      runningLookupBytes,
      totalBytes: result.importReport.totalOutputSizeBytes,
    };
  }

  const preferredResult =
    input.importResults.find(
      (result) => result.baseVersion === preferredBaseVersion,
    ) ?? input.importResults[input.importResults.length - 1];

  const perVersionManifest: IbusCurrentManifest = preferredResult?.currentManifest ?? {
    baseVersion: preferredBaseVersion,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    runningShardPathTemplate: `/data/ibus/${preferredBaseVersion}/running-shards/{shard}.json`,
    routeSchedulePathTemplate: `/data/ibus/${preferredBaseVersion}/route-schedules/{routeId}.json`,
    garageLookupPath: `/data/ibus/${preferredBaseVersion}/garage-lookup.json`,
    vehicleLookupPath: `/data/ibus/${preferredBaseVersion}/vehicle-lookup.json`,
    importReportPath: `/data/ibus/${preferredBaseVersion}/import-report.json`,
    counts: {
      runningNumbers: 0,
      garages: 0,
      vehicles: 0,
      operators: 0,
      warnings: 0,
    },
  };

  return {
    ...perVersionManifest,
    baseVersion: preferredBaseVersion,
    activeBaseVersionFromXml: input.activeBaseVersionFromXml,
    availableBaseVersions,
    routeScheduleRoutesByBaseVersion,
    summaryByBaseVersion,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    routeScheduleRoutes:
      routeScheduleRoutesByBaseVersion[preferredBaseVersion] ??
      perVersionManifest.routeScheduleRoutes,
  };
}

export async function loadExistingMultiVersionManifest(): Promise<IbusMultiVersionManifest | null> {
  const manifestPath = path.join(getIbusDataRoot(), "current.json");
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    return JSON.parse(raw) as IbusMultiVersionManifest;
  } catch {
    return null;
  }
}

export async function rebuildMultiVersionManifestFromDisk(
  activeBaseVersionFromXml: string,
): Promise<IbusMultiVersionManifest> {
  const localVersions = await listLocalBaseVersions();
  const importResults: ImportSingleVersionResult[] = [];

  for (const baseVersion of localVersions) {
    const reportPath = path.join(
      getIbusDataRoot(),
      baseVersion,
      "import-report.json",
    );
    try {
      const reportRaw = await fs.readFile(reportPath, "utf8");
      const importReport = JSON.parse(reportRaw) as ImportSingleVersionResult["importReport"];
      const totalOutputSizeBytes = await computeDirectorySize(
        path.join(getIbusDataRoot(), baseVersion),
      );
      importResults.push({
        baseVersion,
        outputRoot: path.join(getIbusDataRoot(), baseVersion),
        importReport: { ...importReport, totalOutputSizeBytes },
        currentManifest: {
          baseVersion,
          generatedAt: importReport.generatedAt,
          runningShardPathTemplate: `/data/ibus/${baseVersion}/running-shards/{shard}.json`,
          routeSchedulePathTemplate: `/data/ibus/${baseVersion}/route-schedules/{routeId}.json`,
          garageLookupPath: `/data/ibus/${baseVersion}/garage-lookup.json`,
          vehicleLookupPath: `/data/ibus/${baseVersion}/vehicle-lookup.json`,
          importReportPath: `/data/ibus/${baseVersion}/import-report.json`,
          counts: {
            runningNumbers: importReport.runningNumberRecordsGenerated,
            garages: importReport.garageRecordsGenerated,
            vehicles: importReport.vehicleRecordsGenerated,
            operators: importReport.operatorFoldersDetected.length,
            warnings: importReport.warnings.length,
          },
          routeScheduleRoutes: importReport.routeScheduleRoutes,
        },
        warnings: importReport.warnings,
      });
    } catch {
      // skip versions without import report
    }
  }

  return buildMultiVersionManifest({
    activeBaseVersionFromXml,
    importResults,
  });
}
