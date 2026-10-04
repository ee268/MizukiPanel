import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { segmentArticleSource } from "../src/lib/articles/source-islands";
import { ArticleValidationError } from "../src/lib/server/article-format";
import { readArticle, saveArticleBody, saveArticleSource } from "../src/lib/server/articles";
import type { ProjectReport } from "../src/lib/server/project";
import { StorageConflict } from "../src/lib/server/storage";

const temporaryPaths: string[] = [];

async function fixture(mode: "local" | "external", id: string, source: string) {
  const base = await mkdtemp(path.join(tmpdir(), "mizuki-article-body-"));
  temporaryPaths.push(base);
  const root = path.join(base, "site");
  const contentRoot = mode === "external" ? path.join(base, "content") : null;
  const posts = contentRoot
    ? path.join(contentRoot, "posts")
    : path.join(root, "src/content/posts");
  const filename = path.join(posts, id);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, source, "utf8");

  const report: ProjectReport = {
    requestedPath: root,
    root,
    mode,
    readOnly: false,
    contentRoot,
    warnings: [],
    mappings: [],
  };
  return { report, filename };
}

afterEach(async () => {
  for (const target of temporaryPaths.splice(0)) {
    await rm(target, { recursive: true, force: true });
  }
});

it("saves only the Markdown body while preserving BOM, Frontmatter and CRLF", async () => {
  const prefix =
    "\uFEFF---\r\ntitle: Safe\r\npublished: 2026-09-27\r\ntags: [one, two] # keep\r\n---\r\n";
  const source = prefix + "\r\n# Old\r\n\r\n[[target]]\r\n";
  const { report, filename } = await fixture("local", "nested/post.md", source);
  const initial = await readArticle(report, "nested/post.md");

  const saved = await saveArticleBody(
    report,
    initial.id,
    "\n# New\n\n[[target]]\n",
    initial.version,
  );
  const result = await readFile(filename, "utf8");
  expect(result).toBe(prefix + "\r\n# New\r\n\r\n[[target]]\r\n");
  expect(saved.version).not.toBe(initial.version);
  expect(saved.backupPath).toBeTruthy();
  expect(await readFile(saved.backupPath!, "utf8")).toBe(source);
  await rm(saved.backupPath!, { force: true });
});

it("rejects stale versions without writing or backing up", async () => {
  const source = "---\ntitle: Safe\npublished: 2026-09-27\n---\n\n# Original\n";
  const { report, filename } = await fixture("local", "safe.md", source);
  const initial = await readArticle(report, "safe.md");
  await writeFile(filename, source.replace("Original", "External"), "utf8");

  await expect(
    saveArticleBody(report, "safe.md", "\n# Edited\n", initial.version),
  ).rejects.toBeInstanceOf(StorageConflict);
  expect(await readFile(filename, "utf8")).toBe(source.replace("Original", "External"));
});

it("rejects invalid MDX and undeclared source island edits", async () => {
  const source = [
    "---",
    "title: Component",
    "published: 2026-09-27",
    "---",
    "",
    "# Original",
    "",
    "<Widget value={1} />",
    "",
  ].join("\n");
  const { report, filename } = await fixture("local", "component.mdx", source);
  const initial = await readArticle(report, "component.mdx");
  const changedBody = initial.source
    .slice(source.indexOf("# Original"))
    .replace("value={1}", "value={2}");

  await expect(
    saveArticleBody(report, initial.id, "\n<Widget value={}>\n", initial.version),
  ).rejects.toBeInstanceOf(ArticleValidationError);
  await expect(
    saveArticleBody(report, initial.id, changedBody, initial.version),
  ).rejects.toBeInstanceOf(ArticleValidationError);
  expect(await readFile(filename, "utf8")).toBe(source);

  const island = segmentArticleSource(source, "mdx").segments.find((segment) =>
    segment.syntax?.startsWith("mdxJsx"),
  )!;
  const saved = await saveArticleBody(report, initial.id, changedBody, initial.version, [
    { id: island.id, source: island.raw.replace("value={1}", "value={2}") },
  ]);
  expect(saved.version).not.toBe(initial.version);
  expect(await readFile(filename, "utf8")).toContain("<Widget value={2} />");
  await rm(saved.backupPath!, { force: true });
});

it("writes an external content repository without touching runtime posts", async () => {
  const source = "---\ntitle: External\npublished: 2026-09-27\n---\n\n# Before\n";
  const { report, filename } = await fixture("external", "nested/article.md", source);
  const initial = await readArticle(report, "nested/article.md");
  const saved = await saveArticleBody(report, initial.id, "\n# After\n", initial.version);

  expect(await readFile(filename, "utf8")).toBe(source.replace("Before", "After"));
  expect(existsSync(path.join(report.root, "src/content/posts/nested/article.md"))).toBe(false);
  await rm(saved.backupPath!, { force: true });
});

