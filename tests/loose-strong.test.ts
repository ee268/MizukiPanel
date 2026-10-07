import { expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  normalizeLooseStrong,
  restoreLooseStrong,
  restoreLooseStrongMarkers,
} from "../src/lib/articles/loose-strong";
import { segmentArticleSource } from "../src/lib/articles/source-islands";

const renderer = unified()
  .use(remarkParse)
  .use(function () {
    const processor = this;
    return (tree, file) => {
      const source = String(file);
      const { normalized, markers } = normalizeLooseStrong(source);
      if (markers.size > 0) {
        const reparsed = processor.parse(normalized);
        restoreLooseStrongMarkers(
          reparsed as unknown as Parameters<typeof restoreLooseStrongMarkers>[0],
          markers,
        );
        (tree as unknown as { children: unknown[] }).children = (
          reparsed as unknown as { children: unknown[] }
        ).children;
      }
      restoreLooseStrong(tree, source);
    };
  })
  .use(remarkRehype)
  .use(rehypeStringify);

it("renders adjacent Chinese and punctuation wrapped in explicit strong markers", () => {
  const body = "**QObject**类的**parent()**函数返回其父对象， **children()**函数返回其子对象。";
  const html = String(renderer.processSync(body));

  expect(html).toContain("<strong>QObject</strong>类的<strong>parent()</strong>函数");
  expect(html).toContain("<strong>children()</strong>函数");
  expect(html).not.toContain("**");
});

it("keeps multiple adjacent function names separate instead of bolding across them", () => {
  const body =
    "例如，函数**className()**可返回类的名称，函数**superClass()**可返回其父类的元对象，函数 **newInstance()**可以创建实例。";
  const html = String(renderer.processSync(body));

  expect(html).toContain("函数<strong>className()</strong>可返回");
  expect(html).toContain("函数<strong>superClass()</strong>可返回");
  expect(html).toContain("函数 <strong>newInstance()</strong>可以");
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
