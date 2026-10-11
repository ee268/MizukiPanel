import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import type { ProjectReport } from "../src/lib/server/project";
import {
  commitSelected,
  publishCommitDetail,
  publishDiff,
  publishHistory,
  publishOperationStatus,
  publishOverview,
  pushCurrentBranch,
  startPublishOperation,
  validateCommitMessage,
  workspacePublishTask,
} from "../src/lib/server/publish";

const directories: string[] = [];
function git(root: string, ...args: string[]) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", windowsHide: true }).trim();
}
async function fixture(initialCommit = true) {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-git-management-"));
  directories.push(root);
  await mkdir(path.join(root, "src/content/posts"), { recursive: true });
  await writeFile(path.join(root, "src/content/posts/one.md"), "# One\n");
  await writeFile(path.join(root, "README.md"), "# Fixture\n");
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, scripts: { build: "node build.mjs" } }),
  );
  await writeFile(
    path.join(root, "build.mjs"),
    "import {writeFileSync} from 'node:fs'; console.log('正在构建 Mizuki'); setTimeout(() => { writeFileSync('build.marker','ok'); console.log('构建完成'); }, 400);",
  );
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "MizukiPanel Test");
  git(root, "config", "user.email", "panel@example.invalid");
  if (initialCommit) {
    git(root, "add", ".");
    git(root, "commit", "-m", "chore(test): initialize fixture");
  }
  const report: ProjectReport = {
    requestedPath: root,
    root,
    mode: "local",
    readOnly: false,
    contentRoot: null,
    warnings: [],
    mappings: [],
  };
  return { root, report };
}
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function waitForOperation(report: ProjectReport) {
  for (let index = 0; index < 200; index++) {
    const status = publishOperationStatus(report);
    if (status.state !== "running") return status;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("构建等待超时");
}

it("manages all Mizuki project files and always uses the project repository in external mode", async () => {
  const { root, report } = await fixture();
  const external = await fixture();
  await writeFile(path.join(root, "README.md"), "# Project edit\n");
  await writeFile(path.join(external.root, "README.md"), "# External edit\n");
  const current = { ...report, mode: "external" as const, contentRoot: external.root };
  expect((await publishOverview(current)).repositoryRoot).toBe(root);
  await commitSelected(current, ["README.md"], "docs: update project");
  expect(git(root, "show", "HEAD:README.md")).toBe("# Project edit");
  expect(git(external.root, "status", "--porcelain")).toContain("README.md");
  expect(git(external.root, "log", "-1", "--format=%s")).toBe("chore(test): initialize fixture");
});

it("commits only selected project files and leaves other changes untouched", async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, "README.md"), "# Selected\n");
  await writeFile(path.join(root, "src/content/posts/one.md"), "# Not selected\n");
  const result = await commitSelected(report, ["README.md"], "docs: update selected file");
  expect(result.sha).toBe(git(root, "rev-parse", "HEAD"));
  expect(git(root, "show", "--format=", "--name-only", "HEAD")).toBe("README.md");
  expect(git(root, "status", "--short")).toContain("src/content/posts/one.md");
  expect(publishOperationStatus(report).logs.join("\n")).toContain("docs: update selected file");
  expect(publishOperationStatus(report).state).toBe("succeeded");
});

it("stages all selected changes with git add . from the project root, honoring ignored files", async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, "README.md"), "# Updated\n");
  await rm(path.join(root, "src/content/posts/one.md"));
  await writeFile(path.join(root, "src/content/posts/new.md"), "# New\n");
  await writeFile(path.join(root, ".gitignore"), "ignored.txt\n");
  await writeFile(path.join(root, "ignored.txt"), "Keep ignored\n");
  const overview = await publishOverview(report);
  await commitSelected(
    report,
    overview.changes.map((change) => change.path),
    "docs: commit all changes",
  );
  expect(git(root, "show", "--format=", "--name-only", "HEAD").split("\n")).toEqual([
    ".gitignore",
    "README.md",
    "src/content/posts/new.md",
    "src/content/posts/one.md",
  ]);
  expect(git(root, "status", "--porcelain")).toBe("");
  expect(await readFile(path.join(root, "ignored.txt"), "utf8")).toBe("Keep ignored\n");
  expect(publishOperationStatus(report).logs.join("\n")).toContain('$ git "add" "."');
});

