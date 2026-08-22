import type { BaseVersionSyncStatus } from "@/lib/ibus/baseVersionDiscovery";
import {
  describeBaseVersionEffectiveDate,
  formatEffectiveDateRelation,
  londonCalendarDate,
} from "@/lib/ibus/baseVersionEffectiveDate";

export type IbusWorkflowStep =
  | "done"
  | "import"
  | "import-live"
  | "rebuild-manifest"
  | "verify"
  | "prepare-pr"
  | "unknown";

export interface IbusWorkflowGuidance {
  step: IbusWorkflowStep;
  headline: string;
  detail: string;
  nextCommand: string | null;
  nextCommandNote: string | null;
}

export interface IbusWorkflowContext {
  status: BaseVersionSyncStatus;
  activeBaseVersionFromXml: string | null;
  appCurrentBaseVersion: string | null;
  localImportedBaseVersions: string[];
  /** Majority baseVersion from live TfL arrivals (authoritative for schedule matching). */
  livePredictionBaseVersion?: string | null;
  /** Route schedule counts by base version from current.json (0 = timing will fail). */
  routeScheduleCountsByVersion?: Record<string, number>;
  /** London YYYY-MM-DD; injectable for tests. */
  todayLondon?: string;
  /** True when local data already matches TfL active, but git still has ibus changes to ship. */
  hasUncommittedIbusChanges?: boolean;
}

export interface IbusPrPlanStep {
  id: string;
  title: string;
  command: string | null;
  explanation: string;
  optional?: boolean;
}

export interface IbusPrPlan {
  newBaseVersion: string;
  branchName: string;
  previousBaseVersions: string[];
  /** Extra folders that must stay in git (usually the live-still-used version). */
  keepBaseVersions: string[];
  commitMessage: string;
  prTitle: string;
  prBody: string;
  steps: IbusPrPlanStep[];
}

const DIVIDER = "════════════════════════════════════════";
const SUBDIVIDER = "────────────────────────────────────────";

