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
import { probeLiveBaseVersion } from "../lib/ibus/liveBaseVersionProbe";

function parseArgs(argv: string[]): {
  apply: boolean;
  removeOld: boolean;
} {
  return {
    apply: argv.includes("--apply"),
    // Default keeps previous versions — live TfL often lags Base_Version.xml.
    removeOld: argv.includes("--remove-old"),
  };
}

async function main(): Promise<void> {
  const { apply, removeOld } = parseArgs(process.argv.slice(2));

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

  const liveProbe = await probeLiveBaseVersion("337");
  const plan = buildIbusPrPlan({
    newBaseVersion: appCurrentBaseVersion,
    oldBaseVersions: localImportedBaseVersions,
    livePredictionBaseVersion: liveProbe.liveBaseVersion,
  });

  printIbusPrPlan(plan);

  if (!apply) {
    printNextStep({
      command: "npm run prepare:ibus-pr -- --apply",
      note: "Force-adds the gitignored iBus folders, commits, pushes, and opens/updates the PR. Source Control staying empty beforehand is normal.",
      extraLines: [
        "Options:",
        "  --remove-old   Also delete previous local version folder(s)",
        "                 Only use after live TfL predictions use the new baseVersion.",
        "",
        "Tip: this dry-run does not stage anything yet — only --apply does.",
      ],
    });
    return;
  }

  const { prUrl, committed, changedFileCount } = await applyIbusPrPlan(plan, {
    removeOldVersions: removeOld,
  });

  printWorkflowBlock({
    title: "iBus PR ready",
    lines: [
      `  Base version: ${plan.newBaseVersion}`,
      `  Branch:       ${plan.branchName}`,
      `  Pull request: ${prUrl ?? "(created — check gh pr view)"}`,
      `  Files in latest commit: ${changedFileCount}${committed ? "" : " (no new commit — already up to date?)"}`,
      "",
      "  Only public/data/ibus files were staged for this commit.",
      "  Your local Source Control panel will look empty now — that is expected;",
      "  the import was committed into the PR, not left as uncommitted changes.",
      ...(changedFileCount > 300
        ? [
            "",
            "  Note: GitHub's Files changed tab often fails / looks empty when a PR",
            "  has more than ~300 files. Open the Commits tab and inspect the commit",
            "  instead — the data is there.",
          ]
        : []),
      ...(plan.keepBaseVersions.length > 0
        ? [
            "",
            `  Kept live version(s) in the commit: ${plan.keepBaseVersions.join(", ")}`,
          ]
        : []),
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
      "It should report timing-safe / up to date (keep live until API switches).",
    ],
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