it("paginates a fixed history snapshot and reads full commit details without modifying Git", async () => {
  const { root, report } = await fixture();
  for (let index = 0; index < 23; index++)
    git(root, "commit", "--allow-empty", "-m", `docs: history ${index}`);
  const first = await publishHistory(report);
  expect(first.total).toBe(24);
  expect(first.commits).toHaveLength(20);
  expect(first.commits[0]).toMatchObject({
    sha: first.head,
    subject: "docs: history 22",
    author: "MizukiPanel Test",
  });
  const before = git(root, "status", "--porcelain");
  git(root, "commit", "--allow-empty", "-m", "docs: later commit");
  const second = await publishHistory(report, 2, first.head!);
  expect(second.total).toBe(24);
  expect(second.commits).toHaveLength(4);
  expect(second.commits.some((c) => c.subject === "docs: later commit")).toBe(false);
  const initial = second.commits.at(-1)!;
  const detail = await publishCommitDetail(report, initial.sha);
  expect(detail.message).toBe("chore(test): initialize fixture");
  expect(detail.diff).toContain("README.md");
  expect(git(root, "status", "--porcelain")).toBe(before);
  expect(publishOperationStatus(report).logs.join("\n")).toContain("已读取提交历史第 2 页");
}, 20000);

it("shows fetch and push remotes, upstream counts and the current branch, redacting credentials", async () => {
  const { root, report } = await fixture();
  git(root, "remote", "add", "origin", "https://user:secret@example.invalid/Mizuki.git");
  git(root, "remote", "set-url", "--push", "origin", "git@example.invalid:user/Mizuki.git");
  git(root, "update-ref", "refs/remotes/origin/main", "HEAD");
  git(root, "branch", "--set-upstream-to=origin/main");
  const overview = await publishOverview(report);
  expect(overview).toMatchObject({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0 });
  expect(overview.remotes).toEqual([
    {
      name: "origin",
      fetchUrls: ["https://***@example.invalid/Mizuki.git"],
      pushUrls: ["git@example.invalid:user/Mizuki.git"],
    },
  ]);
  expect(JSON.stringify(publishOperationStatus(report))).not.toContain("secret");
});

it("keeps all read-only inspection available while refusing commits and builds", async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, "README.md"), "# Read-only edit\n");
  const restricted = { ...report, readOnly: true };
  expect(await publishOverview(restricted)).toMatchObject({ canCommit: false, canBuild: false });
  expect((await publishHistory(restricted)).total).toBe(1);
  expect(await publishDiff(restricted, "README.md")).toContain("Read-only edit");
  await expect(commitSelected(restricted, ["README.md"], "docs: edit")).rejects.toThrow("只读");
  await expect(startPublishOperation(restricted, "build")).rejects.toThrow("只读");
  expect(git(root, "diff", "--cached", "--name-only")).toBe("");
});

it("rejects invalid selections and preserves pre-existing staging", async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, "README.md"), "# Edit\n");
  await expect(commitSelected(report, ["../outside"], "docs: edit")).rejects.toThrow("项目内");
  await expect(commitSelected(report, ["missing"], "docs: edit")).rejects.toThrow("不存在");
  await expect(publishCommitDetail(report, "--output=outside")).rejects.toThrow("无效");
  await expect(publishHistory(report, -1)).rejects.toThrow("无效");
  git(root, "add", "README.md");
  await expect(commitSelected(report, ["README.md"], "docs: edit")).rejects.toThrow(
    "暂存区已有内容",
  );
  expect(git(root, "diff", "--cached", "--name-only")).toBe("README.md");
});

it("previews project text and binary changes without requiring content mappings", async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, "new.txt"), "# New\n");
  await writeFile(path.join(root, "binary.dat"), Buffer.from([0, 1, 2]));
  expect(await publishDiff(report, "new.txt")).toContain("+# New");
  expect(await publishDiff(report, "binary.dat")).toContain("二进制");
  expect(() => validateCommitMessage("invalid")).toThrow("Conventional");
});

it("supports an unborn repository and restores its empty staging area after commit failure", async () => {
  const { root, report } = await fixture(false);
  expect((await publishHistory(report)).commits).toEqual([]);
  expect((await publishOverview(report)).canCommit).toBe(true);
  git(root, "config", "user.email", "");
  git(root, "config", "user.name", "");
  await expect(commitSelected(report, ["README.md"], "docs: initial")).rejects.toThrow();
  expect(git(root, "diff", "--cached", "--name-only")).toBe("");
  expect(await readFile(path.join(root, "README.md"), "utf8")).toContain("Fixture");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  await commitSelected(report, ["README.md"], "docs: initial");
  expect((await publishHistory(report)).total).toBe(1);
});

