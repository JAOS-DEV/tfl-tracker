import {
  buildBaseVersionDiscoveryReport,
  resolveBaseVersionSyncStatus,
} from "../lib/ibus/baseVersionDiscovery";
import {
  printCheckSummary,
  printWorkflowBlock,
  resolveIbusWorkflowGuidance,
} from "../lib/ibus/baseVersionWorkflow";
import { hasUncommittedIbusChanges } from "../lib/ibus/ibusGitStatus";

function printDetails(
  report: Awaited<ReturnType<typeof buildBaseVersionDiscoveryReport>>,
): void {
  printWorkflowBlock({
    title: "Details",
    lines: [
      "  Remote available base versions:",
      ...(report.remoteAvailableBaseVersions.length > 0
        ? report.remoteAvailableBaseVersions.map((version) => `    - ${version}`)
        : ["    (none)"]),
      "",
      "  Local imported base versions:",
      ...(report.localImportedBaseVersions.length > 0
        ? report.localImportedBaseVersions.map((version) => `    - ${version}`)
        : ["    (none)"]),
      "",
      "  Missing locally (remote exists, not imported):",
      ...(report.missingLocally.length > 0
        ? report.missingLocally.map((version) => `    - ${version}`)
        : ["    none"]),
      "",
      "  Missing remotely (local exists, remote probe failed):",
      ...(report.missingRemotely.length > 0
        ? report.missingRemotely.map((version) => `    - ${version}`)
        : ["    none"]),
      "",
    ],
  });
}

async function main(): Promise<void> {
  const failOnOutdated = process.argv.includes("--fail-on-outdated");
  const verbose = process.argv.includes("--verbose");

  console.log("Checking iBus base versions against TfL...");
  const report = await buildBaseVersionDiscoveryReport();
  const status = resolveBaseVersionSyncStatus(
    report.activeBaseVersionFromXml,
    report.appCurrentBaseVersion,
    report.localImportedBaseVersions,
  );
  const guidance = resolveIbusWorkflowGuidance({
    status,
    activeBaseVersionFromXml: report.activeBaseVersionFromXml,
    appCurrentBaseVersion: report.appCurrentBaseVersion,
    localImportedBaseVersions: report.localImportedBaseVersions,
    hasUncommittedIbusChanges: hasUncommittedIbusChanges(),
  });

  printCheckSummary({
    activeBaseVersionFromXml: report.activeBaseVersionFromXml,
    appCurrentBaseVersion: report.appCurrentBaseVersion,
    guidance,
  });

  if (verbose) {
    printDetails(report);
  }

  if (failOnOutdated && status !== "up-to-date") {
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
