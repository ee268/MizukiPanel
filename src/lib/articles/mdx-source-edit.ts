import {
  replaceArticleSegments,
  segmentArticleSource,
  type SegmentedArticle,
  type SourceSegment,
} from "./source-islands";

export interface SourceCardEditResult {
  source: string | null;
  reason: string | null;
}

export function isSourceCardSyntax(syntax: string | null): boolean {
  return syntax === "html" || Boolean(syntax?.startsWith("mdx"));
}

export function sourceCardLabel(segment: SourceSegment): string {
  switch (segment.syntax) {
    case "mdxjsEsm":
      return /^\s*export\b/.test(segment.raw) ? "MDX 导出" : "MDX 导入 / 模块代码";
    case "mdxJsxFlowElement":
    case "mdxJsxTextElement":
      return "MDX JSX 组件";
    case "mdxFlowExpression":
    case "mdxTextExpression":
      return "MDX 表达式";
    case "html":
      return "HTML 原文";
    default:
      return "MDX 原文";
  }
}

/** Reparse the whole draft so a local edit cannot consume adjacent source islands. */
export function validateSourceCardEdit(
  article: SegmentedArticle,
  segment: SourceSegment,
  draft: string,
): SourceCardEditResult {
  if (
    article.mode !== "hybrid" ||
    segment.mode !== "source" ||
    !isSourceCardSyntax(segment.syntax)
  ) {
    return { source: null, reason: "此片段不能在卡片中编辑" };
  }

  const newline = article.body.includes("\r\n") ? "\r\n" : "\n";
  const source = draft.replace(/\r\n|\r|\n/g, newline);
  if (!source.trim()) {
    return { source: null, reason: "源码片段不能为空；删除节点请使用完整源码" };
  }
  if (source === segment.raw) {
    return { source, reason: null };
  }

  const candidate = replaceArticleSegments(article, new Map([[segment.id, source]]));
  const reparsed = segmentArticleSource(candidate, article.format);
  if (reparsed.mode !== "hybrid") {
    return { source: null, reason: `MDX 解析失败：${reparsed.reason}` };
  }

  const original = article.segments.filter((part) => part.mode === "source");
  const updated = reparsed.segments.filter((part) => part.mode === "source");
  const changedIndex = original.findIndex((part) => part.id === segment.id);
  if (
    changedIndex < 0 ||
    original.length !== updated.length ||
    original.some(
      (part, index) =>
        part.syntax !== updated[index].syntax ||
        updated[index].raw !== (index === changedIndex ? source : part.raw),
    )
  ) {
    return {
      source: null,
      reason: "修改改变了节点边界、类型或相邻片段；请改用完整源码",
    };
  }

  return { source, reason: null };
}
