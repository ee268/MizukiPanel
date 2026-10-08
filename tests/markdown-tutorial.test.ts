import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MarkdownTutorial } from "../src/client/articles/MarkdownTutorial";
import { ArticleEditor } from "../src/client/articles/ArticleEditor";
import type { ArticleRecord } from "../src/client/types";
import tutorialSource from "../src/client/articles/markdown-tutorial.mdx?raw";
import { segmentArticleSource } from "../src/lib/articles/source-islands";

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
