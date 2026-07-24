import {
  buildBaseVersionDiscoveryReport,
  formatBaseVersionStatusLines,
  resolveBaseVersionSyncStatus,
} from "../lib/ibus/baseVersionDiscovery";

function printReport(
  report: Awaited<ReturnType<typeof buildBaseVersionDiscoveryReport>>,
): void {
  console.log("");
  console.log("=== iBus base version status ===");
  for (const line of formatBaseVersionStatusLines(report)) {
    console.log(line);
  }

  console.log("");
  console.log("--- Details ---");
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

async function main(): Promise<void> {
  const failOnOutdated = process.argv.includes("--fail-on-outdated");

  console.log("Checking iBus base versions...");
  const report = await buildBaseVersionDiscoveryReport();
  printReport(report);

  const status = resolveBaseVersionSyncStatus(
    report.activeBaseVersionFromXml,
    report.appCurrentBaseVersion,
    report.localImportedBaseVersions,
  );

  if (failOnOutdated && status !== "up-to-date") {
    console.log("");
    console.error(
      status === "unknown"
        ? "CI check failed: could not determine TfL active base version."
        : "CI check failed: app current base version is behind TfL active version.",
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
