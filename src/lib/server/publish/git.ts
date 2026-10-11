import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { PublishChange } from "../../../shared/publish";
import { projectRuntime, appendLog, redact, streamLogs } from "./runtime";
import type { ProjectReport } from "../project";
import { PublishError } from "./errors";
const execute = promisify(execFile);
const MAX_BUFFER = 8 * 1024 * 1024;
export const MAX_DIFF_BYTES = 256 * 1024;
export function pathInside(root: string, target: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))
  );
}
export function normalizeGitPath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}
export async function git(
  report: ProjectReport,
  args: string[],
  options: {
    allowFailure?: boolean;
    timeout?: number;
    output?: boolean;
    boundedDiff?: boolean;
  } = {},
) {
  const runtime = projectRuntime(report);
  appendLog(runtime, `$ git ${args.map((arg) => JSON.stringify(arg)).join(" ")}`);
  try {
    const pending = execute("git", ["-C", path.resolve(report.root), ...args], {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: options.boundedDiff ? MAX_DIFF_BYTES : MAX_BUFFER,
      timeout: options.timeout ?? 30_000,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "never",
        GIT_LITERAL_PATHSPECS: "1",
        GIT_OPTIONAL_LOCKS: "0",
      },
    });
    if (options.output) {
      streamLogs(runtime, pending.child.stdout);
      streamLogs(runtime, pending.child.stderr);
    }
    const { stdout, stderr } = await pending;
    if (!options.output && stderr.trim()) appendLog(runtime, stderr);
    return stdout;
  } catch (cause) {
    const error = cause as Error & { stderr?: string; stdout?: string; code?: string };
    if (options.boundedDiff && error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      appendLog(runtime, "差异内容过大，仅显示前 256 KiB。");
      return (error.stdout ?? "").slice(0, MAX_DIFF_BYTES) + "\n[差异已截断]";
    }
    if (options.allowFailure) return "";
    const message = redact((error.stderr || error.stdout || error.message).trim());
    appendLog(runtime, `失败：${message}`);
    throw new PublishError(message);
  }
}
export async function assertRepository(report: ProjectReport) {
  const root = path.resolve(report.root);
  const top = (await git(report, ["rev-parse", "--show-toplevel"])).trim();
  if (!pathInside(root, top) || !pathInside(top, root))
    throw new PublishError("Mizuki 项目目录不是独立的 Git 仓库根目录");
}
function parseStatus(raw: string): PublishChange[] {
  const records = raw.split("\0"),
    changes: PublishChange[] = [];
  for (let index = 0; index < records.length - 1; index++) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const originalPath =
      status.includes("R") || status.includes("C")
        ? normalizeGitPath(records[++index] ?? "")
        : null;
    changes.push({
      status,
      path: normalizeGitPath(record.slice(3)),
      originalPath: originalPath || null,
      staged: status[0] !== " " && status[0] !== "?",
      conflict: status.includes("U") || ["AA", "DD"].includes(status),
    });
  }
  return changes;
}
export async function changesFor(report: ProjectReport) {
  await assertRepository(report);
  return parseStatus(
    await git(report, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
  );
}
export async function ref(report: ProjectReport, args: string[]) {
  return (await git(report, args, { allowFailure: true })).trim() || null;
}
