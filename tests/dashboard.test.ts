import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { dashboardOverview } from "../src/lib/server/dashboard";
import type { ProjectReport } from "../src/lib/server/project";

const directories: string[] = [];

async function fixture(mode: "local" | "external"): Promise<ProjectReport> {
  const base = await mkdtemp(path.join(tmpdir(), "mizuki-dashboard-"));
  directories.push(base);
  const root = path.join(base, "site");
  const contentRoot = mode === "external" ? path.join(base, "content") : null;
  await mkdir(root);
  await mkdir(
    contentRoot ? path.join(contentRoot, "posts") : path.join(root, "src/content/posts"),
    { recursive: true },
  );
  execFileSync("git", ["init", root], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "config", "user.name", "MizukiPanel Test"]);
  execFileSync("git", ["-C", root, "config", "user.email", "panel@example.invalid"]);
  return {
    requestedPath: root,
    root,
    mode,
    readOnly: false,
    contentRoot,
    warnings: [],
    mappings: [],
  };
}

async function article(report: ProjectReport, name: string, frontmatter: string) {
  const posts = report.contentRoot
    ? path.join(report.contentRoot, "posts")
    : path.join(report.root, "src/content/posts");
  await writeFile(path.join(posts, name), `---\n${frontmatter}\n---\n`);
}

async function commit(root: string, date: string, message: string) {
  const file = path.join(root, message.replace(/\W+/g, "-") + ".txt");
  await writeFile(file, message);
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "commit", "-m", message], {
    stdio: "ignore",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: `${date}T12:00:00+08:00`,
      GIT_COMMITTER_DATE: `${date}T12:00:00+08:00`,
    },
  });
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

it("aggregates article publishing data and Mizuki repository commits", async () => {
  const report = await fixture("external");
  await article(
    report,
    "published.md",
    "title: Published\npublished: 2026-09-20\ntags: [Astro, Mizuki]",
  );
  await article(
    report,
    "draft.md",
    "title: Draft\npublished: 2026-09-25\ndraft: true\ntags: [Mizuki]",
  );
  await article(report, "scheduled.mdx", "title: Scheduled\npublished: 2026-10-01");
  await article(report, "broken.md", "title: Broken\npublished: nope");
  await commit(report.root, "2026-09-20", "first commit");
  await commit(report.root, "2026-09-21", "second commit");

  const overview = await dashboardOverview(report, new Date("2026-09-27T08:00:00+08:00"));

  expect(overview.range).toEqual({ start: "2025-09-28", end: "2026-09-27" });
  expect(overview.articles).toMatchObject({
    total: 4,
    published: 1,
    drafts: 1,
    scheduled: 1,
    invalid: 1,
    addedLast30Days: 1,
  });
  expect(overview.articles.activity.find((day) => day.date === "2026-09-20")?.count).toBe(1);
  expect(overview.articles.tags).toEqual([
    { name: "Mizuki", count: 2 },
    { name: "Astro", count: 1 },
  ]);
  expect(overview.git).toMatchObject({
    repositoryRoot: report.root,
    available: true,
    totalCommits: 2,
    commitsLast30Days: 2,
    currentStreak: 0,
    longestStreak: 2,
  });
  expect(overview.git.activity.find((day) => day.date === "2026-09-21")?.count).toBe(1);
});

it("keeps local article analytics available when the Mizuki project has no Git repository", async () => {
  const report = await fixture("local");
  await article(report, "local.md", "title: Local\npublished: 2026-09-27");
  await rm(path.join(report.root, ".git"), { recursive: true, force: true });
  const overview = await dashboardOverview(report, new Date("2026-09-27T08:00:00+08:00"));
  expect(overview.articles).toMatchObject({ total: 1, published: 1, addedLast30Days: 1 });
  expect(overview.git.available).toBe(false);
  expect(overview.git.totalCommits).toBe(0);
  expect(overview.git.activity).toHaveLength(365);
});
