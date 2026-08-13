import type { BaseVersionSyncStatus } from "@/lib/ibus/baseVersionDiscovery";

export type IbusWorkflowStep =
  | "done"
  | "import"
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

  if (context.status === "up-to-date") {
    if (context.hasUncommittedIbusChanges) {
      return {
        step: "prepare-pr",
        headline: "Base version data is current — finish the PR",
        detail:
          "Local data already matches TfL. Uncommitted iBus files still need committing and pushing.",
        nextCommand: "npm run prepare:ibus-pr -- --apply",
        nextCommandNote:
          "Creates the branch, commits only iBus data, pushes, and opens the PR. Dry-run first with: npm run prepare:ibus-pr",
      };
    }

    return {
      step: "done",
      headline: "Base version up to date",
      detail: "Nothing needed to be done.",
      nextCommand: null,
      nextCommandNote: null,
    };
  }

  // Update needed
  if (local.includes(active) && current !== active) {
    return {
      step: "rebuild-manifest",
      headline: "Update needed — active version is imported but not selected",
      detail: `Folder ${active} exists locally, but current.json still points at ${current ?? "nothing"}.`,
      nextCommand: "npm run rebuild:ibus-manifest",
      nextCommandNote: "Rewrites public/data/ibus/current.json from local folders.",
    };
  }

  if (!local.includes(active)) {
    return {
      step: "import",
      headline: "Update needed — fetch the new base version",
      detail: `App is on ${current ?? "no version"}; TfL active is ${active}.`,
      nextCommand: "npm run import:ibus:active",
      nextCommandNote:
        `Downloads and imports ${active} (often several minutes), then updates the manifest.`,
    };
  }

  // Active folder exists and current already points at it, but status still
  // says update-needed (shouldn't happen). Send them to verify.
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
}): IbusPrPlan {
  const { newBaseVersion, oldBaseVersions = [] } = options;
  const previousBaseVersions = oldBaseVersions.filter(
    (version) => version !== newBaseVersion,
  );
  const branchName = `chore/ibus-base-${newBaseVersion}`;
  const commitMessage = `Update iBus static data to active base version ${newBaseVersion}`;
  const prTitle = `Update iBus base version to ${newBaseVersion}`;
  const prBody = [
    "## Summary",
    `- Update local iBus static data to TfL active base version \`${newBaseVersion}\`.`,
    "",
    "## Test plan",
    "- [ ] `npm run check:ibus` reports up to date",
    "- [ ] `npm run verify:ibus-local` passes",
    "- [ ] Spot-check a route for schedule timing / running numbers",
  ].join("\n");

  const steps: IbusPrPlanStep[] = [];

  if (previousBaseVersions.length > 0) {
    steps.push({
      id: "remove-old",
      title: "Remove previous base version folder(s)",
      command: previousBaseVersions
        .map((version) => `git rm -r public/data/ibus/${version}`)
        .join(" && "),
      explanation:
        "Keeps the repo small by dropping the old tracked version. Version folders are huge; we only keep the one active version in git.",
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
        "current.json tells the app which base version to load (paths, route list, active version).",
    },
    {
      id: "stage-data",
      title: "Force-add the new version folder",
      command: `git add -f public/data/ibus/${newBaseVersion}`,
      explanation:
        "public/data/ibus/YYYYMMDD/ is gitignored on purpose so multi-version imports (~GBs) cannot be committed by accident. -f (force) is required to intentionally commit the single active version.",
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
}): void {
  const active = options.activeBaseVersionFromXml ?? "unknown";
  const current = options.appCurrentBaseVersion ?? "none";

  printWorkflowBlock({
    title: "iBus base version check",
    lines: [
      `  TfL active:   ${active}`,
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
