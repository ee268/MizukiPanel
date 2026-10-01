import { splitArticleSource } from "../../lib/articles/article-source";
import type { ArticleRecord } from "../types";
import type { FrontmatterRow } from "./types";

export function frontmatterChanged(rows: FrontmatterRow[], article: ArticleRecord): boolean {
  if (rows.length !== article.frontmatter.length) {
    return true;
  }

  return rows.some((row, index) => {
    const original = article.frontmatter[index];
    return (
      row.key !== original.key ||
      row.value !== original.value ||
      row.originalKey !== original.originalKey
    );
  });
}

export function draftBody(source: string): string | null {
  return splitArticleSource(source)?.body ?? null;
}

export function hasSourceHeaderChange(source: string, baseline: string): boolean {
  const draft = splitArticleSource(source);
  const original = splitArticleSource(baseline);
  if (!draft || !original) {
    return true;
  }

  return source.slice(0, draft.bodyStart) !== baseline.slice(0, original.bodyStart);
}

export function rebaseBody(nextSource: string, draftSource: string): string {
  const next = splitArticleSource(nextSource);
  const draft = splitArticleSource(draftSource);
  if (!next || !draft) {
    throw new Error("无法合并正文草稿，请改用完整源码模式");
  }

  return nextSource.slice(0, next.bodyStart) + draft.body;
}

export function preserveSegmentBoundary(
  original: string,
  markdown: string,
  leftInline = false,
  rightInline = false,
): string {
  if (!original.trim()) {
    return original + markdown.trim();
  }

  const leading = original.match(/^(?:\r?\n)*/)?.[0] ?? "";
  const trailing = original.match(/(?:\r?\n)*$/)?.[0] ?? "";
  const leftSpace = leftInline ? (original.match(/^[\t ]+/)?.[0] ?? "") : "";
  const rightSpace = rightInline ? (original.match(/[\t ]+$/)?.[0] ?? "") : "";
  const content = markdown.trim();
  return leading + leftSpace + content + rightSpace + trailing;
}
