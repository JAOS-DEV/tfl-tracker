import {
  buildBaseVersionDiscoveryReport,
  getIbusDataRoot,
  resolveBaseVersionSyncStatus,
} from "../lib/ibus/baseVersionDiscovery";
import {
  describeBaseVersionEffectiveDate,
  formatEffectiveDateRelation,
  londonCalendarDate,
} from "../lib/ibus/baseVersionEffectiveDate";
import {
  printCheckSummary,
  printNextStep,
  printWorkflowBlock,
  resolveIbusWorkflowGuidance,
} from "../lib/ibus/baseVersionWorkflow";
import { hasUncommittedIbusChanges } from "../lib/ibus/ibusGitStatus";
import { probeLiveBaseVersion } from "../lib/ibus/liveBaseVersionProbe";
import type { IbusMultiVersionManifest } from "../lib/ibus/types";
import fs from "node:fs";
import path from "node:path";

function readRouteScheduleCountsByVersion(): Record<string, number> {
  try {
    const manifestPath = path.join(getIbusDataRoot(), "current.json");
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8"),
    ) as IbusMultiVersionManifest;
    const counts: Record<string, number> = {};
    const byVersion = manifest.routeScheduleRoutesByBaseVersion ?? {};
    for (const [version, routes] of Object.entries(byVersion)) {
      counts[version] = routes.length;
    }
    if (
      manifest.baseVersion &&
      !(manifest.baseVersion in counts) &&
      manifest.routeScheduleRoutes
    ) {
      counts[manifest.baseVersion] = manifest.routeScheduleRoutes.length;
    }
    return counts;
  } catch {
    return {};
  }
}

function printDetails(
  report: Awaited<ReturnType<typeof buildBaseVersionDiscoveryReport>>,
  todayLondon: string,
): void {
  printWorkflowBlock({
    title: "Details",
    lines: [
      "  Remote available base versions:",
      ...(report.remoteAvailableBaseVersions.length > 0
        ? report.remoteAvailableBaseVersions.map((version) => {
            const info = describeBaseVersionEffectiveDate(version, todayLondon);
            return `    - ${formatEffectiveDateRelation(info)}`;
          })
        : ["    (none)"]),
      "",
      "  Local imported base versions:",
      ...(report.localImportedBaseVersions.length > 0
        ? report.localImportedBaseVersions.map((version) => {
            const info = describeBaseVersionEffectiveDate(version, todayLondon);
            return `    - ${formatEffectiveDateRelation(info)}`;
          })
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
  const todayLondon = londonCalendarDate();

  console.log("Checking iBus base versions against TfL...");
  console.log("Sampling live predictions first (authoritative for timing)...");

  const [report, liveProbe] = await Promise.all([
    buildBaseVersionDiscoveryReport(),
    probeLiveBaseVersion("337"),
  ]);

  const status = resolveBaseVersionSyncStatus(
    report.activeBaseVersionFromXml,
    report.appCurrentBaseVersion,
    report.localImportedBaseVersions,
  );
  const livePredictionBaseVersion = liveProbe.liveBaseVersion;
  const routeScheduleCountsByVersion = readRouteScheduleCountsByVersion();
  const guidance = resolveIbusWorkflowGuidance({
    status,
    activeBaseVersionFromXml: report.activeBaseVersionFromXml,
    appCurrentBaseVersion: report.appCurrentBaseVersion,
    localImportedBaseVersions: report.localImportedBaseVersions,
    livePredictionBaseVersion,
    routeScheduleCountsByVersion,
    todayLondon,
    hasUncommittedIbusChanges: hasUncommittedIbusChanges(),
  });

  printCheckSummary({
    activeBaseVersionFromXml: report.activeBaseVersionFromXml,
    appCurrentBaseVersion: report.appCurrentBaseVersion,
    livePredictionBaseVersion,
    todayLondon,
    guidance,
  });

  if (livePredictionBaseVersion) {
    const liveLocal = report.localImportedBaseVersions.includes(
      livePredictionBaseVersion,
    );
    const xmlDiffers =
      Boolean(report.activeBaseVersionFromXml) &&
      livePredictionBaseVersion !== report.activeBaseVersionFromXml;
    const liveInfo = describeBaseVersionEffectiveDate(
      livePredictionBaseVersion,
      todayLondon,
    );
    const xmlInfo = report.activeBaseVersionFromXml
      ? describeBaseVersionEffectiveDate(
          report.activeBaseVersionFromXml,
          todayLondon,
        )
      : null;

    printWorkflowBlock({
      title: "Live predictions check (route 337 sample)",
      lines: [
        `  Live prediction baseVersion: ${formatEffectiveDateRelation(liveInfo)}`,
        `  Sample source: ${liveProbe.source} (${liveProbe.predictionCount} predictions)`,
        `  Local folder for live version: ${liveLocal ? "yes" : "NO"}`,
        ...(xmlDiffers && xmlInfo
          ? [
              "",
              `  XML active: ${formatEffectiveDateRelation(xmlInfo)}`,
              "  Version ids are YYYYMMDD — often the labelled go-live date. XML can list",
              "  a future-dated pack while live arrivals still use the previous one",
              "  (school holidays / public holidays / staged cutovers).",
              "  Keep the live version until the API stops sending it.",
            ]
          : []),
      ],
    });

    // Guidance already printed the urgent next step; only repeat if live is missing
    // and guidance somehow didn't (should not happen).
    if (!liveLocal && guidance.step !== "import-live") {
      printNextStep({
        command: `IBUS_BASE_VERSION=${livePredictionBaseVersion} IBUS_ROUTE_SCHEDULES=all npm run import:ibus`,
        note: "Imports the base version live predictions still use, then run: npm run rebuild:ibus-manifest",
        extraLines: [
          "Until that folder exists locally, buses will show Unknown timing",
          "even if the newer XML-active version is imported.",
        ],
      });
    }
  } else if (!failOnOutdated) {
    printWorkflowBlock({
      title: "Live predictions check",
      lines: [
        "  Could not sample live prediction baseVersion.",
        `  ${liveProbe.detail ?? "Start npm run dev or set TFL_API_KEY, then re-run."}`,
        "",
        "  Without a live sample, treat Base_Version.xml carefully — it may point at a",
        "  future-dated pack before arrivals switch.",
      ],
    });
  }

  if (verbose) {
    printDetails(report, todayLondon);
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