export function resolveIbusWorkflowGuidance(
  context: IbusWorkflowContext,
): IbusWorkflowGuidance {
  const active = context.activeBaseVersionFromXml;
  const current = context.appCurrentBaseVersion;
  const local = context.localImportedBaseVersions;
  const live = context.livePredictionBaseVersion?.trim() || null;
  const todayLondon = context.todayLondon ?? londonCalendarDate();
  const routeCounts = context.routeScheduleCountsByVersion ?? {};

  const routeCountFor = (version: string | null): number | null => {
    if (!version) {
      return null;
    }
    if (!(version in routeCounts)) {
      return null;
    }
    return routeCounts[version] ?? 0;
  };

  // Live arrivals are what schedule matching uses. Missing that folder is urgent.
  if (live && !local.includes(live)) {
    const liveInfo = describeBaseVersionEffectiveDate(live, todayLondon);
    const xmlNote =
      active && active !== live
        ? ` Base_Version.xml currently points at ${formatEffectiveDateRelation(
            describeBaseVersionEffectiveDate(active, todayLondon),
          )}, but live predictions still send ${live}.`
        : "";

    return {
      step: "import-live",
      headline: "Live predictions need a local base version",
      detail: `Live arrivals use ${formatEffectiveDateRelation(liveInfo)}. That folder is not imported locally, so buses will show Unknown timing.${xmlNote}`,
      nextCommand: "npm run import:ibus:active",
      nextCommandNote:
        "Imports the XML/live-active version with ALL route schedules (required for timing). Prefer this over bare import:ibus, which defaults to zero schedules.",
    };
  }

  // Folder exists but no schedules → Unknown timing (common after bare npm run import:ibus).
  const liveRouteCount = routeCountFor(live);
  if (live && local.includes(live) && liveRouteCount === 0) {
    return {
      step: "import-live",
      headline: "Live base version has no route schedules",
      detail: `${live} is imported, but it has 0 route schedules. Schedule matching needs per-route JSON — without it every bus shows Unknown timing.`,
      nextCommand: "npm run import:ibus:active",
      nextCommandNote:
        `Re-imports with all route schedules. Prefer npm run import:ibus:active. On PowerShell: $env:IBUS_BASE_VERSION="${live}"; $env:IBUS_ROUTE_SCHEDULES="all"; npm run import:ibus`,
    };
  }

  const currentRouteCount = routeCountFor(current);
  if (
    current &&
    local.includes(current) &&
    currentRouteCount === 0 &&
    (!live || live === current)
  ) {
    return {
      step: "import-live",
      headline: "App current base version has no route schedules",
      detail: `${current} is selected in current.json but has 0 route schedules.`,
      nextCommand: "npm run import:ibus:active",
      nextCommandNote:
        "Re-imports with all route schedules (bare import:ibus defaults to none).",
    };
  }

  if (context.status === "unknown" || !active) {
    return {
      step: "unknown",
      headline: "Could not determine TfL active base version",
      detail:
        "Check your network connection, then run the check again.",
      nextCommand: "npm run check:ibus",
      nextCommandNote: "Retry once TfL Base_Version.xml is reachable.",
    };
  }

  const activeInfo = describeBaseVersionEffectiveDate(active, todayLondon);
  const livePresent = Boolean(live && local.includes(live));
  const xmlLeadsLive = Boolean(live && active !== live);

  if (context.status === "up-to-date") {
    if (context.hasUncommittedIbusChanges) {
      return {
        step: "prepare-pr",
        headline: "Base version data is current — finish the PR",
        detail:
          livePresent && xmlLeadsLive
            ? `Local data matches TfL XML (${formatEffectiveDateRelation(activeInfo)}). Live predictions still use ${live} — keep that folder. Uncommitted iBus files still need committing and pushing.`
            : "Local data already matches TfL XML. Uncommitted iBus files still need committing and pushing. Keep any version live predictions still use.",
        nextCommand: "npm run prepare:ibus-pr -- --apply",
        nextCommandNote:
          "Creates the branch, commits only iBus data, pushes, and opens the PR. Dry-run first with: npm run prepare:ibus-pr",
      };
    }

    if (livePresent && xmlLeadsLive) {
      return {
        step: "done",
        headline: "Timing-safe — live version is local",
        detail: `Live predictions use ${live} (imported). XML lists ${formatEffectiveDateRelation(
          activeInfo,
        )}. Keep ${live} until live arrivals switch; do not delete it early.`,
        nextCommand: null,
        nextCommandNote: null,
      };
    }

    return {
      step: "done",
      headline: "Base version up to date",
      detail: live
        ? `Nothing needed. Live predictions and XML both use ${live}.`
        : "Nothing needed to be done.",
      nextCommand: null,
      nextCommandNote: null,
    };
  }

  // XML active is ahead of app current / missing locally
  if (local.includes(active) && current !== active) {
    return {
      step: "rebuild-manifest",
      headline: "Update needed — XML-active version is imported but not selected",
      detail: `Folder ${active} exists locally, but current.json still points at ${current ?? "nothing"}.`,
      nextCommand: "npm run rebuild:ibus-manifest",
      nextCommandNote: livePresent
        ? `Rewrites current.json. Live still uses ${live} — that folder will remain available for matching.`
        : "Rewrites public/data/ibus/current.json from local folders.",
    };
  }

  if (!local.includes(active)) {
    const futureNote =
      activeInfo.relationToToday === "future"
        ? " Its labelled date is still in the future, so live may keep an older baseVersion until then."
        : "";

    return {
      step: "import",
      headline: xmlLeadsLive
        ? "Optional prep — import XML-active version (live still on older)"
        : "Update needed — fetch the XML-active base version",
      detail: `XML active is ${formatEffectiveDateRelation(activeInfo)}.${
        livePresent
          ? ` Live predictions still use ${live} (already local — timing OK).`
          : ""
      }${futureNote}`,
      nextCommand: "npm run import:ibus:active",
      nextCommandNote: livePresent
        ? `Pre-imports ${active} without removing ${live}. Only delete ${live} after live arrivals switch.`
        : `Downloads and imports ${active} (often several minutes), then updates the manifest.`,
    };
  }

  return {
    step: "verify",
    headline: "Update needed — verify local data",
    detail: `Confirm local iBus data for ${active} is healthy before opening a PR.`,
    nextCommand: "npm run verify:ibus-local",
    nextCommandNote: "Checks manifest, folder, and route coverage.",
  };
}

