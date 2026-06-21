import { isForceDownload } from "../lib/ibus/cache";
import { importActiveIbusVersion } from "../lib/ibus/importActiveIbusVersion";

async function main(): Promise<void> {
  console.log("Importing active iBus base version (all routes)...");
  const result = await importActiveIbusVersion({
    forceDownload: isForceDownload(),
    rebuildFromDisk: true,
  });

  console.log("");
  console.log("Active iBus import complete");
  console.log(`Active baseVersion: ${result.activeBaseVersion}`);
  console.log(
    `Route schedules generated: ${result.importResult.importReport.routeSchedulesGenerated}`,
  );
  console.log(
    `Local versions in manifest: ${result.manifest.availableBaseVersions?.join(", ") ?? result.manifest.baseVersion}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
