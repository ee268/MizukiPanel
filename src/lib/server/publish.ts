import { execFile, spawn } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ProjectReport } from "./project";

const execute = promisify(execFile);
const MAX_BUFFER = 8 * 1024 * 1024;
const MAX_DIFF_BYTES = 256 * 1024;
const MAX_LOG_LINES = 500;

export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}

export interface PublishChange {
  status: string;
  path: string;
  originalPath: string | null;
  staged: boolean;
  conflict: boolean;
  managed: boolean;
}

export interface PublishCheck {
  key: string;
  label: string;
  status: "pass" | "warning" | "error";
  detail: string;
}

export interface PublishOverview {
  mode: ProjectReport["mode"];
  repositoryLabel: string;
  repositoryRoot: string;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  head: string | null;
  lastSubject: string | null;
  changes: PublishChange[];
  checks: PublishCheck[];
  canCommit: boolean;
  canPush: boolean;
  canSync: boolean;
  canBuild: boolean;
}

export interface PublishOperationStatus {
  kind: "validate" | "sync" | "build" | null;
  state: "idle" | "running" | "succeeded" | "failed";
  projectRoot: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  error: string | null;
}

interface OperationRuntime extends PublishOperationStatus {
  child: ReturnType<typeof spawn> | null;
}

interface PanelCommit {
  sha: string;
  paths: string[];
}

const runtimeKey = Symbol.for("mizuki-panel.publish-runtime");
const commitsKey = Symbol.for("mizuki-panel.publish-commits");
const syncKey = Symbol.for("mizuki-panel.publish-synced-heads");
const globals = globalThis as typeof globalThis & {
  [runtimeKey]?: OperationRuntime;
  [commitsKey]?: Map<string, PanelCommit>;
  [syncKey]?: Map<string, string>;
};
const runtime = (globals[runtimeKey] ??= {
  kind: null,
  state: "idle",
  projectRoot: null,
  startedAt: null,
  finishedAt: null,
  logs: [],
  error: null,
  child: null,
});
const panelCommits = (globals[commitsKey] ??= new Map<string, PanelCommit>());
const syncedHeads = (globals[syncKey] ??= new Map<string, string>());

function repositoryRoot(report: ProjectReport): string {
  if (report.mode === "blocked") throw new PublishError("项目内容模式尚未就绪");
  if (report.readOnly) throw new PublishError("当前工作区为只读，不能执行发布操作");
  return path.resolve(report.contentRoot ?? report.root);
}

function normalizeGitPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function pathInside(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))
  );
}

async function git(
  root: string,
  args: string[],
  options: { allowFailure?: boolean; timeout?: number } = {},
): Promise<string> {
  try {
    const { stdout } = await execute("git", ["-C", root, ...args], {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: MAX_BUFFER,
      timeout: options.timeout ?? 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_LITERAL_PATHSPECS: "1" },
    });
    return stdout;
  } catch (error) {
    if (options.allowFailure) return "";
    const failure = error as Error & { stderr?: string; stdout?: string };
    throw new PublishError((failure.stderr || failure.stdout || failure.message).trim());
  }
}

async function assertRepository(root: string): Promise<void> {
  const top = (await git(root, ["rev-parse", "--show-toplevel"])).trim();
  if (
    !pathInside(root, top) ||
    !pathInside(top, root) ||
    path.resolve(top).toLowerCase() !== path.resolve(root).toLowerCase()
  ) {
    throw new PublishError("内容目录不是独立的 Git 仓库根目录");
  }
}

function parseStatus(raw: string): Array<Omit<PublishChange, "managed">> {
  const records = raw.split("\0");
  const changes: Array<Omit<PublishChange, "managed">> = [];
  for (let index = 0; index < records.length - 1; index++) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const filePath = normalizeGitPath(record.slice(3));
    const renamed = status.includes("R") || status.includes("C");
    const originalPath = renamed ? normalizeGitPath(records[++index] ?? "") : null;
    changes.push({
      status,
      path: filePath,
      originalPath: originalPath || null,
      staged: status[0] !== " " && status[0] !== "?",
      conflict: status.includes("U") || ["AA", "DD"].includes(status),
    });
  }
  return changes;
}

function managedRoots(report: ProjectReport, root: string): string[] {
  return report.mappings.flatMap((mapping) => {
    if (!pathInside(root, mapping.sourcePath)) return [];
    const relative = normalizeGitPath(path.relative(root, mapping.sourcePath));
    return relative && relative !== "." ? [relative.replace(/\/$/, "")] : [];
  });
}

function isManaged(changePath: string, roots: string[]): boolean {
  const normalized = normalizeGitPath(changePath);
  return roots.some((root) => normalized === root || normalized.startsWith(root + "/"));
}

