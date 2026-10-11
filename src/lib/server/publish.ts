import { execFile, spawn } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { Readable } from "node:stream";
import type { ProjectReport } from "./project";
import { logLimit, readLogRetention } from "./task-preferences";
import type {
  PublishChange,
  PublishCommitDetail,
  PublishHistory,
  PublishOperationStatus,
  PublishOverview,
  PublishRemote,
} from "../../shared/publish";
export type { PublishChange, PublishOperationStatus, PublishOverview } from "../../shared/publish";

const execute = promisify(execFile);
const MAX_BUFFER = 8 * 1024 * 1024;
const MAX_DIFF_BYTES = 256 * 1024;
export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}
interface Runtime extends PublishOperationStatus {
  stateDir?: string;
}
const runtimeKey = Symbol.for("mizuki-panel.git-management-runtime");
const globals = globalThis as typeof globalThis & {
  [runtimeKey]?: { projects: Map<string, Runtime>; active: Runtime | null };
};
const store = (globals[runtimeKey] ??= { projects: new Map(), active: null });
function projectRuntime(report: ProjectReport): Runtime {
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
function redact(value: string) {
  return value.replace(/(https?:\/\/)[^\s/@]+@/gi, "$1***@");
}
function appendLog(runtime: Runtime, text: string) {
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
function pathInside(root: string, target: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))
  );
}
function normalizeGitPath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}
function requireWritable(report: ProjectReport) {
  if (report.readOnly) {
    appendLog(projectRuntime(report), "操作被拒绝：当前工作区为只读，不能提交或构建。");
    throw new PublishError("当前工作区为只读，不能执行 Git 写操作或构建");
  }
}
function streamLogs(runtime: Runtime, stream: Readable | null) {
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
async function git(
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
async function assertRepository(report: ProjectReport) {
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
async function changesFor(report: ProjectReport) {
  await assertRepository(report);
  return parseStatus(
    await git(report, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
  );
}
async function ref(report: ProjectReport, args: string[]) {
  return (await git(report, args, { allowFailure: true })).trim() || null;
}
async function buildAvailability(report: ProjectReport) {
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
export async function publishOverview(report: ProjectReport): Promise<PublishOverview> {
  const runtime = projectRuntime(report);
  appendLog(runtime, `正在读取 Mizuki 仓库：${path.resolve(report.root)}`);
  const buildDisabledReason = await buildAvailability(report);
  const base = {
    repositoryRoot: path.resolve(report.root),
    canBuild: !buildDisabledReason,
    buildDisabledReason,
  };
  try {
    const changes = await changesFor(report);
    const branch = await ref(report, ["branch", "--show-current"]);
    const head = await ref(report, ["rev-parse", "--verify", "HEAD"]);
    const upstream = await ref(report, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}",
    ]);
    let ahead = 0,
      behind = 0;
    if (head && upstream) {
      const counts = (
        await git(report, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
      )
        .trim()
        .split(/\s+/);
      ahead = Number(counts[0]) || 0;
      behind = Number(counts[1]) || 0;
    }
    const remotes: PublishRemote[] = [];
    for (const name of (await git(report, ["remote"])).split(/\r?\n/).filter(Boolean)) {
      remotes.push({
        name,
        fetchUrls: (await git(report, ["remote", "get-url", "--all", name]))
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
          .map(redact),
        pushUrls: (await git(report, ["remote", "get-url", "--push", "--all", name]))
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
          .map(redact),
      });
    }
    const commitDisabledReason = report.readOnly
      ? "当前工作区为只读"
      : !branch
        ? "当前处于游离 HEAD"
        : changes.some((c) => c.conflict)
          ? "请先解决 Git 合并冲突"
          : changes.some((c) => c.staged)
            ? "暂存区已有内容，请先在终端处理暂存项"
            : !changes.length
              ? "没有待提交的修改"
              : null;
    const pushRemote =
      branch && upstream ? await ref(report, ["config", "--get", `branch.${branch}.remote`]) : null;
    const pushDisabledReason = report.readOnly
      ? "当前工作区为只读"
      : !branch
        ? "当前处于游离 HEAD"
        : !head
          ? "当前分支尚无提交"
          : !upstream
            ? "当前分支未配置上游，请先在终端设置推送目标"
            : !pushRemote ||
                pushRemote === "." ||
                !remotes.some((remote) => remote.name === pushRemote)
              ? "上游未指向可用的远程仓库"
              : changes.some((c) => c.conflict)
                ? "请先解决 Git 合并冲突"
                : null;
    appendLog(
      runtime,
      `读取完成：分支 ${branch ?? "游离 HEAD"}，${changes.length} 项修改，${remotes.length} 个远程仓库。`,
    );
    return {
      ...base,
      repositoryAvailable: true,
      repositoryError: null,
      branch,
      upstream,
      head,
      ahead,
      behind,
      changes,
      remotes,
      canCommit: !commitDisabledReason,
      commitDisabledReason,
      canPush: !pushDisabledReason,
      pushDisabledReason,
      pushRemote,
    };
  } catch (cause) {
    const message = (cause as Error).message;
    appendLog(runtime, `仓库读取失败：${message}`);
    return {
      ...base,
      repositoryAvailable: false,
      repositoryError: message,
      branch: null,
      upstream: null,
      head: null,
      ahead: 0,
      behind: 0,
      changes: [],
      remotes: [],
      canCommit: false,
      commitDisabledReason: message,
      canPush: false,
      pushDisabledReason: message,
      pushRemote: null,
    };
  }
}
function validateSha(sha: string) {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(sha)) throw new PublishError("提交标识无效");
  return sha;
}
export async function publishHistory(
  report: ProjectReport,
  page = 1,
  head?: string,
  query = "",
): Promise<PublishHistory> {
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new PublishError("历史页码无效");
  query = query.trim();
  if (query.length > 200 || /[\x00-\x1f\x7f]/.test(query))
    throw new PublishError("查询内容不能超过 200 个字符或包含控制字符");
  await assertRepository(report);
  const anchor = head ? validateSha(head) : await ref(report, ["rev-parse", "--verify", "HEAD"]);
  if (!anchor) return { commits: [], total: 0, page: 1, pageSize: 20, head: null, query };
  if (query) return searchHistory(report, anchor, page, query);
  const total = Number((await git(report, ["rev-list", "--count", anchor])).trim());
  const raw = await git(report, [
    "log",
    anchor,
    "--date-order",
    "-z",
    "--format=%H%x00%an%x00%ae%x00%aI%x00%s%x00%P%x00%D",
    `--skip=${(page - 1) * 20}`,
    "-20",
  ]);
  const fields = raw.split("\0"),
    commits: PublishHistory["commits"] = [];
  for (let index = 0; index + 6 < fields.length; index += 7) {
    const [sha, author, email, date, subject, parents, refs] = fields.slice(index, index + 7);
    commits.push({
      sha,
      author,
      email,
      date,
      subject,
      parents: parents.split(" ").filter(Boolean),
      refs,
    });
  }
  appendLog(
    projectRuntime(report),
    `已读取提交历史第 ${page} 页：${commits.length} / ${total} 条。`,
  );
  return { commits, total, page, pageSize: 20, head: anchor, query };
}
async function searchHistory(
  report: ProjectReport,
  anchor: string,
  page: number,
  query: string,
): Promise<PublishHistory> {
  const runtime = projectRuntime(report);
  appendLog(runtime, `查询当前分支全部提交历史：${query}`);
  const needle = query.toLocaleLowerCase(),
    commits: PublishHistory["commits"] = [];
  let total = 0;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "git",
      [
        "-C",
        report.root,
        "log",
        anchor,
        "--date-order",
        "-z",
        "--format=%H%x00%an%x00%ae%x00%aI%x00%s%x00%P%x00%D%x00%B",
      ],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
      },
    );
    const timer = setTimeout(() => {
      child.kill();
      reject(new PublishError("历史查询超时，请缩小查询范围或稍后重试"));
    }, 30000);
    let pending = "",
      fields: string[] = [],
      stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const parts = (pending + chunk).split("\0");
      pending = parts.pop() ?? "";
      for (const part of parts) {
        fields.push(part);
        if (fields.length !== 8) continue;
        const [sha, author, email, date, subject, parents, refs, message] = fields;
        if (
          [sha, author, email, message].some((value) => value.toLocaleLowerCase().includes(needle))
        ) {
          if (total >= (page - 1) * 20 && commits.length < 20)
            commits.push({
              sha,
              author,
              email,
              date,
              subject,
              parents: parents.split(" ").filter(Boolean),
              refs,
            });
          total++;
        }
        fields = [];
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8192);
    });
    child.once("error", (cause) => {
      clearTimeout(timer);
      reject(new PublishError(cause.message));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve()
        : reject(
            new PublishError(redact(stderr.trim() || `历史查询失败（退出码 ${code ?? "-"}）`)),
          );
    });
  }).catch((cause) => {
    appendLog(runtime, `查询失败：${(cause as Error).message}`);
    throw cause;
  });
  appendLog(
    runtime,
    `查询完成：找到 ${total} 条匹配记录，第 ${page} 页显示 ${commits.length} 条。`,
  );
  return { commits, total, page, pageSize: 20, head: anchor, query };
}
export async function publishCommitDetail(
  report: ProjectReport,
  sha: string,
): Promise<PublishCommitDetail> {
  validateSha(sha);
  await assertRepository(report);
  const message = (await git(report, ["show", "--no-patch", "--format=%B", sha])).trim();
  const diff = await git(
    report,
    ["show", "--format=", "--stat", "--patch", "--no-ext-diff", "--no-textconv", sha],
    { boundedDiff: true },
  );
  appendLog(projectRuntime(report), `已读取提交 ${sha.slice(0, 12)} 的说明与差异。`);
  return { sha, message, diff, truncated: diff.endsWith("[差异已截断]") };
}
function findSelected(report: ProjectReport, changes: PublishChange[], selected: string[]) {
  if (
    !selected.length ||
    selected.length > 500 ||
    selected.some(
      (p) =>
        typeof p !== "string" ||
        !p ||
        p.includes("\0") ||
        !pathInside(report.root, path.resolve(report.root, p)),
    )
  )
    throw new PublishError("请选择项目内的待提交文件（最多 500 项）");
  const wanted = new Set(selected.map(normalizeGitPath));
  const found = changes.filter((c) => wanted.has(c.path));
  if (found.length !== wanted.size)
    throw new PublishError("所选文件已经变化或不存在，请刷新后重试");
  if (found.some((c) => c.conflict)) throw new PublishError("所选文件包含未解决的 Git 冲突");
  return found;
}
function selectedPaths(changes: PublishChange[]) {
  return [
    ...new Set(changes.flatMap((c) => [c.path, ...(c.originalPath ? [c.originalPath] : [])])),
  ];
}
export function validateCommitMessage(message: string) {
  const normalized = message.replaceAll("\r\n", "\n").trim();
  if (!normalized || normalized.length > 5000 || normalized.includes("\0"))
    throw new PublishError("提交说明不能为空且不能超过 5000 个字符");
  const subject = normalized.split("\n", 1)[0];
  if (subject.length > 100) throw new PublishError("提交标题不能超过 100 个字符");
  if (!/^[a-z][a-z0-9-]*(\([a-z0-9][a-z0-9._/-]*\))?!?: .+/.test(subject))
    throw new PublishError("提交说明需遵循 Conventional Commits，例如 feat(content): update posts");
  return normalized;
}
export async function publishDiff(report: ProjectReport, selectedPath: string) {
  const changes = await changesFor(report);
  const [change] = findSelected(report, changes, [selectedPath]);
  if (change.status === "??") {
    const absolute = path.resolve(report.root, change.path),
      info = await lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink()) throw new PublishError("只能预览普通文件");
    if (info.size > MAX_DIFF_BYTES) return `新文件 ${change.path}（${info.size} 字节），内容过大。`;
    const content = await readFile(absolute);
    if (content.includes(0)) return `新文件 ${change.path} 是二进制文件。`;
    appendLog(projectRuntime(report), `已读取新文件差异：${change.path}`);
    return `+++ ${change.path}\n${content
      .toString("utf8")
      .split(/\r?\n/)
      .map((line) => `+${line}`)
      .join("\n")}`;
  }
  const head = await ref(report, ["rev-parse", "--verify", "HEAD"]);
  const diff = await git(
    report,
    [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      ...(head ? [head] : ["--cached"]),
      "--",
      ...selectedPaths([change]),
    ],
    { boundedDiff: true },
  );
  appendLog(projectRuntime(report), `已读取工作区差异：${change.path}`);
  return diff;
}
function begin(report: ProjectReport, kind: "commit" | "push" | "build", stateDir?: string) {
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
export async function pushCurrentBranch(
  report: ProjectReport,
  stateDir?: string,
  expected?: { head: string; branch: string; upstream: string; pushUrls?: string[] },
) {
  await readLogRetention(stateDir);
  const runtime = begin(report, "push", stateDir);
  try {
    const overview = await publishOverview(report);
    if (!overview.canPush)
      throw new PublishError(overview.pushDisabledReason ?? "当前分支不能推送");
    if (
      expected &&
      (expected.head !== overview.head ||
        expected.branch !== overview.branch ||
        expected.upstream !== overview.upstream)
    )
      throw new PublishError("分支、提交或上游已变化，请刷新仓库后重新确认推送");
    if (
      expected?.pushUrls &&
      JSON.stringify(expected.pushUrls) !==
        JSON.stringify(
          overview.remotes.find((remote) => remote.name === overview.pushRemote)?.pushUrls ?? [],
        )
    )
      throw new PublishError("远程推送地址已变化，请刷新仓库后重新确认推送");
    const remote = await ref(report, ["config", "--get", `branch.${overview.branch}.remote`]);
    const merge = await ref(report, ["config", "--get", `branch.${overview.branch}.merge`]);
    if (!remote || remote === "." || remote.startsWith("-") || !merge?.startsWith("refs/heads/"))
      throw new PublishError("当前分支没有有效的远程上游目标");
    await git(report, ["check-ref-format", merge]);
    appendLog(runtime, `推送目标：${overview.branch} → ${overview.upstream}`);
    await git(report, ["push", "--porcelain", remote, `${overview.head}:${merge}`], {
      timeout: 120000,
      output: true,
    });
    finish(runtime);
    return { head: overview.head, upstream: overview.upstream };
  } catch (cause) {
    finish(runtime, cause);
    throw cause;
  }
}
function finish(runtime: Runtime, cause?: unknown) {
  runtime.state = cause ? "failed" : "succeeded";
  runtime.error = cause ? (cause as Error).message : null;
  runtime.finishedAt = new Date().toISOString();
  appendLog(runtime, cause ? `任务失败：${runtime.error}` : "任务执行成功。");
  if (store.active === runtime) store.active = null;
}
export async function commitSelected(
  report: ProjectReport,
  selected: string[],
  message: string,
  stateDir?: string,
) {
  await readLogRetention(stateDir);
  const runtime = begin(report, "commit", stateDir);
  let paths: string[] = [],
    added = false,
    hadHead = false;
  try {
    const subject = validateCommitMessage(message);
    const changes = await changesFor(report);
    if (changes.some((c) => c.staged)) throw new PublishError("暂存区已有内容；请先处理现有暂存项");
    if (changes.some((c) => c.conflict)) throw new PublishError("仓库存在未解决的合并冲突");
    if (!(await ref(report, ["branch", "--show-current"])))
      throw new PublishError("游离 HEAD 不能创建提交");
    hadHead = Boolean(await ref(report, ["rev-parse", "--verify", "HEAD"]));
    paths = selectedPaths(findSelected(report, changes, selected));
    added = true;
    await git(report, ["add", "-A", "--", ...paths]);
    const cached = (await git(report, ["diff", "--cached", "--name-only", "-z"]))
      .split("\0")
      .filter(Boolean)
      .map(normalizeGitPath);
    if (!cached.length || cached.some((entry) => !paths.includes(entry)))
      throw new PublishError("暂存结果与所选文件不一致，已取消提交");
    await git(report, ["commit", "-m", subject], { timeout: 60_000, output: true });
    added = false;
    const sha = (await git(report, ["rev-parse", "HEAD"])).trim();
    finish(runtime);
    return { sha, subject: subject.split("\n", 1)[0] };
  } catch (cause) {
    if (added)
      await git(
        report,
        hadHead
          ? ["restore", "--staged", "--", ...paths]
          : ["rm", "--cached", "-r", "--ignore-unmatch", "--", ...paths],
        { allowFailure: true },
      );
    finish(runtime, cause);
    throw cause;
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
