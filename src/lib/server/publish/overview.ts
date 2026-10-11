import path from "node:path";
import type { PublishOverview, PublishRemote } from "../../../shared/publish";
import { projectRuntime, appendLog, redact } from "./runtime";
import { buildAvailability } from "./build";
import { git, changesFor, ref } from "./git";
import type { ProjectReport } from "../project";
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
