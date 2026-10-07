import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceSegmentEditor } from "../src/client/articles/SourceSegmentEditor";
import { parseHtmlImages } from "../src/lib/articles/html-images";
import { parseQuotedHtmlImages, replaceQuotedText } from "../src/lib/articles/quoted-html-images";
import { collectSourceIslandEdits } from "../src/lib/articles/source-island-edits";
import { replaceArticleSegments, segmentArticleSource } from "../src/lib/articles/source-islands";
import { validateArticleBody } from "../src/lib/server/article-body-validation";

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

it("keeps quoted text and its HTML image in the same visual block", async () => {
  const quote = [
    "> 放个安装过程的动图，稍微大点，可能加载慢",
    ">",
    '> <img src="https://asserts.645429.xyz/qml_deploy/22.gif" alt="PixPin_2026-06-04_00-06-18" style="zoom: 67%;" />',
  ].join("\n");
  const source = `---\ntitle: QML项目部署并使用InnoSetup打包\n---\n\n${quote}\n\n---\n`;
  const article = segmentArticleSource(source, "md");
  const segment = article.segments.find((part) => part.syntax === "htmlImageQuote");

  expect(article.mode).toBe("hybrid");
  expect(segment?.raw).toBe(quote);
  expect(parseQuotedHtmlImages(quote)?.map((part) => part.kind)).toEqual(["text", "image"]);
  expect(parseQuotedHtmlImages(quote)?.[0]).toMatchObject({
    kind: "text",
    text: "放个安装过程的动图，稍微大点，可能加载慢\n",
  });
  const textPart = parseQuotedHtmlImages(quote)![0];
  if (textPart.kind !== "text") throw new Error("缺少引用文字");
  const editedQuote = replaceQuotedText(quote, textPart, "更新说明\n\n下一行");
  expect(editedQuote).toContain("> 更新说明\n>\n> 下一行\n> <img");
  expect(parseQuotedHtmlImages(editedQuote)?.[0]).toMatchObject({
    kind: "text",
    text: "更新说明\n\n下一行",
  });
  expect(replaceArticleSegments(article, new Map())).toBe(source);

  const markup = renderToStaticMarkup(
    createElement(SourceSegmentEditor, {
      articleId: "qml.md",
      article,
      segment: segment!,
      readOnly: false,
      onChange: () => {},
      onValidityChange: () => {},
    }),
  );
  expect(markup).toContain("<blockquote");
  expect(markup).toContain("放个安装过程的动图");
  expect(markup).toContain('aria-label="引用文字"');
  expect(markup).toContain('rows="2"');
  expect(markup).toContain("<img");
  expect(markup).toContain("22.gif");

  const changed = replaceArticleSegments(
    article,
    new Map([[segment!.id, quote.replace("22.gif", "updated.gif")]]),
  );
  const edits = collectSourceIslandEdits(source, changed, "md");
  await expect(
    validateArticleBody(source, changed.slice(article.bodyStart), "md", edits),
  ).resolves.toBe(changed);

  const changedText = replaceArticleSegments(article, new Map([[segment!.id, editedQuote]]));
  const textEdits = collectSourceIslandEdits(source, changedText, "md");
  await expect(
    validateArticleBody(source, changedText.slice(article.bodyStart), "md", textEdits),
  ).resolves.toBe(changedText);
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