async function changesFor(
  report: ProjectReport,
): Promise<{ root: string; changes: PublishChange[] }> {
  const root = repositoryRoot(report);
  await assertRepository(root);
  const roots = managedRoots(report, root);
  if (!roots.length) throw new PublishError("未找到可发布的受管理内容目录");
  const raw = await git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const changes = parseStatus(raw).map((change) => ({
    ...change,
    managed:
      isManaged(change.path, roots) &&
      (!change.originalPath || isManaged(change.originalPath, roots)),
  }));
  return { root, changes };
}

async function ref(root: string, args: string[]): Promise<string | null> {
  const value = (await git(root, args, { allowFailure: true })).trim();
  return value || null;
}

export async function publishOverview(report: ProjectReport): Promise<PublishOverview> {
  const { root, changes } = await changesFor(report);
  const branch = await ref(root, ["branch", "--show-current"]);
  const upstream = await ref(root, [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}",
  ]);
  const head = await ref(root, ["rev-parse", "HEAD"]);
  const lastSubject = await ref(root, ["log", "-1", "--format=%s"]);
  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const counts = (await git(root, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]))
      .trim()
      .split(/\s+/);
    ahead = Number(counts[0]) || 0;
    behind = Number(counts[1]) || 0;
  }
  const managed = changes.filter((change) => change.managed);
  const unmanaged = changes.filter((change) => !change.managed);
  const staged = changes.filter((change) => change.staged);
  const conflicts = changes.filter((change) => change.conflict);
  const checks: PublishCheck[] = [
    {
      key: "writable",
      label: "工作区可写",
      status: "pass",
      detail: report.mode === "external" ? "独立内容仓库可写" : "Mizuki 本地内容可写",
    },
    {
      key: "branch",
      label: "Git 分支",
      status: branch ? "pass" : "error",
      detail: branch ? `当前分支：${branch}` : "当前处于游离 HEAD，不能发布",
    },
    {
      key: "conflicts",
      label: "合并冲突",
      status: conflicts.length ? "error" : "pass",
      detail: conflicts.length ? `存在 ${conflicts.length} 个未解决冲突` : "未发现合并冲突",
    },
    {
      key: "staged",
      label: "暂存区",
      status: staged.length ? "error" : "pass",
      detail: staged.length
        ? `已有 ${staged.length} 项暂存内容，请先提交或取消暂存`
        : "没有预先暂存的内容",
    },
    {
      key: "managed",
      label: "可发布内容",
      status: managed.length ? "pass" : "warning",
      detail: managed.length ? `${managed.length} 项受管理内容变更` : "没有待发布的内容变更",
    },
    {
      key: "unmanaged",
      label: "无关文件隔离",
      status: unmanaged.length ? "warning" : "pass",
      detail: unmanaged.length ? `${unmanaged.length} 项无关变更不会被发布` : "没有检测到无关变更",
    },
    {
      key: "upstream",
      label: "远程跟踪",
      status: upstream ? "pass" : "warning",
      detail: upstream ? `上游：${upstream}` : "尚未配置上游分支，可以提交但不能从面板推送",
    },
  ];
  const blocking = !branch || conflicts.length > 0 || staged.length > 0;
  const cleanManaged = managed.length === 0;
  const syncedHead =
    report.mode === "external" && head ? syncedHeads.get(report.root) === head : true;
  return {
    mode: report.mode,
    repositoryLabel: report.mode === "external" ? "独立内容仓库" : "Mizuki 仓库",
    repositoryRoot: root,
    branch,
    upstream,
    ahead,
    behind,
    head,
    lastSubject,
    changes,
    checks,
    canCommit: !blocking && managed.length > 0,
    canPush: Boolean(branch && upstream && ahead > 0 && !conflicts.length),
    canSync: report.mode === "external" && !blocking && cleanManaged,
    canBuild: !blocking && cleanManaged && syncedHead,
  };
}

function findSelected(changes: PublishChange[], selected: string[]): PublishChange[] {
  const wanted = new Set(selected.map(normalizeGitPath));
  if (!wanted.size) throw new PublishError("请至少选择一个待提交文件");
  const found = changes.filter((change) => wanted.has(change.path));
  if (found.length !== wanted.size)
    throw new PublishError("选择中包含已变化或不存在的文件，请刷新后重试");
  if (found.some((change) => !change.managed)) throw new PublishError("只能提交面板管理的内容文件");
  if (found.some((change) => change.conflict))
    throw new PublishError("所选文件包含未解决的 Git 冲突");
  return found;
}

function selectedPaths(changes: PublishChange[]): string[] {
  return [
    ...new Set(
      changes.flatMap((change) => [
        change.path,
        ...(change.originalPath ? [change.originalPath] : []),
      ]),
    ),
  ];
}

