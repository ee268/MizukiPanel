import type { SegmentedArticle } from "./source-islands";

/** Apply only explicitly changed ranges; every other UTF-16 source slice stays intact. */
export function replaceArticleSegments(
  article: SegmentedArticle,
  replacements: ReadonlyMap<number, string>,
): string {
  const known = new Set(article.segments.map((segment) => segment.id));
  for (const [id, replacement] of replacements) {
    if (!known.has(id) || typeof replacement !== "string") {
      throw new Error("替换内容必须对应已解析的正文片段");
    }
  }

  let cursor = 0;
  let body = "";
  for (const segment of article.segments) {
    if (
      segment.start !== cursor ||
      segment.raw !== article.body.slice(segment.start, segment.end)
    ) {
      throw new Error("正文片段已变化，请重新解析文章");
    }
    body += replacements.get(segment.id) ?? segment.raw;
    cursor = segment.end;
  }
  if (cursor !== article.body.length) throw new Error("正文片段未覆盖完整文章");
  return article.source.slice(0, article.bodyStart) + body;
}
