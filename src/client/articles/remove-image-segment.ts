import type { SegmentedArticle, SourceSegment } from "../../lib/articles/source-islands";

/** Return a deleted HTML image to the surrounding Markdown editor. */
export function removeImageSegment(
  article: SegmentedArticle,
  replacements: ReadonlyMap<number, string>,
  image: SourceSegment,
  remaining: string,
) {
  const index = article.segments.findIndex((segment) => segment.id === image.id);
  if (index < 0) throw new Error("图片片段已变化，请重新打开文章");
  const first = article.segments[index - 1]?.mode === "editable" ? index - 1 : index;
  const last = article.segments[index + 1]?.mode === "editable" ? index + 1 : index;
  const joined = article.segments.slice(first, last + 1);
  const before = first < index ? (replacements.get(joined[0].id) ?? joined[0].raw) : "";
  const after = last > index ? (replacements.get(joined.at(-1)!.id) ?? joined.at(-1)!.raw) : "";
  const segment: SourceSegment = {
    ...joined[0],
    id: Math.max(...article.segments.map((item) => item.id)) + 1,
    mode: "editable",
    syntax: null,
    end: joined.at(-1)!.end,
    sourceEnd: joined.at(-1)!.sourceEnd,
    raw: article.body.slice(joined[0].start, joined.at(-1)!.end),
  };
  const nextReplacements = new Map(replacements);
  joined.forEach((item) => nextReplacements.delete(item.id));
  nextReplacements.set(segment.id, before + remaining + after);
  return {
    article: {
      ...article,
      segments: [...article.segments.slice(0, first), segment, ...article.segments.slice(last + 1)],
    },
    replacements: nextReplacements,
    segment,
    before,
    through: before + remaining,
  };
}