it("normalizes declared source-card edits to the article's CRLF convention", async () => {
  const source = [
    "---",
    "title: CRLF Component",
    "published: 2026-09-27",
    "---",
    "",
    "<Widget value={1} />",
    "",
  ].join("\r\n");
  const { report, filename } = await fixture("local", "crlf.mdx", source);
  const initial = await readArticle(report, "crlf.mdx");
  const island = segmentArticleSource(source, "mdx").segments.find((segment) =>
    segment.syntax?.startsWith("mdxJsx"),
  )!;

  const saved = await saveArticleBody(
    report,
    initial.id,
    "\n<Widget value={2} />\n",
    initial.version,
    [{ id: island.id, source: island.raw.replace("value={1}", "value={2}") }],
  );
  expect(await readFile(filename, "utf8")).toBe(source.replace("value={1}", "value={2}"));
  await rm(saved.backupPath!, { force: true });
});

it("rejects unsafe article paths and read-only projects", async () => {
  const source = "---\ntitle: Safe\npublished: 2026-09-27\n---\n\n# Safe\n";
  const { report, filename } = await fixture("local", "safe.md", source);
  const initial = await readArticle(report, "safe.md");
  await expect(
    saveArticleBody(report, "../escape.md", "\n# Changed\n", initial.version),
  ).rejects.toBeInstanceOf(ArticleValidationError);
  report.readOnly = true;
  await expect(
    saveArticleBody(report, "safe.md", "\n# Changed\n", initial.version),
  ).rejects.toBeInstanceOf(ArticleValidationError);
  expect(await readFile(filename, "utf8")).toBe(source);
});

it("leaves the file and version unchanged for a no-op save", async () => {
  const source = "---\ntitle: Same\npublished: 2026-09-27\n---\n\n# Same\n";
  const { report, filename } = await fixture("local", "same.md", source);
  const initial = await readArticle(report, "same.md");
  const saved = await saveArticleBody(report, initial.id, "\n# Same\n", initial.version);
  expect(saved).toEqual({ version: initial.version, backupPath: null });
  expect(await readFile(filename, "utf8")).toBe(source);
});

it("saves and reloads GFM tables, tasks, links and image references", async () => {
  const source = "---\ntitle: GFM\npublished: 2026-09-27\n---\n\n# Before\n";
  const body = [
    "",
    "| Name | Value |",
    "| --- | --- |",
    "| one | two |",
    "",
    "- [x] Finished",
    "- [ ] Pending",
    "",
    "[Guide](https://example.com/guide)",
    "",
    "![Local](./assets/photo.png)",
    "![Public](/images/banner.png)",
    "",
  ].join("\n");
  const { report, filename } = await fixture("external", "nested/gfm.md", source);
  const initial = await readArticle(report, "nested/gfm.md");
  const saved = await saveArticleBody(report, initial.id, body, initial.version);
  const reopened = await readArticle(report, initial.id);

  expect(reopened.source).toBe(source.slice(0, source.indexOf("\n# Before")) + body);
  expect(reopened.source).toContain("| one | two |");
  expect(reopened.source).toContain("- [x] Finished");
  expect(reopened.source).toContain("![Local](./assets/photo.png)");
  expect(segmentArticleSource(reopened.source, "md").mode).toBe("hybrid");
  expect(await readFile(filename, "utf8")).toBe(reopened.source);
  await rm(saved.backupPath!, { force: true });
});

it("saves malformed image HTML as literal body text and renders it after correction", async () => {
  const valid = '<img src="https://example.com/photo.png" alt="A" />';
  const invalid = valid.slice(0, -1);
  const source = `---\ntitle: Image\npublished: 2026-09-27\n---\n\n${valid}\n`;
  const { report, filename } = await fixture("local", "image.md", source);
  const initial = await readArticle(report, "image.md");

  const saved = await saveArticleSource(
    report,
    initial.id,
    source.replace(valid, invalid),
    initial.version,
  );
  const reopened = await readArticle(report, initial.id);
  const draft = segmentArticleSource(reopened.source, "md").segments.find(
    (segment) => segment.syntax === "htmlImageDraft",
  );
  expect(draft?.raw).toBe(invalid);
  expect(await readFile(filename, "utf8")).toBe(source.replace(valid, invalid));

  const corrected = await saveArticleSource(
    report,
    reopened.id,
    reopened.source.replace(invalid, valid),
    reopened.version,
  );
  const final = await readArticle(report, reopened.id);
  expect(
    segmentArticleSource(final.source, "md").segments.some(
      (segment) => segment.syntax === "html" && segment.raw === valid,
    ),
  ).toBe(true);
  await rm(saved.backupPath!, { force: true });
  await rm(corrected.backupPath!, { force: true });
});

const realPost = path.resolve(process.cwd(), "../Mizuki/src/content/posts/Qt框架功能概述.md");
it.skipIf(!existsSync(realPost))("validates a copy of a real Mizuki Markdown article", async () => {
  const original = await readFile(realPost, "utf8");
  const { report, filename } = await fixture("local", "real-copy.md", original);
  const initial = await readArticle(report, "real-copy.md");
  const article = segmentArticleSource(original, "md");
  const nextBody = article.body + "\n\n新增段落。\n";

  const saved = await saveArticleBody(report, initial.id, nextBody, initial.version);
  const result = await readFile(filename, "utf8");
  expect(result.slice(0, article.bodyStart)).toBe(original.slice(0, article.bodyStart));
  expect(result).toContain("新增段落。");
  expect(await readFile(realPost, "utf8")).toBe(original);
  await rm(saved.backupPath!, { force: true });
});
