import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceSegmentEditor } from "../src/client/articles/SourceSegmentEditor";
import { parseHtmlImages } from "../src/lib/articles/html-images";
import { replaceArticleSegments, segmentArticleSource } from "../src/lib/articles/source-islands";

it("renders standalone HTML images while preserving their source segments", () => {
  const raw = '<img src="https://assets.example.com/1.png" alt="封面" style="zoom:50%;" />';
  const article = segmentArticleSource(`---\ntitle: Image\n---\n\n${raw}\n`, "md");
  const image = article.segments.find((segment) => segment.syntax === "html");
  expect(image?.raw).toBe(raw);
  expect(parseHtmlImages(raw)).toEqual([
    { src: "https://assets.example.com/1.png", alt: "封面", title: "", zoom: "50%" },
  ]);
  expect(replaceArticleSegments(article, new Map())).toBe(article.source);
});

it("treats invalid and unsafe image HTML as literal text", () => {
  expect(parseHtmlImages('<img src="javascript:alert(1)" />')).toBeNull();
  expect(parseHtmlImages('<img src="/images/a.png"><script>alert(1)</script>')).toBeNull();
  expect(parseHtmlImages('<img src="broken"')).toBeNull();
  expect(parseHtmlImages('<img src="/images/a.png" /><img src="/images/b.png" />')).toHaveLength(2);
  expect(parseHtmlImages('<p><img src="/images/a.png" alt="A" /></p>')).toHaveLength(1);
});

it("keeps parser failures as unchanged body text", () => {
  const source = "---\ntitle: Invalid\n---\n\n<Widget value={} />\n";
  const article = segmentArticleSource(source, "mdx");
  expect(article.mode).toBe("source");
  expect(article.segments[0].raw).toContain("<Widget value={} />");
  expect(replaceArticleSegments(article, new Map())).toBe(source);
});

it("shows an HTML image visually and unknown syntax as plain body text", () => {
  const imageArticle = segmentArticleSource(
    '---\ntitle: Image\n---\n\n<img src="https://example.com/a.png" alt="A" />\n',
    "md",
  );
  const imageSegment = imageArticle.segments.find((part) => part.syntax === "html")!;
  const imageMarkup = renderToStaticMarkup(
    createElement(SourceSegmentEditor, {
      articleId: "post.md",
      article: imageArticle,
      segment: imageSegment,
      readOnly: false,
      onChange: () => {},
      onValidityChange: () => {},
    }),
  );
  expect(imageMarkup).toContain("<img");
  expect(imageMarkup).toContain('src="https://example.com/a.png"');
  expect(imageMarkup.match(/<button\b/g)).toHaveLength(1);
  expect(imageMarkup).not.toContain("HTML 原文");

  const unknownArticle = segmentArticleSource(
    "---\ntitle: Unknown\n---\n\n:::unknown\ntext\n:::\n",
    "md",
  );
  const unknown = unknownArticle.segments.find((part) => part.syntax === "containerDirective")!;
  const unknownMarkup = renderToStaticMarkup(
    createElement(SourceSegmentEditor, {
      articleId: "post.md",
      article: unknownArticle,
      segment: unknown,
      readOnly: false,
      onChange: () => {},
      onValidityChange: () => {},
    }),
  );
  expect(unknownMarkup).toContain("<textarea");
  expect(unknownMarkup).toContain(":::unknown");
  expect(unknownMarkup).not.toContain("源码片段");
});

it("shows malformed image HTML as body text without an image", () => {
  const raw = '<img src="https://example.com/a.png" alt="A" /';
  const article = segmentArticleSource(`---\ntitle: Invalid image\n---\n\n${raw}\n`, "md");
  const fragment = article.segments.find((part) => part.raw.includes("<img"));
  expect(fragment).toBeDefined();
  expect(fragment?.mode).toBe("source");
  const markup = renderToStaticMarkup(
    createElement(SourceSegmentEditor, {
      articleId: "post.md",
      article,
      segment: fragment!,
      readOnly: false,
      onChange: () => {},
      onValidityChange: () => {},
    }),
  );
  expect(markup).toContain(raw.replaceAll("<", "&lt;").replaceAll('"', "&quot;"));
  expect(markup).not.toContain("<img");
  expect(markup).not.toContain("图片 HTML 源码");
  expect(markup).not.toContain("warning");
});