it("blocks commits on detached HEAD but allows independent builds", async () => {
  const { root, report } = await fixture();
  git(root, "checkout", "--detach");
  await writeFile(path.join(root, "README.md"), "# Dirty\n");
  const overview = await publishOverview(report);
  expect(overview).toMatchObject({ branch: null, canCommit: false, canBuild: true });
  await expect(commitSelected(report, ["README.md"], "docs: edit")).rejects.toThrow("游离");
});

it("builds dirty Mizuki projects without content sync, streams logs and isolates project state", async () => {
  const { root, report } = await fixture();
  const other = await fixture();
  await writeFile(path.join(root, "README.md"), "# Dirty\n");
  const external = { ...report, mode: "external" as const, contentRoot: other.root };
  const started = await startPublishOperation(external, "build");
  expect(started.state).toBe("running");
  expect(workspacePublishTask()?.projectRoot).toBe(root);
  await expect(startPublishOperation(other.report, "build")).rejects.toThrow("正在运行");
  await expect(commitSelected(report, ["README.md"], "docs: edit")).rejects.toThrow("正在运行");
  const status = await waitForOperation(external);
  expect(status.state).toBe("succeeded");
  expect(status.logs.join("\n")).toContain("正在构建 Mizuki");
  expect(status.logs.join("\n")).toContain("pnpm run build");
  expect(await readFile(path.join(root, "build.marker"), "utf8")).toBe("ok");
  await expect(readFile(path.join(other.root, "build.marker"), "utf8")).rejects.toThrow();
  expect(publishOperationStatus(other.report).logs).toEqual([]);
  expect(workspacePublishTask()).toBeNull();
  expect(git(root, "status", "--porcelain")).toContain("README.md");
}, 15000);

it("queries complete history by literal message, body, author, email and commit ID with pagination", async () => {
  const { root, report } = await fixture();
  for (let i = 0; i < 23; i++) git(root, "commit", "--allow-empty", "-m", `docs: 全文匹配 ${i}`);
  git(root, "commit", "--allow-empty", "-m", "docs: body search", "-m", "特殊查询.[x] 中文正文");
  const anchor = git(root, "rev-parse", "HEAD");
  expect((await publishHistory(report, 1, anchor, "initialize")).total).toBe(1);
  expect((await publishHistory(report, 1, anchor, "特殊查询.[x]")).commits[0].subject).toBe(
    "docs: body search",
  );
  expect((await publishHistory(report, 1, anchor, "mIzUkIpAnEl")).total).toBe(25);
  expect((await publishHistory(report, 1, anchor, "panel@example.invalid")).total).toBe(25);
  expect((await publishHistory(report, 1, anchor, anchor.slice(0, 9))).total).toBe(1);
  expect((await publishHistory(report, 1, anchor, "全文匹配")).commits).toHaveLength(20);
  expect((await publishHistory(report, 2, anchor, "全文匹配")).commits).toHaveLength(3);
  expect((await publishHistory(report, 1, anchor, "no matching query")).total).toBe(0);
  await expect(publishHistory(report, 1, anchor, "x".repeat(201))).rejects.toThrow("200");
  expect(publishOperationStatus(report).logs.join("\n")).toContain("查询完成：找到 23 条");
}, 20000);

async function upstreamFixture() {
  const current = await fixture();
  const remote = await mkdtemp(path.join(tmpdir(), "mizuki-push-remote-"));
  directories.push(remote);
  execFileSync("git", ["init", "--bare", remote], { stdio: "ignore" });
  git(current.root, "remote", "add", "origin", remote);
  git(current.root, "push", "-u", "origin", "main");
  return { ...current, remote };
}
it("pushes only existing commits to the configured upstream while preserving uncommitted changes", async () => {
  const { root, report, remote } = await upstreamFixture();
  git(root, "commit", "--allow-empty", "-m", "docs: push this commit");
  await writeFile(path.join(root, "README.md"), "# Uncommitted\n");
  const before = git(root, "status", "--porcelain");
  const overview = await publishOverview(report);
  expect(overview.canPush).toBe(true);
  await pushCurrentBranch(report, undefined, {
    head: overview.head!,
    branch: overview.branch!,
    upstream: overview.upstream!,
    pushUrls: overview.remotes[0].pushUrls,
  });
  expect(git(remote, "rev-parse", "refs/heads/main")).toBe(overview.head);
  expect(git(root, "status", "--porcelain")).toBe(before);
  expect((await publishOverview(report)).ahead).toBe(0);
  const status = publishOperationStatus(report);
  expect(status).toMatchObject({ kind: "push", state: "succeeded" });
  expect(status.logs.join("\n")).toContain("推送目标：main → origin/main");
}, 15000);

