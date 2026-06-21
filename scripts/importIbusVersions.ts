import fs from "node:fs/promises";
import path from "node:path";
import {
  buildBaseVersionDiscoveryReport,
  fetchActiveBaseVersionFromXml,
} from "../lib/ibus/baseVersionDiscovery";
import {
  computeDirectorySize,
  formatBytes,
  importSingleIbusBaseVersion,
} from "../lib/ibus/importSingleVersion";
import {
  isLargeStaticImportAllowed,
  parseBaseVersionsEnv,
  parseRouteScheduleEnv,
  STATIC_SIZE_FAIL_BYTES,
  STATIC_SIZE_WARN_BYTES,
} from "../lib/ibus/importConfig";
import { isForceDownload } from "../lib/ibus/cache";
import {
  buildMultiVersionManifest,
  buildStaticSizeReport,
  printStaticSizeReport,
} from "../lib/ibus/multiVersionManifest";
import { getIbusDataRoot } from "../lib/ibus/baseVersionDiscovery";

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function resolveImportBaseVersions(): Promise<string[]> {
  const config = parseBaseVersionsEnv(process.env.IBUS_BASE_VERSIONS);
  if (config.mode === "selected") {
    return config.baseVersions;
  }

  const discovery = await buildBaseVersionDiscoveryReport();
  if (config.mode === "all") {
    return discovery.remoteAvailableBaseVersions;
  }

  const active = await fetchActiveBaseVersionFromXml();
  return [active];
}

async function main(): Promise<void> {
  const routeScheduleConfig = parseRouteScheduleEnv(process.env.IBUS_ROUTE_SCHEDULES);
  const baseVersions = await resolveImportBaseVersions();

  if (baseVersions.length === 0) {
    throw new Error("No base versions selected for import");
  }

  const ibusRoot = getIbusDataRoot();
  const previousTotalBytes = await computeDirectorySize(ibusRoot).catch(() => 0);
  const activeBaseVersionFromXml = await fetchActiveBaseVersionFromXml().catch(
    () => baseVersions[0] ?? "unknown",
  );

  console.log(
    `Importing ${baseVersions.length} base version(s): ${baseVersions.join(", ")}`,
  );
  console.log(`Route schedules mode: ${routeScheduleConfig.mode}`);

  const importResults = [];
  for (const baseVersion of baseVersions) {
    console.log("");
    console.log(`--- Importing base version ${baseVersion} ---`);
    const result = await importSingleIbusBaseVersion(
      baseVersion,
      routeScheduleConfig,
      { forceDownload: isForceDownload() },
    );
    importResults.push(result);
  }

  const manifest = buildMultiVersionManifest({
    activeBaseVersionFromXml,
    importResults,
  });
  await writeJson(path.join(ibusRoot, "current.json"), manifest);

  const sizeReport = await buildStaticSizeReport(importResults, previousTotalBytes);
  printStaticSizeReport(sizeReport);
  await writeJson(path.join(ibusRoot, "size-report.json"), sizeReport);

  if (sizeReport.totalPublicDataIbusBytes > STATIC_SIZE_WARN_BYTES) {
    console.warn("");
    console.warn(
      `WARNING: Total public/data/ibus size exceeds ${formatBytes(STATIC_SIZE_WARN_BYTES)} (${formatBytes(sizeReport.totalPublicDataIbusBytes)})`,
    );
    console.warn(
      "This experiment may be too large for Git/Vercel. Review size-report.json before committing.",
    );
  }

  if (
    sizeReport.totalPublicDataIbusBytes > STATIC_SIZE_FAIL_BYTES &&
    !isLargeStaticImportAllowed()
  ) {
    console.error("");
    console.error(
      `FAIL: Total public/data/ibus size exceeds ${formatBytes(STATIC_SIZE_FAIL_BYTES)}.`,
    );
    console.error(
      "Re-run with IBUS_ALLOW_LARGE_STATIC=1 if you intentionally want this size.",
    );
    process.exit(1);
  }

  console.log("");
  console.log("Multi-version manifest written to public/data/ibus/current.json");
  console.log(`Imported versions: ${manifest.availableBaseVersions?.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
