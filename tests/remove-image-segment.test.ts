import { expect, it } from "vitest";
import { segmentArticleSource, replaceArticleSegments } from "../src/lib/articles/source-islands";
import { removeImageSegment } from "../src/client/articles/remove-image-segment";

const image = '<img src="https://example.com/image.png" />';
const parse = (body: string) => segmentArticleSource("---\r\ntitle: test\r\n---\r\n" + body, "md");

it("merges a deleted image with both Markdown neighbors and retains unsaved edits", () => {
  const article = parse("上文\n\n" + image + "\n\n下文\n");
  const target = article.segments.find((s) => s.raw.includes(image))!;
  const replacements = new Map(
    article.segments
      .filter((s) => s.mode === "editable")
      .map((s) => [s.id, s.raw.replace("上文", "上文已改").replace("下文", "下文已改")]),
  );
  const next = removeImageSegment(article, replacements, target, "图片前新正文\n\n图片后新正文");
  expect(next.article.segments).toHaveLength(1);
  expect(next.segment.mode).toBe("editable");
  expect(next.segment.id).toBeGreaterThan(Math.max(...article.segments.map((s) => s.id)));
  expect(replaceArticleSegments(next.article, next.replacements)).toBe(
    article.source
      .replace("上文", "上文已改")
      .replace("下文", "下文已改")
      .replace(image, "图片前新正文\n\n图片后新正文"),
  );
  expect(next.before).toContain("上文已改");
  expect(next.through).toContain("图片后新正文");
  const edited = new Map(next.replacements).set(next.segment.id, "合并后的正文\n");
  expect(replaceArticleSegments(next.article, edited)).toBe(
    article.source.slice(0, article.bodyStart) + "合并后的正文\n",
  );
});

it("keeps adjacent protected source islands and their draft bytes intact", () => {
  const article = parse(
    ":::note\n保留扩展\n:::\n\n" +
      image +
      '\n\n上文\n\n<img src="https://example.com/other.png" />\n',
  );
  const target = article.segments.find((s) => s.raw === image)!;
  const protectedSegment = article.segments[0];
  const replacements = new Map([
    [protectedSegment.id, protectedSegment.raw.replace("保留扩展", "扩展已改")],
  ]);
  const next = removeImageSegment(article, replacements, target, "");
  expect(next.article.segments[0]).toBe(protectedSegment);
  expect(replaceArticleSegments(next.article, next.replacements)).toBe(
    article.source.replace("保留扩展", "扩展已改").replace(image, ""),
  );
  const other = article.segments.find((s) => s.raw.includes("other.png"))!;
  expect(next.article.segments.find((s) => s.id === other.id)).toBe(other);
});

it("leaves a normal editable paragraph when the image is the only content", () => {
  const article = parse(image);
  const next = removeImageSegment(article, new Map(), article.segments[0], "");
  expect(next.article.segments).toHaveLength(1);
  expect(next.segment.mode).toBe("editable");
  expect(next.replacements.get(next.segment.id)).toBe("");
  expect(replaceArticleSegments(next.article, next.replacements)).toBe(
    article.source.slice(0, article.bodyStart),
  );
});