it("refuses stale push confirmation and changed remote URLs without sending commits", async () => {
  const { root, report, remote } = await upstreamFixture();
  const overview = await publishOverview(report);
  git(root, "commit", "--allow-empty", "-m", "docs: new local commit");
  await expect(
    pushCurrentBranch(report, undefined, {
      head: overview.head!,
      branch: "main",
      upstream: "origin/main",
    }),
  ).rejects.toThrow("已变化");
  expect(git(remote, "rev-parse", "refs/heads/main")).toBe(overview.head);
  await expect(
    pushCurrentBranch(report, undefined, {
      head: git(root, "rev-parse", "HEAD"),
      branch: "main",
      upstream: "origin/main",
      pushUrls: ["https://old.example.invalid/repo.git"],
    }),
  ).rejects.toThrow("地址已变化");
  expect(workspacePublishTask()).toBeNull();
}, 15000);

it("shows push errors for missing upstream and read-only projects", async () => {
  const { report } = await fixture();
  expect((await publishOverview(report)).pushDisabledReason).toContain("未配置上游");
  await expect(pushCurrentBranch(report)).rejects.toThrow("未配置上游");
  await expect(pushCurrentBranch({ ...report, readOnly: true })).rejects.toThrow("只读");
  expect(workspacePublishTask()).toBeNull();
});

it("rejects non-fast-forward pushes and preserves local and remote commits", async () => {
  const { root, report, remote } = await upstreamFixture();
  git(root, "branch", "side");
  git(root, "commit", "--allow-empty", "-m", "docs: remote changed");
  git(root, "push");
  const remoteHead = git(remote, "rev-parse", "refs/heads/main");
  git(root, "checkout", "side");
  git(root, "branch", "--set-upstream-to=origin/main");
  git(root, "commit", "--allow-empty", "-m", "docs: local diverged");
  const localHead = git(root, "rev-parse", "HEAD");
  await expect(pushCurrentBranch(report)).rejects.toThrow();
  expect(git(remote, "rev-parse", "refs/heads/main")).toBe(remoteHead);
  expect(git(root, "rev-parse", "HEAD")).toBe(localHead);
  expect(publishOperationStatus(report).state).toBe("failed");
  expect(workspacePublishTask()).toBeNull();
}, 15000);

it("keeps build available without Git and reports failed build output", async () => {
  const { root, report } = await fixture();
  await rm(path.join(root, ".git"), { recursive: true, force: true });
  await writeFile(path.join(root, "build.mjs"), "console.error('构建错误测试'); process.exit(2);");
  expect(await publishOverview(report)).toMatchObject({
    repositoryAvailable: false,
    canBuild: true,
  });
  await startPublishOperation(report, "build");
  const status = await waitForOperation(report);
  expect(status.state).toBe("failed");
  expect(status.error).toContain("构建失败");
  expect(status.logs.join("\n")).toContain("构建错误测试");
  expect(workspacePublishTask()).toBeNull();
}, 15000);

it("restores staging after a failed commit while preserving working files", async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, "README.md"), "# Keep my edit\n");
  await writeFile(path.join(root, "src/content/posts/new.md"), "# Keep my new file\n");
  git(root, "config", "user.name", "");
  git(root, "config", "user.email", "");
  const paths = (await publishOverview(report)).changes.map((change) => change.path);
  await expect(commitSelected(report, paths, "docs: change")).rejects.toThrow();
  expect(git(root, "diff", "--cached", "--name-only")).toBe("");
  expect(await readFile(path.join(root, "README.md"), "utf8")).toBe("# Keep my edit\n");
  expect(await readFile(path.join(root, "src/content/posts/new.md"), "utf8")).toBe(
    "# Keep my new file\n",
  );
  expect(publishOperationStatus(report).state).toBe("failed");
});

it("bounds large historical diffs and keeps Git metadata read-only", async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, "large.txt"), "large content\n".repeat(30000));
  git(root, "add", "large.txt");
  git(root, "commit", "-m", "docs: large text");
  const head = git(root, "rev-parse", "HEAD");
  const detail = await publishCommitDetail(report, head);
  expect(detail.truncated).toBe(true);
  expect(detail.diff).toContain("差异已截断");
  expect(git(root, "rev-parse", "HEAD")).toBe(head);
}, 15000);
