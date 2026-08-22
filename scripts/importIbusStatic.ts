import {
  buildBaseVersionDiscoveryReport,
  fetchActiveBaseVersionFromXml,
} from "../lib/ibus/baseVersionDiscovery";
import {
  isLargeStaticImportAllowed,
  parseBaseVersionsEnv,
  parseRouteScheduleEnv,
} from "../lib/ibus/importConfig";
import { importSingleIbusBaseVersion } from "../lib/ibus/importSingleVersion";
import { isForceDownload } from "../lib/ibus/cache";
import {
  buildStaticSizeReport,
  printStaticSizeReport,
  rebuildMultiVersionManifestFromDisk,
} from "../lib/ibus/multiVersionManifest";
import {
  printNextStep,
  printWorkflowBlock,
} from "../lib/ibus/baseVersionWorkflow";
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

  // Rebuild from every local folder so importing one version does not drop others.
  const activeBaseVersionFromXml =
    (await fetchActiveBaseVersionFromXml().catch(() => null)) ?? baseVersion;
  const manifest = await rebuildMultiVersionManifestFromDisk(
    activeBaseVersionFromXml,
  );
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

  printWorkflowBlock({
    title: "iBus import complete",
    lines: [
      `  Imported base version: ${baseVersion}`,
      `  Route schedules:       ${result.importReport.routeSchedulesGenerated}`,
      `  Local versions now:    ${
        manifest.availableBaseVersions?.join(", ") ?? manifest.baseVersion
      }`,
      `  Warnings:              ${result.warnings.length}`,
    ],
  });

  if (result.importReport.routeSchedulesGenerated === 0) {
    printNextStep({
      command: "npm run import:ibus:active",
      note: "This import had 0 route schedules (IBUS_ROUTE_SCHEDULES defaults to none). Re-run with all routes or timing will stay Unknown.",
      extraLines: [
        "Bare npm run import:ibus does not import schedules unless you set:",
        '  $env:IBUS_ROUTE_SCHEDULES="all"',
      ],
    });
    return;
  }

  printNextStep({
    command: "npm run verify:ibus-local",
    note: "Confirms the new data looks healthy before you open a PR.",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
