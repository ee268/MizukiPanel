import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
export interface GitStatus {
  branch: string | null;
  changes: Array<{ status: string; path: string }>;
  ahead: number;
  behind: number;
}
async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}
export async function inspectGit(root: string): Promise<GitStatus> {
  const inside = (await git(root, ["rev-parse", "--show-toplevel"])).trim();
  const resolve = await import("node:path");
  if (resolve.default.resolve(inside).toLowerCase() !== resolve.default.resolve(root).toLowerCase())
    throw new Error("所选目录不是 Git 仓库根目录");
  const branch = (await git(root, ["branch", "--show-current"])).trim() || null;
  const raw = await git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const pieces = raw.split("\0");
  const changes: GitStatus["changes"] = [];
  for (let i = 0; i < pieces.length - 1; i++) {
    const record = pieces[i];
    if (!record) continue;
    const status = record.slice(0, 2);
    let filename = record.slice(3);
    if (status.includes("R") || status.includes("C")) filename += " ← " + pieces[++i];
    changes.push({ status, path: filename });
  }
  let ahead = 0,
    behind = 0;
  try {
    const counts = (await git(root, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]))
      .trim()
      .split(/\s+/);
    ahead = Number(counts[0]) || 0;
    behind = Number(counts[1]) || 0;
  } catch {
    /* No upstream configured. */
  }
  return { branch, changes, ahead, behind };
}
