import { spawn } from "node:child_process";
import type { PublishHistory, PublishCommitDetail } from "../../../shared/publish";
import { projectRuntime, appendLog, redact } from "./runtime";
import { git, assertRepository, ref } from "./git";
import type { ProjectReport } from "../project";
import { PublishError } from "./errors";
const RECENT_HISTORY_LIMIT = 100;
const SEARCH_PAGE_SIZE = 20;
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
  if (!anchor)
    return {
      commits: [],
      total: 0,
      page: 1,
      pageSize: query ? SEARCH_PAGE_SIZE : RECENT_HISTORY_LIMIT,
      head: null,
      query,
    };
  if (query) return searchHistory(report, anchor, page, query);
  const total = Number(
    (
      await git(report, ["rev-list", "--count", `--max-count=${RECENT_HISTORY_LIMIT}`, anchor])
    ).trim(),
  );
  const offset = (page - 1) * RECENT_HISTORY_LIMIT;
  const raw = await git(report, [
    "log",
    anchor,
    "--date-order",
    "-z",
    "--format=%H%x00%an%x00%ae%x00%aI%x00%s%x00%P%x00%D",
    `--skip=${offset}`,
    `--max-count=${Math.max(0, total - offset)}`,
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
    `已读取当前分支最近 ${total} 条提交：显示 ${commits.length} 条。`,
  );
  return { commits, total, page, pageSize: RECENT_HISTORY_LIMIT, head: anchor, query };
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
          if (total >= (page - 1) * SEARCH_PAGE_SIZE && commits.length < SEARCH_PAGE_SIZE)
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
  return { commits, total, page, pageSize: SEARCH_PAGE_SIZE, head: anchor, query };
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
