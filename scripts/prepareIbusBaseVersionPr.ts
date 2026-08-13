import {
  listLocalBaseVersions,
  readAppCurrentBaseVersion,
  resolveBaseVersionSyncStatus,
  fetchActiveBaseVersionFromXml,
} from "../lib/ibus/baseVersionDiscovery";
import {
  buildIbusPrPlan,
  printIbusPrPlan,
  printNextStep,
  printWorkflowBlock,
} from "../lib/ibus/baseVersionWorkflow";
import { applyIbusPrPlan } from "../lib/ibus/prepareIbusPrActions";

function parseArgs(argv: string[]): {
  apply: boolean;
  keepOld: boolean;
} {
  return {
    apply: argv.includes("--apply"),
    keepOld: argv.includes("--keep-old"),
  };
}

async function main(): Promise<void> {
  const { apply, keepOld } = parseArgs(process.argv.slice(2));

  const [activeBaseVersionFromXml, appCurrentBaseVersion, localImportedBaseVersions] =
    await Promise.all([
      fetchActiveBaseVersionFromXml().catch(() => null),
      readAppCurrentBaseVersion(),
      listLocalBaseVersions(),
    ]);

  const status = resolveBaseVersionSyncStatus(
    activeBaseVersionFromXml,
    appCurrentBaseVersion,
    localImportedBaseVersions,
  );

  if (status !== "up-to-date" || !appCurrentBaseVersion) {
    printWorkflowBlock({
      title: "Not ready to open a PR yet",
      lines: [
        `  TfL active:   ${activeBaseVersionFromXml ?? "unknown"}`,
        `  App current:  ${appCurrentBaseVersion ?? "none"}`,
        "",
        "  Local data does not match TfL's active base version yet.",
      ],
    });

    printNextStep({
      command: "npm run check:ibus",
      note: "Re-run the guided check — it will tell you the exact next command.",
    });
    process.exit(1);
  }

  const plan = buildIbusPrPlan({
    newBaseVersion: appCurrentBaseVersion,
    oldBaseVersions: localImportedBaseVersions,
  });

  printIbusPrPlan(plan);

  if (!apply) {
    printNextStep({
      command: "npm run prepare:ibus-pr -- --apply",
      note: "Runs the steps above automatically (branch, stage iBus only, commit, push, open PR).",
      extraLines: [
        "Options:",
        "  --keep-old   Do not remove previous local version folder(s)",
        "",
        "Tip: review with a dry-run first (this command), then add --apply.",
      ],
    });
    return;
  }

  const { prUrl } = applyIbusPrPlan(plan, {
    removeOldVersions: !keepOld,
  });

  printWorkflowBlock({
    title: "iBus PR ready",
    lines: [
      `  Base version: ${plan.newBaseVersion}`,
      `  Branch:       ${plan.branchName}`,
      `  Pull request: ${prUrl ?? "(created — check gh pr view)"}`,
      "",
      "  Only public/data/ibus files were staged for this commit.",
      "  Unrelated local changes (if any) were left alone.",
    ],
  });

  printNextStep({
    command: null,
    extraLines: [
      "Review and merge the PR when ready.",
      "After it deploys, re-run:",
      "",
      "  npm run check:ibus",
      "",
      "It should report: Base version up to date.",
    ],
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
