import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readLogRetention } from "../task-preferences";
import {
  appendLog,
  projectRuntime,
  begin,
  finish,
  streamLogs,
  requireWritable,
  publishOperationStatus,
  type Runtime,
} from "./runtime";
import type { ProjectReport } from "../project";
import { PublishError } from "./errors";
export async function buildAvailability(report: ProjectReport) {
  if (report.readOnly) return "当前工作区为只读";
  try {
    const pkg = JSON.parse(await readFile(path.join(report.root, "package.json"), "utf8"));
    return typeof pkg.scripts?.build === "string" && pkg.scripts.build.trim()
      ? null
      : "Mizuki 项目未配置 build 脚本";
  } catch {
    return "无法读取 Mizuki 项目的 package.json";
  }
}
async function runBuild(report: ProjectReport, runtime: Runtime) {
  try {
    await new Promise<void>((resolve, reject) => {
      appendLog(runtime, `$ pnpm run build · ${path.resolve(report.root)}`);
      const windows = process.platform === "win32";
      const child = spawn(
        windows ? (process.env.ComSpec ?? "cmd.exe") : "pnpm",
        windows ? ["/d", "/s", "/c", "pnpm.cmd", "run", "build"] : ["run", "build"],
        {
          cwd: report.root,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, CI: "1", BROWSER: "none", ASTRO_TELEMETRY_DISABLED: "1" },
        },
      );
      streamLogs(runtime, child.stdout);
      streamLogs(runtime, child.stderr);
      child.once("error", reject);
      child.once("close", (code, signal) =>
        code === 0
          ? resolve()
          : reject(new PublishError(`构建失败（退出码 ${code ?? "-"}，信号 ${signal ?? "-"}）`)),
      );
    });
    finish(runtime);
  } catch (cause) {
    finish(runtime, cause);
  }
}
export async function startPublishOperation(
  report: ProjectReport,
  kind: "build",
  stateDir?: string,
) {
  if (kind !== "build") throw new PublishError("仅支持 Mizuki 构建操作");
  requireWritable(report);
  const reason = await buildAvailability(report);
  if (reason) {
    appendLog(projectRuntime(report), `构建未启动：${reason}`);
    throw new PublishError(reason);
  }
  await readLogRetention(stateDir);
  const runtime = begin(report, "build", stateDir);
  void runBuild(report, runtime);
  return publishOperationStatus(report);
}
