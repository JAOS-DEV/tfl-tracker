import { buildBaseVersionDiscoveryReport } from "../lib/ibus/baseVersionDiscovery";

async function main(): Promise<void> {
  console.log("Checking iBus base versions...");
  const report = await buildBaseVersionDiscoveryReport();

  console.log("");
  console.log("=== iBus base version discovery ===");
  console.log(
    `Active baseVersion from Base_Version.xml: ${report.activeBaseVersionFromXml ?? "unknown"}`,
  );
  console.log("");
  console.log("Remote available base versions:");
  for (const version of report.remoteAvailableBaseVersions) {
    console.log(`  - ${version}`);
  }
  console.log("");
  console.log("Local imported base versions:");
  for (const version of report.localImportedBaseVersions) {
    console.log(`  - ${version}`);
  }
  console.log("");
  console.log("Missing locally (remote exists, not imported):");
  if (report.missingLocally.length === 0) {
    console.log("  none");
  } else {
    for (const version of report.missingLocally) {
      console.log(`  - ${version}`);
    }
  }
  console.log("");
  console.log("Missing remotely (local exists, remote probe failed):");
  if (report.missingRemotely.length === 0) {
    console.log("  none");
  } else {
    for (const version of report.missingRemotely) {
      console.log(`  - ${version}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
