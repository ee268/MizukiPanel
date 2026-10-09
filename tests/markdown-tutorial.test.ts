import { createElement } from "react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MarkdownTutorial } from "../src/client/articles/MarkdownTutorial";
import { ArticleEditor } from "../src/client/articles/ArticleEditor";
import type { ArticleRecord } from "../src/client/types";
import tutorialSource from "../src/client/articles/markdown-tutorial.mdx?raw";
import { segmentArticleSource } from "../src/lib/articles/source-islands";
import { vditorBody } from "../src/client/articles/vditor-source";
import { configureVditorStrong } from "../src/client/articles/vditor-strong";
import { patchVditorLute } from "../scripts/vditor-lute-patch";

it("renders the tutorial HTML image in every Vditor mode and keeps its editable source", () => {
  const require = createRequire(import.meta.url);
  const context = createContext({ TextDecoder, TextEncoder, setTimeout, clearTimeout });
  runInContext(
    patchVditorLute(readFileSync(require.resolve("vditor/dist/js/lute/lute.min.js"), "utf8")),
    context,
  );
  configureVditorStrong(context.Lute);
  const lute = context.Lute.New();
  lute.SetSanitize(true);
  const body = vditorBody(tutorialSource);
  const imageTag = body.match(/^<img src="[^\n]+/m)?.[0];
  expect(imageTag).toBeDefined();
  expect(body).not.toContain("<div>");
  expect(body).toContain("```html\n<img\n");
  for (const mode of ["", "IR"]) {
    const dom = lute[`Md2Vditor${mode}DOM`](body);
    expect(dom).toContain('data-type="html-block"');
    expect(dom).toContain(imageTag);
    const spun = lute[`SpinVditor${mode}DOM`](dom);
    expect(spun).toContain(imageTag);
    const source = lute[`Vditor${mode}DOM2Md`](spun);
    expect(source).toContain(imageTag);
    expect(source).toContain('title="HTML 图片示例"');
  }
  expect(lute.Md2HTML(body)).toContain(imageTag);
  expect(lute.Md2HTML(body)).toContain("&lt;img\n");
});

it("ships a complete editable tutorial while preserving Mizuki and MDX examples", () => {
  const article = segmentArticleSource(tutorialSource, "mdx");

  expect(article.mode).toBe("hybrid");
  expect(article.segments.some((segment) => segment.mode === "editable")).toBe(true);
  expect(article.segments.some((segment) => segment.syntax === "containerDirective")).toBe(true);
  expect(article.segments.some((segment) => segment.syntax === "codeGroup")).toBe(true);
  expect(article.segments.some((segment) => segment.syntax === "mdxJsxFlowElement")).toBe(true);
  expect(
    article.segments.some(
      (segment) => segment.syntax === "leafDirective" && segment.raw.includes("::github{"),
    ),
  ).toBe(true);
  expect(article.segments.some((segment) => segment.syntax === "wikiLink")).toBe(true);
  expect(article.segments.some((segment) => segment.syntax === "textDirective")).toBe(true);
  expect(article.segments.some((segment) => segment.syntax === "githubAdmonition")).toBe(true);
  expect(article.source).toBe(tutorialSource);
});

it("keeps tutorial edits local and hides article save and delete controls", () => {
  const html = renderToStaticMarkup(createElement(MarkdownTutorial, { projectRoot: "" }));

  expect(html).toContain("Markdown 教程");
  expect(html).toContain("重新进入即恢复默认内容");
  expect(html).not.toContain("保存正文");
  expect(html).not.toContain("重命名");
  expect(html).not.toContain("删除</button>");

  const article: ArticleRecord = {
    id: "tutorial.mdx",
    title: "Markdown 教程",
    description: "",
    image: "",
    published: "",
    draft: true,
    format: "mdx",
    error: null,
    alias: "",
    permalink: "",
    slug: "",
    tags: [],
    category: "",
    source: tutorialSource,
    version: "built-in",
    frontmatter: [],
  };
  const sourceHtml = renderToStaticMarkup(
    createElement(ArticleEditor, {
      temporary: true,
      article,
      projectRoot: "",
      previewPath: null,
      frontmatter: [],
      source: tutorialSource,
      mode: "visual",
      busy: false,
      readOnly: false,
      dirty: false,
      sourceDirty: false,
      onFrontmatterChange: () => {},
      onSourceChange: () => {},
      onModeChange: () => {},
      onPreview: () => {},
      onRename: () => {},
      onDelete: () => {},
      onSaveFrontmatter: () => {},
      onSaveDocument: () => {},
      onSaveBody: () => {},
    }),
  );
  expect(sourceHtml).not.toContain("完整文章源码");
  expect(sourceHtml).not.toContain("使用备用编辑器");
  expect(sourceHtml).not.toContain("源码模式");
  expect(sourceHtml).not.toContain("保存源码");
  expect(sourceHtml).not.toContain("删除</button>");
});
