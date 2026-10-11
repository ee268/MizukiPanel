import path from "node:path";
import type { Readable } from "node:stream";
import type { PublishOperationStatus } from "../../../shared/publish";
import { logLimit, readLogRetention } from "../task-preferences";
import type { ProjectReport } from "../project";
import { PublishError } from "./errors";
export interface Runtime extends PublishOperationStatus {
  stateDir?: string;
}
const runtimeKey = Symbol.for("mizuki-panel.git-management-runtime");
const globals = globalThis as typeof globalThis & {
  [runtimeKey]?: { projects: Map<string, Runtime>; active: Runtime | null };
};
const store = (globals[runtimeKey] ??= { projects: new Map(), active: null });
export function projectRuntime(report: ProjectReport): Runtime {
  const root = path.resolve(report.root);
  let runtime = store.projects.get(root);
  if (!runtime) {
    runtime = {
      kind: null,
      state: "idle",
      projectRoot: root,
      startedAt: null,
      finishedAt: null,
      logs: [],
      error: null,
    };
    store.projects.set(root, runtime);
  }
  return runtime;
}
export async function preparePublishLogs(report: ProjectReport, stateDir?: string) {
  await readLogRetention(stateDir);
  projectRuntime(report).stateDir = stateDir;
}
export function redact(value: string) {
  return value.replace(/(https?:\/\/)[^\s/@]+@/gi, "$1***@");
}
export function appendLog(runtime: Runtime, text: string) {
  const clean = redact(text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""));
  for (const line of clean.split(/\r?\n/).filter(Boolean))
    runtime.logs.push(`[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${line}`);
  const limit = logLimit("publish", runtime.stateDir);
  if (runtime.logs.length > limit) runtime.logs.splice(0, runtime.logs.length - limit);
}
export function workspacePublishTask() {
  return store.active?.state === "running" && store.active.projectRoot
    ? { kind: "publish" as const, projectRoot: store.active.projectRoot, canStop: false }
    : null;
}
export function requireWritable(report: ProjectReport) {
  if (report.readOnly) {
    appendLog(projectRuntime(report), "操作被拒绝：当前工作区为只读，不能提交或构建。");
    throw new PublishError("当前工作区为只读，不能执行 Git 写操作或构建");
  }
}
export function streamLogs(runtime: Runtime, stream: Readable | null) {
  let pending = "";
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk: string) => {
    const lines = (pending + chunk).split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) appendLog(runtime, line);
    if (pending.length > 8192) {
      appendLog(runtime, pending);
      pending = "";
    }
  });
  stream?.on("end", () => {
    if (pending) appendLog(runtime, pending);
  });
}
export function begin(report: ProjectReport, kind: "commit" | "push" | "build", stateDir?: string) {
  if (store.active) throw new PublishError("已有 Git 或构建任务正在运行，请等待完成");
  requireWritable(report);
  const runtime = projectRuntime(report);
  runtime.stateDir = stateDir;
  runtime.kind = kind;
  runtime.state = "running";
  runtime.startedAt = new Date().toISOString();
  runtime.finishedAt = null;
  runtime.error = null;
  store.active = runtime;
  appendLog(
    runtime,
    kind === "build"
      ? "开始构建 Mizuki…"
      : kind === "push"
        ? "开始推送当前分支…"
        : "开始提交所选文件…",
  );
  return runtime;
}
export function finish(runtime: Runtime, cause?: unknown) {
  runtime.state = cause ? "failed" : "succeeded";
  runtime.error = cause ? (cause as Error).message : null;
  runtime.finishedAt = new Date().toISOString();
  appendLog(runtime, cause ? `任务失败：${runtime.error}` : "任务执行成功。");
  if (store.active === runtime) store.active = null;
}
export function publishOperationStatus(report: ProjectReport): PublishOperationStatus {
  const runtime = projectRuntime(report);
  return {
    kind: runtime.kind,
    state: runtime.state,
    projectRoot: runtime.projectRoot,
    startedAt: runtime.startedAt,
    finishedAt: runtime.finishedAt,
    logs: [...runtime.logs],
    error: runtime.error,
    logLimit: logLimit("publish", runtime.stateDir),
  };
}