export function validateCommitMessage(message: string): string {
  const normalized = message.replaceAll("\r\n", "\n").trim();
  if (!normalized || normalized.length > 5000 || normalized.includes("\0"))
    throw new PublishError("提交说明不能为空且不能超过 5000 个字符");
  const subject = normalized.split("\n", 1)[0];
  if (subject.length > 100) throw new PublishError("提交标题不能超过 100 个字符");
  if (!/^[a-z][a-z0-9-]*(\([a-z0-9][a-z0-9._/-]*\))?!?: .+/.test(subject)) {
    throw new PublishError(
      "提交说明需遵循 Conventional Commits，例如 feat(content): publish blog updates",
    );
  }
  return normalized;
}

export async function publishDiff(report: ProjectReport, selectedPath: string): Promise<string> {
  const { root, changes } = await changesFor(report);
  const [change] = findSelected(changes, [selectedPath]);
  const paths = selectedPaths([change]);
  if (change.status === "??") {
    const absolute = path.resolve(root, change.path);
    if (!pathInside(root, absolute)) throw new PublishError("文件路径越过仓库边界");
    const info = await lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink()) throw new PublishError("只能预览普通文件");
    if (info.size > MAX_DIFF_BYTES)
      return `新文件 ${change.path}（${info.size} 字节），内容过大，未显示差异。`;
    const content = await readFile(absolute);
    if (content.includes(0)) return `新文件 ${change.path} 是二进制文件，未显示文本差异。`;
    const lines = content
      .toString("utf8")
      .split(/\r?\n/)
      .map((line) => `+${line}`)
      .join("\n");
    return `diff --git a/${change.path} b/${change.path}\nnew file mode 100644\n--- /dev/null\n+++ b/${change.path}\n@@ -0,0 +1 @@\n${lines}`;
  }
  const output = await git(root, ["diff", "--no-ext-diff", "--text", "HEAD", "--", ...paths]);
  return output || "所选文件没有可显示的文本差异。";
}

export async function commitSelected(
  report: ProjectReport,
  selected: string[],
  message: string,
): Promise<{ sha: string; subject: string }> {
  const subject = validateCommitMessage(message);
  const { root, changes } = await changesFor(report);
  if (changes.some((change) => change.staged))
    throw new PublishError("暂存区已有内容；为避免混入无关文件，请先处理现有暂存项");
  if (changes.some((change) => change.conflict)) throw new PublishError("仓库存在未解决的合并冲突");
  const paths = selectedPaths(findSelected(changes, selected));
  try {
    await git(root, ["add", "-A", "--", ...paths]);
    const cached = (await git(root, ["diff", "--cached", "--name-only", "-z"]))
      .split("\0")
      .filter(Boolean)
      .map(normalizeGitPath);
    if (!cached.length || cached.some((entry) => !paths.includes(entry))) {
      throw new PublishError("暂存结果与所选文件不一致，已取消提交");
    }
    await git(root, ["commit", "-m", subject], { timeout: 60_000 });
  } catch (error) {
    await git(root, ["restore", "--staged", "--", ...paths], { allowFailure: true });
    throw error;
  }
  const sha = (await git(root, ["rev-parse", "HEAD"])).trim();
  panelCommits.set(root, { sha, paths });
  return { sha, subject: subject.split("\n", 1)[0] };
}

export async function pushCurrentBranch(
  report: ProjectReport,
): Promise<{ head: string; upstream: string }> {
  const overview = await publishOverview(report);
  if (!overview.branch) throw new PublishError("游离 HEAD 不能推送");
  if (!overview.upstream) throw new PublishError("当前分支没有上游；请先在终端明确配置推送目标");
  if (overview.changes.some((change) => change.conflict))
    throw new PublishError("仓库存在未解决的合并冲突");
  await git(overview.repositoryRoot, ["push"], { timeout: 120_000 });
  return {
    head: (await git(overview.repositoryRoot, ["rev-parse", "HEAD"])).trim(),
    upstream: overview.upstream,
  };
}

export async function revertPanelCommit(report: ProjectReport): Promise<{ sha: string }> {
  const root = repositoryRoot(report);
  await assertRepository(root);
  const previous = panelCommits.get(root);
  if (!previous) throw new PublishError("本次面板会话中没有可还原的发布提交");
  const head = (await git(root, ["rev-parse", "HEAD"])).trim();
  if (head !== previous.sha)
    throw new PublishError("仓库 HEAD 已变化，不能自动还原；请人工检查历史");
  const dirty = (await git(root, ["status", "--porcelain=v1", "--", ...previous.paths])).trim();
  if (dirty) throw new PublishError("已提交文件又发生变化，不能自动还原");
  try {
    await git(root, ["revert", "--no-edit", previous.sha], { timeout: 60_000 });
  } catch (error) {
    await git(root, ["revert", "--abort"], { allowFailure: true });
    throw error;
  }
  panelCommits.delete(root);
  return { sha: (await git(root, ["rev-parse", "HEAD"])).trim() };
}

