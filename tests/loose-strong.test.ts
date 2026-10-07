import { expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { restoreLooseStrong } from "../src/lib/articles/loose-strong";
import { segmentArticleSource } from "../src/lib/articles/source-islands";

const renderer = unified()
  .use(remarkParse)
  .use(() => (tree, file) => restoreLooseStrong(tree, String(file)))
  .use(remarkRehype)
  .use(rehypeStringify);

it("renders adjacent Chinese and punctuation wrapped in explicit strong markers", () => {
  const body = "**QObject**类的**parent()**函数返回其父对象， **children()**函数返回其子对象。";
  const html = String(renderer.processSync(body));

  expect(html).toContain("<strong>QObject</strong>类的<strong>parent()</strong>函数");
  expect(html).toContain("<strong>children()</strong>函数");
  expect(html).not.toContain("**");
});

it("leaves escaped markers and code literal while preserving the article source", () => {
  const body = "\\*\\*parent()\\*\\* and `**children()**` and **valid**";
  const html = String(renderer.processSync(body));
  const source = `---\ntitle: Demo\n---\n\n${body}\n`;
  const article = segmentArticleSource(source, "md");

  expect(html).toContain("**parent()**");
  expect(html).toContain("<code>**children()**</code>");
  expect(html).toContain("<strong>valid</strong>");
  expect(article.source).toBe(source);
  expect(article.segments.map((segment) => segment.raw).join("")).toBe(article.body);
});
