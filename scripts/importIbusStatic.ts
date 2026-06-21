import { buildBaseVersionDiscoveryReport } from "../lib/ibus/baseVersionDiscovery";
import {
  isLargeStaticImportAllowed,
  parseBaseVersionsEnv,
  parseRouteScheduleEnv,
} from "../lib/ibus/importConfig";
import { importSingleIbusBaseVersion } from "../lib/ibus/importSingleVersion";
import { isForceDownload } from "../lib/ibus/cache";
import {
  buildMultiVersionManifest,
  buildStaticSizeReport,
  printStaticSizeReport,
} from "../lib/ibus/multiVersionManifest";
import fs from "node:fs/promises";
import path from "node:path";

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const routeScheduleConfig = parseRouteScheduleEnv(process.env.IBUS_ROUTE_SCHEDULES);
  const versionConfig = parseBaseVersionsEnv(process.env.IBUS_BASE_VERSIONS);

  let baseVersion: string;
  if (versionConfig.mode === "selected" && versionConfig.baseVersions[0]) {
    baseVersion = versionConfig.baseVersions[0];
  } else {
    const report = await buildBaseVersionDiscoveryReport();
    baseVersion =
      report.activeBaseVersionFromXml ??
      report.remoteAvailableBaseVersions.at(-1) ??
      report.localImportedBaseVersions.at(-1) ??
      "20260606";
  }

  console.log(`Fetching iBus data for base version ${baseVersion}...`);
  const result = await importSingleIbusBaseVersion(
    baseVersion,
    routeScheduleConfig,
    { forceDownload: isForceDownload() },
  );

  const manifest = buildMultiVersionManifest({
    activeBaseVersionFromXml: baseVersion,
    importResults: [result],
  });

  await writeJson(path.join("public", "data", "ibus", "current.json"), manifest);

  const sizeReport = await buildStaticSizeReport([result]);
  printStaticSizeReport(sizeReport);

  if (
    sizeReport.totalPublicDataIbusBytes > 1024 * 1024 * 1024 &&
    !isLargeStaticImportAllowed()
  ) {
    console.error("Import size exceeds 1 GB safety gate.");
    process.exit(1);
  }

  console.log("");
  console.log("iBus import complete");
  console.log(`Base version: ${baseVersion}`);
  console.log(`Route schedules generated: ${result.importReport.routeSchedulesGenerated}`);
  console.log(`Total output size: ${sizeReport.rows[0]?.totalBytes ?? 0} bytes`);
  console.log(`Warnings: ${result.warnings.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
