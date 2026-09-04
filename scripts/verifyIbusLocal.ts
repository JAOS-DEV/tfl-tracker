import { verifyLocalIbusData } from "../lib/ibus/verifyLocalIbusData";
import {
  printNextStep,
  printWorkflowBlock,
} from "../lib/ibus/baseVersionWorkflow";

async function main(): Promise<void> {
  console.log("Verifying local iBus static data...");
  const result = await verifyLocalIbusData();

  printWorkflowBlock({
    title: "Local iBus verification",
    lines: [
      `  Manifest: ${result.manifestPath}`,
      `  TfL active version:  ${result.activeBaseVersionFromXml ?? "unknown"}`,
      `  App current version: ${result.manifestBaseVersion ?? "unknown"}`,
      `  Manifest activeBaseVersionFromXml: ${result.manifestActiveBaseVersion ?? "unknown"}`,
      `  Local baseVersion folders: ${result.localBaseVersions.join(", ") || "none"}`,
      `  Active version route count: ${result.activeVersionRouteCount ?? "unknown"}`,
      `  Remote data URL configured: ${result.remoteDataBaseUrlConfigured ? "yes" : "no"}`,
    ],
  });

  if (result.warnings.length > 0) {
    console.log("  Warnings:");
    for (const warning of result.warnings) {
      console.log(`    - ${warning}`);
    }
    console.log("");
  }

  if (result.errors.length > 0) {
    console.log("  Errors:");
    for (const error of result.errors) {
      console.log(`    - ${error}`);
    }
    console.log("");
    process.exit(1);
  }

  console.log("  Local iBus data looks ready for deployment.");
  console.log("");
  console.log(
    "  Note: Source Control may show no pending iBus files — version folders are",
  );
  console.log(
    "  gitignored. prepare:ibus-pr -- --apply force-adds them into the commit.",
  );

  printNextStep({
    command: "npm run prepare:ibus-pr",
    note: "Dry-run explains each git step (including why nothing appears to stage). Then: npm run prepare:ibus-pr -- --apply",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
