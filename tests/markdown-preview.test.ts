import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { splitArticleSource } from "../src/lib/articles/article-source";
import { mediaPreviewUrl } from "../src/lib/articles/media-preview-url";
import { renderMarkdownDraft } from "../src/lib/server/markdown-preview";
import { rehypePreviewResources } from "../src/lib/server/markdown-preview-resources";
import { inspectProject } from "../src/lib/server/project";

const mizukiRoot = path.resolve(process.cwd(), "../Mizuki");
const realPost = path.join(mizukiRoot, "src/content/posts/Qt框架功能概述.md");

it("maps public and article images through guarded media URLs", () => {
  expect(mediaPreviewUrl("nested/post.md", "/images/photo.png")).toBe(
    "/api/media/file?scope=public&path=photo.png",
  );
  expect(mediaPreviewUrl("nested/post.md", "./photo.png")).toBe(
    "/api/media/file?scope=article&path=nested%2Fphoto.png",
  );
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "img",
        properties: { src: "./photo.png", srcSet: "photo.png 2x" },
      },
    ],
  };
  rehypePreviewResources({ articleId: "nested/post.md" })(tree);
  expect(tree.children[0].properties.src).toBe(
    "/api/media/file?scope=article&path=nested%2Fphoto.png",
  );
  expect(tree.children[0].properties).not.toHaveProperty("srcSet");
});

it.skipIf(!existsSync(realPost))(
  "renders an unsaved Markdown body with Mizuki plugins without changing the article",
  async () => {
    const report = await inspectProject(mizukiRoot);
    const before = await readFile(realPost, "utf8");
    const sample = [
      "# Draft preview",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| a | b |",
      "",
      ":::warning[Notice]",
      "Preview **draft**.",
      ":::",
      "",
      "Equation $E=mc^2$.",
      "",
      "[[Qt框架功能概述]]",
      "",
      "```mermaid",
      "graph TD; A-->B;",
      "```",
      "",
      "```plantuml",
      "@startuml",
      "Alice -> Bob: hello",
      "@enduml",
      "```",
      "",
      "![cover](/images/demo.png)",
    ].join("\n");
    const result = await renderMarkdownDraft(report, "Qt框架功能概述.md", sample);
    expect(result.html).toContain("Draft preview");
    expect(result.html).toContain("<table");
    expect(result.html).toContain("admonition");
    expect(result.html).toContain("katex");
    expect(result.html).toContain("mermaid");
    expect(result.html).toContain("plantuml");
    expect(result.html).toContain("card-wiki-link");
    expect(result.html).toContain("/api/media/file?scope=public");
    expect(result.css).toContain("custom-md");
    const updated = await renderMarkdownDraft(
      report,
      "Qt框架功能概述.md",
      sample.replace("Preview **draft**.", "Preview **updated draft**."),
    );
    expect(updated.html).toContain("updated draft");
    expect(await readFile(realPost, "utf8")).toBe(before);
    await expect(renderMarkdownDraft(report, "Qt框架功能概述.mdx", sample)).rejects.toThrow(
      "仅支持 .md",
    );
    expect(splitArticleSource(before)?.body).toBeTruthy();
  },
  60_000,
);
