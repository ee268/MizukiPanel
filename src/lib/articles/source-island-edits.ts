import { segmentArticleSource, type ArticleFormat } from "./source-islands";

export interface SourceIslandEdit {
  id: number;
  source: string;
}

/** Declare changed protected segments in the same order used by body validation. */
export function collectSourceIslandEdits(
  baseline: string,
  draft: string,
  format: ArticleFormat,
): SourceIslandEdit[] {
  const before = segmentArticleSource(baseline, format);
  const after = segmentArticleSource(draft, format);
  if (before.mode !== "hybrid" || after.mode !== "hybrid") {
    throw new Error("正文无法安全分段，请切换完整源码保存");
  }

  const original = before.segments.filter((segment) => segment.mode === "source");
  const updated = after.segments.filter((segment) => segment.mode === "source");
  if (
    original.length !== updated.length ||
    original.some((segment, index) => segment.syntax !== updated[index].syntax)
  ) {
    throw new Error("扩展语法片段结构已变化，请切换完整源码保存");
  }

  return original.flatMap((segment, index) =>
    segment.raw === updated[index].raw ? [] : [{ id: segment.id, source: updated[index].raw }],
  );
}
