import { isForceDownload } from "../lib/ibus/cache";
import { importActiveIbusVersion } from "../lib/ibus/importActiveIbusVersion";
import {
  printNextStep,
  printWorkflowBlock,
} from "../lib/ibus/baseVersionWorkflow";

async function main(): Promise<void> {
  console.log("Importing active iBus base version (all routes)...");
  const result = await importActiveIbusVersion({
    forceDownload: isForceDownload(),
    rebuildFromDisk: true,
  });

  printWorkflowBlock({
    title: "iBus import complete",
    lines: [
      `  Active base version:     ${result.activeBaseVersion}`,
      `  Route schedules:         ${result.importResult.importReport.routeSchedulesGenerated}`,
      `  Local versions in manifest: ${
        result.manifest.availableBaseVersions?.join(", ") ??
        result.manifest.baseVersion
      }`,
    ],
  });

  printNextStep({
    command: "npm run verify:ibus-local",
    note: "Confirms the new data looks healthy before you open a PR.",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
