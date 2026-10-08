import { expect, it } from "vitest";
import { parseHtmlImages, removeHtmlImage } from "../src/lib/articles/html-images";
import { parseQuotedHtmlImages, replaceQuotedText } from "../src/lib/articles/quoted-html-images";
import { collectSourceIslandEdits } from "../src/lib/articles/source-island-edits";
import { replaceArticleSegments, segmentArticleSource } from "../src/lib/articles/source-islands";
import { validateArticleBody } from "../src/lib/server/article-body-validation";

it("removes only the selected HTML image while preserving wrappers and other images", () => {
  const first = '<img src="one.jpg" alt="第一张" />';
  const second = '<img src="two.jpg" alt="第二张" />';
  const raw = `<figure>\n${first}\n${second}\n</figure>`;
  const removed = removeHtmlImage(raw, 0);
  expect(removed).toBe(`<figure>\n\n${second}\n</figure>`);
  expect(parseHtmlImages(removed)?.[0].alt).toBe("第二张");
  expect(removeHtmlImage(removed, 0)).toBe("");
});

it("skips img-like strings inside wrapper attributes and rejects invalid selection indices", () => {
  const raw = '<a title="<img src=\'fake.jpg\'>"><img src="one.jpg" /><img src="two.jpg" /></a>';
  expect(removeHtmlImage(raw, 0)).toBe(
    '<a title="<img src=\'fake.jpg\'>"><img src="two.jpg" /></a>',
  );
  expect(removeHtmlImage(raw, -1)).toBe(raw);
  expect(removeHtmlImage(raw, 2)).toBe(raw);
  expect(removeHtmlImage("普通正文", 0)).toBe("普通正文");
});

it("preserves neighboring text and selects full-source saving when the last HTML image is deleted", () => {
  const raw = '<img src="https://assets.example.com/one.jpg" alt="图片" />';
  const source = `---\ntitle: 图片删除\n---\n\n前文。\n\n${raw}\n\n后文。\n`;
  const article = segmentArticleSource(source, "md");
  const segment = article.segments.find((part) => part.raw === raw)!;
  const changed = replaceArticleSegments(article, new Map([[segment.id, removeHtmlImage(raw, 0)]]));
  expect(changed).toContain("前文。");
  expect(changed).toContain("后文。");
  expect(changed).not.toContain("<img");
  // ArticleEditor catches this structural change and calls the full-source save route.
  expect(() => collectSourceIslandEdits(source, changed, "md")).toThrow("扩展语法片段结构已变化");
});

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
