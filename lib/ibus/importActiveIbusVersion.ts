import fs from "node:fs/promises";
import path from "node:path";
import { fetchActiveBaseVersionFromXml } from "@/lib/ibus/baseVersionDiscovery";
import {
  importSingleIbusBaseVersion,
  type ImportSingleVersionResult,
} from "@/lib/ibus/importSingleVersion";
import {
  buildMultiVersionManifest,
  buildStaticSizeReport,
  printStaticSizeReport,
  rebuildMultiVersionManifestFromDisk,
} from "@/lib/ibus/multiVersionManifest";
import { isLargeStaticImportAllowed } from "@/lib/ibus/importConfig";
import type { IbusMultiVersionManifest } from "@/lib/ibus/types";

export interface ImportActiveIbusVersionResult {
  activeBaseVersion: string;
  importResult: ImportSingleVersionResult;
  manifest: IbusMultiVersionManifest;
}

async function writeManifest(manifest: IbusMultiVersionManifest): Promise<void> {
  const manifestPath = path.join("public", "data", "ibus", "current.json");
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function importActiveIbusVersion(options?: {
  forceDownload?: boolean;
  rebuildFromDisk?: boolean;
}): Promise<ImportActiveIbusVersionResult> {
  const activeBaseVersion = await fetchActiveBaseVersionFromXml();
  const importResult = await importSingleIbusBaseVersion(
    activeBaseVersion,
    { mode: "all", routeIds: [] },
    { forceDownload: options?.forceDownload ?? false },
  );

  const activeBaseVersionFromXml = activeBaseVersion;
  const manifest = options?.rebuildFromDisk
    ? await rebuildMultiVersionManifestFromDisk(activeBaseVersionFromXml)
    : buildMultiVersionManifest({
        activeBaseVersionFromXml,
        importResults: [importResult],
      });

  await writeManifest(manifest);

  const sizeReport = await buildStaticSizeReport([importResult]);
  printStaticSizeReport(sizeReport);

  if (
    sizeReport.totalPublicDataIbusBytes > 1024 * 1024 * 1024 &&
    !isLargeStaticImportAllowed()
  ) {
    throw new Error("Import size exceeds 1 GB safety gate.");
  }

  return {
    activeBaseVersion,
    importResult,
    manifest,
  };
}
