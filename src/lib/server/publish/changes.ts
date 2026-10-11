import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import type { PublishChange } from "../../../shared/publish";
import { readLogRetention } from "../task-preferences";
import { projectRuntime, appendLog, begin, finish } from "./runtime";
import { git, changesFor, ref, pathInside, normalizeGitPath, MAX_DIFF_BYTES } from "./git";
import type { ProjectReport } from "../project";
import { PublishError } from "./errors";
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
export async function commitSelected(
  report: ProjectReport,
  selected: string[],
  message: string,
  stateDir?: string,
) {
  await readLogRetention(stateDir);
  const runtime = begin(report, "commit", stateDir);
  let paths: string[] = [],
    stageAll = false,
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
    const chosen = findSelected(report, changes, selected);
    paths = selectedPaths(chosen);
    stageAll = chosen.length === changes.length;
    added = true;
    await git(report, stageAll ? ["add", "."] : ["add", "-A", "--", ...paths]);
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
          ? ["restore", "--staged", "--", ...(stageAll ? ["."] : paths)]
          : ["rm", "--cached", "-r", "--ignore-unmatch", "--", ...(stageAll ? ["."] : paths)],
        { allowFailure: true },
      );
    finish(runtime, cause);
    throw cause;
  }
}