function appendLog(line: string): void {
  const clean = line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  for (const item of clean.split(/\r?\n/).filter(Boolean)) {
    runtime.logs.push(`[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${item}`);
  }
  if (runtime.logs.length > MAX_LOG_LINES)
    runtime.logs.splice(0, runtime.logs.length - MAX_LOG_LINES);
}

function pnpmProcess(cwd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
    const commandArgs =
      process.platform === "win32" ? ["/d", "/s", "/c", "pnpm.cmd", ...args] : args;
    const child = spawn(command, commandArgs, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1", BROWSER: "none", ASTRO_TELEMETRY_DISABLED: "1" },
    });
    runtime.child = child;
    child.stdout?.on("data", (chunk) => appendLog(chunk.toString()));
    child.stderr?.on("data", (chunk) => appendLog(chunk.toString()));
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      runtime.child = null;
      if (code === 0) resolve();
      else
        reject(
          new PublishError(
            `命令 pnpm ${args.join(" ")} 失败（code=${code ?? "-"}, signal=${signal ?? "-"}）`,
          ),
        );
    });
  });
}

async function runOperation(
  report: ProjectReport,
  kind: NonNullable<PublishOperationStatus["kind"]>,
): Promise<void> {
  try {
    if (kind === "validate") {
      if (report.mode === "external") await pnpmProcess(report.root, ["sync-content"]);
      await pnpmProcess(report.root, ["check"]);
      await pnpmProcess(report.root, ["type-check"]);
    } else if (kind === "sync") {
      await pnpmProcess(report.root, ["sync-content"]);
      const contentRoot = repositoryRoot(report);
      syncedHeads.set(report.root, (await git(contentRoot, ["rev-parse", "HEAD"])).trim());
    } else {
      await pnpmProcess(report.root, ["build"]);
    }
    runtime.state = "succeeded";
    appendLog(
      kind === "validate"
        ? "发布校验完成。"
        : kind === "sync"
          ? "独立内容同步完成。"
          : "Mizuki 构建完成。",
    );
  } catch (error) {
    runtime.state = "failed";
    runtime.error = error instanceof Error ? error.message : "操作失败";
    appendLog(`失败：${runtime.error}`);
  } finally {
    runtime.finishedAt = new Date().toISOString();
    runtime.child = null;
  }
}

export async function startPublishOperation(
  report: ProjectReport,
  kind: NonNullable<PublishOperationStatus["kind"]>,
): Promise<PublishOperationStatus> {
  if (runtime.state === "running") throw new PublishError("已有发布操作正在运行");
  if (!["validate", "sync", "build"].includes(kind)) throw new PublishError("不支持的发布操作");
  const overview = await publishOverview(report);
  if (kind === "sync") {
    if (report.mode !== "external") throw new PublishError("本地内容模式不需要同步");
    if (!overview.canSync)
      throw new PublishError("请先提交所有受管理内容并解决 Git 状态问题，再执行同步");
  }
  if (kind === "build" && !overview.canBuild) {
    throw new PublishError(
      report.mode === "external"
        ? "请先提交内容并完成当前版本的独立仓库同步"
        : "请先提交受管理内容并解决 Git 状态问题",
    );
  }
  runtime.kind = kind;
  runtime.state = "running";
  runtime.projectRoot = report.root;
  runtime.startedAt = new Date().toISOString();
  runtime.finishedAt = null;
  runtime.logs = [];
  runtime.error = null;
  appendLog(
    kind === "validate"
      ? "开始运行 Astro 检查和 TypeScript 类型检查…"
      : kind === "sync"
        ? "开始安全同步独立内容仓库…"
        : "开始构建 Mizuki…",
  );
  void runOperation(report, kind);
  return publishOperationStatus(report);
}

export function publishOperationStatus(report: ProjectReport): PublishOperationStatus {
  if (runtime.projectRoot && path.resolve(runtime.projectRoot) !== path.resolve(report.root)) {
    return {
      kind: null,
      state: "idle",
      projectRoot: report.root,
      startedAt: null,
      finishedAt: null,
      logs: [],
      error: null,
    };
  }
  return {
    kind: runtime.kind,
    state: runtime.state,
    projectRoot: runtime.projectRoot,
    startedAt: runtime.startedAt,
    finishedAt: runtime.finishedAt,
    logs: [...runtime.logs],
    error: runtime.error,
  };
}
