import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { createConnection } from "node:net";
import type { ProjectReport } from "./project";
import { logLimit, readLogRetention, taskPreferences } from "./task-preferences";

const run = promisify(execFile);
const ANSI = /\x1b\[[0-?]*[ -\/]*[@-~]/g;

interface PreviewRuntime {
  child: ChildProcess | null;
  projectRoot: string | null;
  port: number;
  startedAt: string | null;
  logs: string[];
  error: string | null;
  stoppingChild: ChildProcess | null;
  stateDir?: string;
}

const runtimeKey = Symbol.for("mizuki-panel.preview-runtime");
const globals = globalThis as typeof globalThis & { [runtimeKey]?: PreviewRuntime };
const runtime = (globals[runtimeKey] ??= {
  child: null,
  projectRoot: null,
  port: 4321,
  startedAt: null,
  logs: [],
  error: null,
  stoppingChild: null,
});

function append(chunk: Buffer | string) {
  const lines = chunk.toString().replace(ANSI, "").split(/\r?\n/).filter(Boolean);
  runtime.logs.push(
    ...lines.map(
      (line) => `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${line}`,
    ),
  );
  const limit = logLimit("preview", runtime.stateDir);
  if (runtime.logs.length > limit) runtime.logs.splice(0, runtime.logs.length - limit);
}

async function occupied(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1200);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(true));
  });
}

async function responds(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(1200),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

export function previewExitError(code: number | null, expectedStop: boolean): string | null {
  if (expectedStop || !code) return null;
  return "Astro 预览异常退出，退出码 " + code;
}

export interface PreviewStatus {
  state: "stopped" | "starting" | "running" | "external" | "failed";
  url: string;
  projectRoot: string | null;
  startedAt: string | null;
  logs: string[];
  error: string | null;
  port: number;
  configuredPort: number;
  defaultPath: string;
  pendingPort: boolean;
  logLimit: number;
  warnings: string[];
}

export function workspacePreviewTask() {
  return runtime.child && runtime.child.exitCode === null && !runtime.child.killed
    ? { kind: "preview" as const, projectRoot: runtime.projectRoot!, canStop: true }
    : null;
}

export async function previewStatus(
  report: ProjectReport,
  stateDir?: string,
): Promise<PreviewStatus> {
  const [preferences, machine] = await Promise.all([
    taskPreferences(report, stateDir),
    readLogRetention(stateDir),
  ]);
  const running = runtime.child && runtime.child.exitCode === null && !runtime.child.killed;
  const port = running ? runtime.port : preferences.preview.port;
  const reachable = await responds(port);
  const sameProject =
    runtime.projectRoot && path.resolve(runtime.projectRoot) === path.resolve(report.root);
  const error = sameProject && port === runtime.port ? runtime.error : null;
  let state: PreviewStatus["state"] = "stopped";
  if (running && reachable) state = "running";
  else if (running) state = "starting";
  else if (reachable) state = "external";
  else if (error) state = "failed";
  else if (!running && (await occupied(port))) state = "failed";
  const showOwned = sameProject && port === runtime.port && state !== "external";
  return {
    state,
    url: `http://127.0.0.1:${port}/`,
    projectRoot: running || showOwned ? runtime.projectRoot : null,
    startedAt: showOwned ? runtime.startedAt : null,
    logs: showOwned ? [...runtime.logs] : [],
    error:
      state === "external"
        ? "端口上已有外部 HTTP 服务，无法确认属于当前项目；面板不能停止该进程。"
        : (error ??
          (state === "failed"
            ? `端口 ${port} 已被占用，未启动或停止任何外部进程。请调整端口。`
            : null)),
    port,
    configuredPort: preferences.preview.port,
    defaultPath: preferences.preview.path,
    pendingPort: Boolean(running && port !== preferences.preview.port),
    logLimit: logLimit("preview", stateDir),
    warnings: [...preferences.snapshot.warnings, ...machine.warnings],
  };
}

export async function startPreview(
  report: ProjectReport,
  stateDir?: string,
): Promise<PreviewStatus> {
  if (report.mode === "blocked") throw new Error("项目内容模式尚未就绪");
  if (runtime.child && runtime.child.exitCode === null && !runtime.child.killed) {
    if (path.resolve(runtime.projectRoot ?? "") !== path.resolve(report.root))
      throw new Error("另一个 Mizuki 工作区的预览正在运行，请先停止");
    return previewStatus(report, stateDir);
  }
  const preferences = await taskPreferences(report, stateDir);
  await readLogRetention(stateDir);
  const port = preferences.preview.port;
  if (await responds(port)) return previewStatus(report, stateDir);
  if (await occupied(port))
    throw new Error(`端口 ${port} 已被占用，请调整预览端口；未停止外部进程。`);
  runtime.stateDir = stateDir;
  runtime.port = port;
  runtime.logs = [];
  runtime.error = null;
  runtime.projectRoot = report.root;
  runtime.startedAt = new Date().toISOString();
  const astroCli = path.join(report.root, "node_modules", "astro", "bin", "astro.mjs");
  const child = spawn(
    process.execPath,
    [astroCli, "dev", "--host", "127.0.0.1", "--port", String(runtime.port), "--strictPort"],
    {
      cwd: report.root,
      env: {
        ...process.env,
        BROWSER: "none",
        ASTRO_TELEMETRY_DISABLED: "1",
        ASTRO_DEV_BACKGROUND: "0",
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  runtime.child = child;
  append("正在启动 Mizuki Astro 开发服务器…");
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.on("error", (error) => {
    runtime.error = error.message;
    append(`启动失败：${error.message}`);
  });
  child.on("exit", (code, signal) => {
    const expectedStop = runtime.stoppingChild === child;
    if (!expectedStop)
      append("预览进程已退出（code=" + (code ?? "-") + ", signal=" + (signal ?? "-") + "）");
    const exitError = previewExitError(code, expectedStop);
    if (expectedStop) runtime.error = null;
    else if (exitError) runtime.error = exitError;
    if (runtime.child === child) runtime.child = null;
    if (expectedStop) runtime.stoppingChild = null;
  });
  return previewStatus(report, stateDir);
}

export async function stopPreview(
  report: ProjectReport,
  stateDir: string | undefined = runtime.stateDir,
): Promise<PreviewStatus> {
  const child = runtime.child;
  if (!child || child.exitCode !== null || child.killed) return previewStatus(report, stateDir);
  if (path.resolve(runtime.projectRoot ?? "") !== path.resolve(report.root))
    throw new Error("当前预览不属于所选 Mizuki 工作区");
  runtime.stoppingChild = child;
  runtime.error = null;
  const pid = child.pid;
  if (pid) {
    if (process.platform === "win32")
      await run("taskkill", ["/pid", String(pid), "/t", "/f"], { windowsHide: true }).catch(() =>
        child.kill(),
      );
    else child.kill("SIGTERM");
  }
  if (runtime.child === child) runtime.child = null;
  append("已停止由面板启动的预览进程。");
  return previewStatus(report, stateDir);
}
