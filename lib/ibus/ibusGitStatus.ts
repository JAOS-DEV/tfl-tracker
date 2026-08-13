import { execFileSync } from "node:child_process";

/**
 * Returns true when git reports any staged/unstaged/untracked changes under
 * public/data/ibus/. Returns false when git is unavailable or the tree is clean.
 */
export function hasUncommittedIbusChanges(
  cwd: string = process.cwd(),
): boolean {
  try {
    const output = execFileSync(
      "git",
      ["status", "--porcelain", "--", "public/data/ibus"],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return output.trim().length > 0;
  } catch {
    return false;
  }
}
