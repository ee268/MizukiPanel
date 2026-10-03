import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { readMedia } from "../src/lib/server/media";
import { renderMarkdownDraft } from "../src/lib/server/markdown-preview";
import { inspectProject, type ProjectReport } from "../src/lib/server/project";

const mizukiRoot = path.resolve(process.cwd(), "../Mizuki");
const realPost = path.join(mizukiRoot, "src/content/posts/Qt框架功能概述.md");
const temporaryPaths: string[] = [];

afterEach(async () => {
  for (const target of temporaryPaths.splice(0)) {
    await rm(target, { recursive: true, force: true });
  }
});

it.skipIf(!existsSync(realPost))(
  "renders an external content draft and serves its images without changing either repository",
  async () => {
    const local = await inspectProject(mizukiRoot);
    const localArticleBefore = await readFile(realPost, "utf8");
    const contentRoot = await mkdtemp(path.join(tmpdir(), "mizuki-preview-external-"));
    temporaryPaths.push(contentRoot);

    const posts = path.join(contentRoot, "posts");
    const images = path.join(contentRoot, "images");
    await mkdir(path.join(posts, "nested/assets"), { recursive: true });
    await mkdir(images, { recursive: true });
    const articleId = "nested/regression.md";
    const articlePath = path.join(posts, articleId);
    const original =
      "---\ntitle: Regression\npublished: 2026-10-03\ntags: [one, two]\n---\n\n# Saved\n";
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Q6SAAAAAASUVORK5CYII=",
      "base64",
    );
    await writeFile(articlePath, original);
    await writeFile(path.join(posts, "nested/assets/cover.png"), png);
    await writeFile(path.join(images, "banner.png"), png);

    const report: ProjectReport = {
      ...local,
      mode: "external",
      contentRoot,
      mappings: local.mappings.map((mapping) =>
        mapping.key === "posts" ? { ...mapping, sourcePath: posts } : mapping,
      ),
    };
    const draft = [
      "# Unsaved external draft",
      "",
      "![Cover](./assets/cover.png)",
      "",
      "![Banner](/images/banner.png)",
      "",
      "| Key | Value |",
      "| --- | --- |",
      "| one | two |",
    ].join("\n");
    const preview = await renderMarkdownDraft(report, articleId, draft);

    expect(preview.html).toContain("Unsaved external draft");
    expect(preview.html).toMatch(
      /href="\/api\/media\/file\?scope=article&#x26;path=nested%2Fassets%2Fcover.png"/,
    );
    expect(preview.html).toMatch(/src="\/api\/media\/file\?scope=public&#x26;path=banner.png"/);
    expect(preview.html).toContain("<table");
    expect(preview.differences).toEqual(
      expect.arrayContaining([expect.stringContaining("独立内容仓库的 Wiki Link")]),
    );
    expect((await readMedia(report, "article", "nested/assets/cover.png")).bytes).toEqual(png);
    expect((await readMedia(report, "public", "banner.png")).bytes).toEqual(png);
    expect(await readFile(articlePath, "utf8")).toBe(original);
    expect(await readFile(realPost, "utf8")).toBe(localArticleBefore);
  },
  60_000,
);