export function buildIbusPrPlan(options: {
  newBaseVersion: string;
  oldBaseVersions?: string[];
  /** Never offer to delete the version live predictions still use. */
  livePredictionBaseVersion?: string | null;
}): IbusPrPlan {
  const { newBaseVersion, oldBaseVersions = [], livePredictionBaseVersion } =
    options;
  const live = livePredictionBaseVersion?.trim() || null;
  const keepBaseVersions =
    live && live !== newBaseVersion ? [live] : [];
  const previousBaseVersions = oldBaseVersions.filter(
    (version) =>
      version !== newBaseVersion && !keepBaseVersions.includes(version),
  );
  const branchName = `chore/ibus-base-${newBaseVersion}`;
  const commitMessage = keepBaseVersions.length
    ? `Update iBus static data to ${newBaseVersion} (keep live ${keepBaseVersions.join(", ")})`
    : `Update iBus static data to active base version ${newBaseVersion}`;
  const prTitle = `Update iBus base version to ${newBaseVersion}`;
  const prBody = [
    "## Summary",
    `- Update local iBus static data to TfL XML-active base version \`${newBaseVersion}\`.`,
    ...(keepBaseVersions.length > 0
      ? [
          `- Also keep \`${keepBaseVersions.join("`, `")}\` because live predictions still use it for schedule matching.`,
        ]
      : []),
    "",
    "## Test plan",
    "- [ ] `npm run check:ibus` reports timing-safe / up to date",
    "- [ ] `npm run verify:ibus-local` passes",
    "- [ ] Spot-check a route for schedule timing / running numbers",
    ...(keepBaseVersions.length > 0
      ? [
          `- [ ] Confirm live API still on \`${keepBaseVersions[0]}\` and that folder remains in the PR`,
        ]
      : []),
  ].join("\n");

  const steps: IbusPrPlanStep[] = [];

  if (previousBaseVersions.length > 0) {
    steps.push({
      id: "remove-old",
      title: "Optionally remove previous base version folder(s)",
      command: previousBaseVersions
        .map((version) => `git rm -r public/data/ibus/${version}`)
        .join(" && "),
      explanation:
        "Only do this after live TfL predictions also use the new baseVersion. If live still sends the old version, deleting it makes every bus show Unknown timing. Default apply keeps old versions; pass --remove-old to delete.",
      optional: true,
    });
  }

  steps.push(
    {
      id: "branch",
      title: "Create / switch to update branch",
      command: `git checkout -b ${branchName}`,
      explanation:
        "Puts the base-version update on its own branch (created from origin/main when possible) so the PR stays focused on iBus data.",
    },
    {
      id: "stage-manifest",
      title: "Stage the manifest",
      command: "git add public/data/ibus/current.json",
      explanation:
        "current.json lists available local versions and path templates. Matching prefers the live prediction baseVersion when that folder is available.",
    },
  );

  if (keepBaseVersions.length > 0) {
    steps.push({
      id: "stage-live",
      title: "Force-add the live-still-used version folder",
      command: keepBaseVersions
        .map((version) => `git add -f public/data/ibus/${version}`)
        .join(" && "),
      explanation:
        "Live arrivals still send this baseVersion. It must stay in the repo (or be restored if a prior commit deleted it) or every bus shows Unknown timing.",
    });
  }

  steps.push(
    {
      id: "stage-data",
      title: "Force-add the new version folder",
      command: `git add -f public/data/ibus/${newBaseVersion}`,
      explanation:
        "public/data/ibus/YYYYMMDD/ is gitignored on purpose so multi-version imports (~GBs) cannot be committed by accident. -f (force) is required to intentionally commit the version.",
    },
    {
      id: "commit",
      title: "Commit",
      command: `git commit -m "${commitMessage}"`,
      explanation:
        "Records only the iBus data/manifest change (this helper will not stage unrelated files).",
    },
    {
      id: "push",
      title: "Push branch",
      command: "git push -u origin HEAD",
      explanation: "Publishes the branch to GitHub so a pull request can be opened.",
    },
    {
      id: "pr",
      title: "Open pull request",
      command: `gh pr create --title "${prTitle}" --body "..."`,
      explanation:
        "Opens the PR with a short summary and test plan. Review the diff on GitHub before merging.",
    },
  );

  return {
    newBaseVersion,
    branchName,
    previousBaseVersions,
    keepBaseVersions,
    commitMessage,
    prTitle,
    prBody,
    steps,
  };
}

