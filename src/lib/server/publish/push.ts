import { readLogRetention } from "../task-preferences";
import { appendLog, begin, finish } from "./runtime";
import { git, ref } from "./git";
import { publishOverview } from "./overview";
import type { ProjectReport } from "../project";
import { PublishError } from "./errors";
import { assertNoOutgoingApiKeys } from "./credentials";
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
    appendLog(runtime, "正在检查待推送历史中的敏感数据…");
    await assertNoOutgoingApiKeys(report, overview.head!, remote);
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
