import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { splitArticleSource } from "../articles/article-source";
import {
  segmentArticleSource,
  type ArticleFormat,
  type SegmentedArticle,
} from "../articles/source-islands";
import { ArticleValidationError } from "./article-format";

export interface SourceIslandEdit {
  id: number;
  source: string;
}

const markdownRenderer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDirective)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

function normalizeNewlines(body: string, original: string, newline: "\n" | "\r\n"): string {
  if (body === original) return body;

  const hasCrLf = original.includes("\r\n");
  const hasBareLf = /(?<!\r)\n/.test(original);
  const hasBareCr = /\r(?!\n)/.test(original);
  if (hasBareCr || (hasCrLf && hasBareLf)) {
    throw new ArticleValidationError("原正文使用混合换行，请通过完整源码模式编辑");
  }

  return body.replace(/\r\n|\r|\n/g, newline);
}

function checkSourceIslands(
  before: SegmentedArticle,
  after: SegmentedArticle,
  edits: readonly SourceIslandEdit[],
): void {
  if (before.mode !== "hybrid" || after.mode !== "hybrid") {
    throw new ArticleValidationError(
      "正文无法安全分段，请通过完整源码模式编辑：" + (after.reason ?? before.reason),
    );
  }

  const original = before.segments.filter((segment) => segment.mode === "source");
  const candidate = after.segments.filter((segment) => segment.mode === "source");
  const replacements = new Map<number, string>();
  for (const edit of edits) {
    if (
      !edit ||
      !Number.isInteger(edit.id) ||
      typeof edit.source !== "string" ||
      replacements.has(edit.id) ||
      !original.some((segment) => segment.id === edit.id)
    ) {
      throw new ArticleValidationError("源码片段修改参数无效");
    }
    replacements.set(edit.id, edit.source);
  }

  if (original.length !== candidate.length) {
    throw new ArticleValidationError("正文中的源码片段数量发生变化，请通过完整源码模式编辑");
  }
  for (let index = 0; index < original.length; index++) {
    const expected = replacements.get(original[index].id) ?? original[index].raw;
    if (candidate[index].syntax !== original[index].syntax || candidate[index].raw !== expected) {
      throw new ArticleValidationError("未声明的源码片段发生变化，请通过完整源码模式编辑");
    }
  }
}

/** Validate an in-memory body before the storage layer acquires its write lock. */
export async function validateArticleBody(
  currentSource: string,
  body: string,
  format: ArticleFormat,
  edits: readonly SourceIslandEdit[] = [],
): Promise<string> {
  const parts = splitArticleSource(currentSource);
  if (!parts) throw new ArticleValidationError("文章缺少有效 Frontmatter，请通过完整源码模式修复");

  const normalizedBody = normalizeNewlines(body, parts.body, parts.newline);
  const normalizedEdits = edits.map((edit) =>
    edit && typeof edit.source === "string"
      ? { ...edit, source: edit.source.replace(/\r\n|\r|\n/g, parts.newline) }
      : edit,
  );
  const nextSource = currentSource.slice(0, parts.bodyStart) + normalizedBody;
  const before = segmentArticleSource(currentSource, format);
  const after = segmentArticleSource(nextSource, format);
  checkSourceIslands(before, after, normalizedEdits);

  if (format === "md") {
    try {
      await markdownRenderer.process(normalizedBody);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "未知渲染错误";
      throw new ArticleValidationError("Markdown 正文无法渲染：" + detail);
    }
  }

  return nextSource;
}
