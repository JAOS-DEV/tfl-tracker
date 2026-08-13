import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fetchActiveBaseVersionFromXml } from "@/lib/ibus/baseVersionDiscovery";
import type { IbusPrPlan } from "@/lib/ibus/baseVersionWorkflow";
import { rebuildMultiVersionManifestFromDisk } from "@/lib/ibus/multiVersionManifest";

function runGit(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runGh(args: string[], cwd: string): string {
  return execFileSync("gh", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function pathExists(cwd: string, relativePath: string): boolean {
  return fs.existsSync(path.join(cwd, relativePath));
}

function isTrackedPath(cwd: string, relativePath: string): boolean {
  try {
    runGit(["ls-files", "--error-unmatch", relativePath], cwd);
    return true;
  } catch {
    return false;
  }
}

export function getCurrentBranch(cwd: string = process.cwd()): string {
  return runGit(["branch", "--show-current"], cwd);
}

export function ensureIbusUpdateBranch(
  plan: IbusPrPlan,
  cwd: string = process.cwd(),
): void {
  const current = getCurrentBranch(cwd);
  if (current === plan.branchName) {
    console.log(`  Already on ${plan.branchName}`);
    return;
  }

  const localBranches = runGit(["branch", "--list", plan.branchName], cwd);
  if (localBranches.includes(plan.branchName)) {
    console.log(`  Checking out existing branch ${plan.branchName}`);
    runGit(["checkout", plan.branchName], cwd);
    return;
  }

  // Prefer branching from origin/main so the PR does not inherit an old
  // chore/ibus-base-* history. Fall back to creating from HEAD.
  try {
    console.log(`  Fetching origin/main...`);
    runGit(["fetch", "origin", "main"], cwd);
    console.log(`  Creating ${plan.branchName} from origin/main`);
    runGit(["checkout", "-b", plan.branchName, "origin/main"], cwd);
  } catch {
    console.log(
      `  Creating ${plan.branchName} from current HEAD (origin/main unavailable)`,
    );
    runGit(["checkout", "-b", plan.branchName], cwd);
  }
}

export function removePreviousIbusVersions(
  plan: IbusPrPlan,
  cwd: string = process.cwd(),
): void {
  for (const version of plan.previousBaseVersions) {
    const relativePath = `public/data/ibus/${version}`;
    if (!pathExists(cwd, relativePath) && !isTrackedPath(cwd, relativePath)) {
      console.log(`  Skip remove ${version} (not present)`);
      continue;
    }

    if (isTrackedPath(cwd, relativePath)) {
      console.log(`  Removing tracked folder ${relativePath}`);
      runGit(["rm", "-r", "-f", "--ignore-unmatch", relativePath], cwd);
      continue;
    }

    console.log(`  Removing untracked local folder ${relativePath}`);
    fs.rmSync(path.join(cwd, relativePath), { recursive: true, force: true });
  }
}

export function stageIbusUpdate(
  plan: IbusPrPlan,
  cwd: string = process.cwd(),
): void {
  const manifestPath = "public/data/ibus/current.json";
  const dataPath = `public/data/ibus/${plan.newBaseVersion}`;
  const keepPaths = plan.keepBaseVersions.map(
    (version) => `public/data/ibus/${version}`,
  );

  if (!pathExists(cwd, manifestPath)) {
    throw new Error(`Missing ${manifestPath}`);
  }
  if (!pathExists(cwd, dataPath)) {
    throw new Error(`Missing ${dataPath} — run npm run import:ibus:active first`);
  }
  for (const keepPath of keepPaths) {
    if (!pathExists(cwd, keepPath)) {
      throw new Error(
        `Missing ${keepPath} — live predictions still need this version. Re-import it before opening the PR.`,
      );
    }
  }

  console.log(`  Staging ${manifestPath}`);
  runGit(["add", manifestPath], cwd);

  for (const keepPath of keepPaths) {
    console.log(
      `  Force-adding live-still-used ${keepPath} (must stay in git for timing)`,
    );
    runGit(["add", "-f", keepPath], cwd);
  }

  console.log(
    `  Force-adding ${dataPath} (gitignored folder; -f is intentional)`,
  );
  runGit(["add", "-f", dataPath], cwd);
}

export function commitIbusUpdate(
  plan: IbusPrPlan,
  cwd: string = process.cwd(),
): boolean {
  const staged = runGit(["diff", "--cached", "--name-only"], cwd);
  if (!staged) {
    console.log("  Nothing staged to commit (already committed?)");
    return false;
  }

  console.log(`  Committing: ${plan.commitMessage}`);
  runGit(["commit", "-m", plan.commitMessage], cwd);
  return true;
}

export function pushIbusUpdateBranch(cwd: string = process.cwd()): void {
  console.log("  Pushing branch to origin...");
  runGit(["push", "-u", "origin", "HEAD"], cwd);
}

export function createIbusPullRequest(
  plan: IbusPrPlan,
  cwd: string = process.cwd(),
): string {
  try {
    const existing = runGh(
      ["pr", "view", "--json", "url", "-q", ".url"],
      cwd,
    );
    if (existing) {
      console.log(`  PR already open: ${existing}`);
      return existing;
    }
  } catch {
    // No PR for this branch yet — create one below.
  }

  const bodyPath = path.join(
    os.tmpdir(),
    `ibus-pr-body-${plan.newBaseVersion}.md`,
  );
  fs.writeFileSync(bodyPath, `${plan.prBody}\n`, "utf8");

  try {
    console.log(`  Creating PR: ${plan.prTitle}`);
    const url = runGh(
      [
        "pr",
        "create",
        "--title",
        plan.prTitle,
        "--body-file",
        bodyPath,
      ],
      cwd,
    );
    return url;
  } finally {
    fs.rmSync(bodyPath, { force: true });
  }
}

async function rewriteManifestAfterCleanup(
  plan: IbusPrPlan,
  cwd: string,
): Promise<void> {
  const activeBaseVersionFromXml =
    (await fetchActiveBaseVersionFromXml().catch(() => null)) ??
    plan.newBaseVersion;
  const manifest = await rebuildMultiVersionManifestFromDisk(
    activeBaseVersionFromXml,
  );
  const manifestPath = path.join(cwd, "public", "data", "ibus", "current.json");
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `  Rewrote current.json available versions: ${
      manifest.availableBaseVersions?.join(", ") ?? manifest.baseVersion
    }`,
  );
}

export async function applyIbusPrPlan(
  plan: IbusPrPlan,
  options: { removeOldVersions: boolean } = { removeOldVersions: false },
  cwd: string = process.cwd(),
): Promise<{ prUrl: string | null }> {
  console.log("");
  console.log(" Applying plan...");
  console.log("");

  if (options.removeOldVersions && plan.previousBaseVersions.length > 0) {
    console.log("1. Remove previous base version folder(s)");
    removePreviousIbusVersions(plan, cwd);
    console.log("   Rebuild manifest so deleted versions are not listed");
    await rewriteManifestAfterCleanup(plan, cwd);
  } else {
    console.log(
      "1. Keep previous local version folder(s) (safer while live TfL may still use them)",
    );
    if (plan.previousBaseVersions.length > 0) {
      console.log(
        `   Still present: ${plan.previousBaseVersions.join(", ")}`,
      );
      console.log(
        "   Pass --remove-old only after live predictions use the new baseVersion.",
      );
    }
  }

  console.log("2. Create / switch to update branch");
  ensureIbusUpdateBranch(plan, cwd);

  console.log(
    plan.keepBaseVersions.length > 0
      ? "3. Stage iBus manifest + live-kept + new version folders"
      : "3. Stage iBus manifest + version folder",
  );
  stageIbusUpdate(plan, cwd);

  console.log("4. Commit");
  commitIbusUpdate(plan, cwd);

  console.log("5. Push");
  pushIbusUpdateBranch(cwd);

  console.log("6. Open pull request");
  const prUrl = createIbusPullRequest(plan, cwd);

  return { prUrl };
}