/** @deprecated Prefer buildIbusPrPlan — kept for older call sites/tests. */
export function buildIbusPrCommands(options: {
  newBaseVersion: string;
  oldBaseVersions?: string[];
}): string[] {
  const plan = buildIbusPrPlan(options);
  const lines: string[] = [];

  for (const step of plan.steps) {
    if (!step.command) {
      continue;
    }
    if (step.optional) {
      lines.push(`# Optional: ${step.title}`);
    }
    lines.push(step.command);
  }

  return lines;
}

export function printWorkflowBlock(options: {
  title: string;
  lines: string[];
}): void {
  console.log("");
  console.log(DIVIDER);
  console.log(` ${options.title}`);
  console.log(DIVIDER);
  console.log("");
  for (const line of options.lines) {
    console.log(line);
  }
}

export function printNextStep(options: {
  command: string | null;
  note?: string | null;
  extraLines?: string[];
}): void {
  console.log("");
  console.log(SUBDIVIDER);
  console.log(" Next step");
  console.log(SUBDIVIDER);
  console.log("");

  if (options.command) {
    console.log(`  ${options.command}`);
    if (options.note) {
      console.log("");
      console.log(`  ${options.note}`);
    }
  } else if (!options.extraLines?.length) {
    console.log("  None — you are done.");
  }

  if (options.extraLines && options.extraLines.length > 0) {
    if (options.command) {
      console.log("");
    }
    for (const line of options.extraLines) {
      console.log(line.length === 0 ? "" : `  ${line}`);
    }
  }
  console.log("");
}

export function printIbusPrPlan(plan: IbusPrPlan): void {
  printWorkflowBlock({
    title: "Prepare iBus base version PR",
    lines: [
      `  Base version to ship: ${plan.newBaseVersion}`,
      `  Branch:               ${plan.branchName}`,
      "",
      "  What will happen (only iBus data paths are staged):",
    ],
  });

  for (const [index, step] of plan.steps.entries()) {
    console.log(`  ${index + 1}. ${step.title}${step.optional ? " (optional)" : ""}`);
    if (step.command) {
      console.log(`     $ ${step.command}`);
    }
    console.log(`     → ${step.explanation}`);
    console.log("");
  }
}

export function printCheckSummary(options: {
  activeBaseVersionFromXml: string | null;
  appCurrentBaseVersion: string | null;
  guidance: IbusWorkflowGuidance;
  livePredictionBaseVersion?: string | null;
  todayLondon?: string;
}): void {
  const todayLondon = options.todayLondon ?? londonCalendarDate();
  const active = options.activeBaseVersionFromXml
    ? formatEffectiveDateRelation(
        describeBaseVersionEffectiveDate(
          options.activeBaseVersionFromXml,
          todayLondon,
        ),
      )
    : "unknown";
  const current = options.appCurrentBaseVersion ?? "none";
  const live = options.livePredictionBaseVersion
    ? formatEffectiveDateRelation(
        describeBaseVersionEffectiveDate(
          options.livePredictionBaseVersion,
          todayLondon,
        ),
      )
    : null;

  printWorkflowBlock({
    title: "iBus base version check",
    lines: [
      `  London today: ${todayLondon}`,
      `  Live API:     ${live ?? "unavailable (sample failed)"}`,
      `  TfL XML:      ${active}`,
      `  App current:  ${current}`,
      "",
      `  ${options.guidance.headline}`,
      `  ${options.guidance.detail}`,
    ],
  });

  printNextStep({
    command: options.guidance.nextCommand,
    note: options.guidance.nextCommandNote,
  });

  console.log(DIVIDER);
  console.log("");
}
