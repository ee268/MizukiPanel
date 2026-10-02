import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { splitArticleSource } from "./article-source";

export type ArticleFormat = "md" | "mdx";
export type SegmentMode = "editable" | "source";

export interface SourceSegment {
  id: number;
  mode: SegmentMode;
  syntax: string | null;
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  raw: string;
}

export interface SegmentedArticle {
  format: ArticleFormat;
  mode: "hybrid" | "source";
  source: string;
  body: string;
  bodyStart: number;
  segments: SourceSegment[];
  reason: string | null;
}

interface SyntaxNode {
  type: string;
  children?: SyntaxNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
  lang?: string | null;
  meta?: string | null;
}

interface ProtectedRange {
  start: number;
  end: number;
  syntax: string;
}

const standardNodes = new Set([
  "root",
  "paragraph",
  "heading",
  "text",
  "emphasis",
  "strong",
  "delete",
  "link",
  "linkReference",
  "image",
  "imageReference",
  "definition",
  "blockquote",
  "list",
  "listItem",
  "thematicBreak",
  "break",
  "inlineCode",
  "code",
  "table",
  "tableRow",
  "tableCell",
  "footnoteDefinition",
  "footnoteReference",
]);

const protectedNodes = new Set([
  "html",
  "math",
  "inlineMath",
  "containerDirective",
  "leafDirective",
  "textDirective",
]);

const markdownParser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDirective);

const mdxParser = markdownParser().use(remarkMdx);

function offsets(node: SyntaxNode): { start: number; end: number } {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined || end < start) {
    throw new Error(`语法节点 ${node.type} 缺少有效的源码范围`);
  }
  return { start, end };
}

function protectedSyntax(node: SyntaxNode, body: string): string | null {
  if (protectedNodes.has(node.type) || node.type.startsWith("mdx")) return node.type;
  if (!standardNodes.has(node.type)) return `unknown:${node.type}`;

  if (node.type === "code") {
    const language = node.lang?.toLowerCase();
    if (language === "mermaid" || language === "plantuml" || node.meta?.trim()) {
      return `code:${language || "meta"}`;
    }
  }

  if (node.type === "blockquote") {
    const { start, end } = offsets(node);
    if (/^>[ \t]*\[![A-Z][A-Z0-9-]*\]/i.test(body.slice(start, end))) {
      return "githubAdmonition";
    }
  }

  return null;
}

function collectRanges(node: SyntaxNode, body: string, ranges: ProtectedRange[]): void {
  const syntax = protectedSyntax(node, body);
  if (syntax) {
    ranges.push({ ...offsets(node), syntax });
    return;
  }

  // Mizuki's Wiki Link plugin skips ordinary Markdown links and link references.
  if (node.type === "link" || node.type === "linkReference") {
    return;
  }

  if (node.type === "text") {
    const { start, end } = offsets(node);
    const raw = body.slice(start, end);
    const wikiRanges: ProtectedRange[] = [];
    for (const match of raw.matchAll(/!?\[\[[^\]\r\n]+\]\]/g)) {
      const matchStart = start + match.index;
      wikiRanges.push({
        start: matchStart,
        end: matchStart + match[0].length,
        syntax: "wikiLink",
      });
    }
    ranges.push(...wikiRanges);

    for (const match of raw.matchAll(/\[\[/g)) {
      const matchStart = start + match.index;
      if (wikiRanges.some((range) => range.start <= matchStart && range.end > matchStart)) {
        continue;
      }
      ranges.push({ start: matchStart, end, syntax: "unclosedWikiLink" });
      break;
    }
  }

  for (const child of node.children ?? []) collectRanges(child, body, ranges);
}

function segment(body: string, bodyStart: number, ranges: ProtectedRange[]): SourceSegment[] {
  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  const segments: SourceSegment[] = [];
  let cursor = 0;

  function append(mode: SegmentMode, syntax: string | null, start: number, end: number): void {
    segments.push({
      id: segments.length,
      mode,
      syntax,
      start,
      end,
      sourceStart: bodyStart + start,
      sourceEnd: bodyStart + end,
      raw: body.slice(start, end),
    });
  }

  for (const range of ranges) {
    if (range.start < cursor || range.end > body.length || range.end <= range.start) {
      throw new Error("语法节点源码范围重叠或超出正文");
    }
    if (range.start > cursor) append("editable", null, cursor, range.start);
    append("source", range.syntax, range.start, range.end);
    cursor = range.end;
  }

  if (cursor < body.length || segments.length === 0) {
    append("editable", null, cursor, body.length);
  }
  return segments;
}

function sourceFallback(
  source: string,
  body: string,
  bodyStart: number,
  format: ArticleFormat,
  reason: string,
): SegmentedArticle {
  return {
    format,
    mode: "source",
    source,
    body,
    bodyStart,
    reason,
    segments: [
      {
        id: 0,
        mode: "source",
        syntax: "wholeBody",
        start: 0,
        end: body.length,
        sourceStart: bodyStart,
        sourceEnd: source.length,
        raw: body,
      },
    ],
  };
}

/** Parse for editing only. The AST is never used to serialize article source. */
export function segmentArticleSource(source: string, format: ArticleFormat): SegmentedArticle {
  const parts = splitArticleSource(source);
  const body = parts?.body ?? source;
  const bodyStart = parts?.bodyStart ?? 0;
  if (!parts) return sourceFallback(source, body, bodyStart, format, "缺少 Frontmatter 边界");

  try {
    const parser = format === "mdx" ? mdxParser : markdownParser;
    const tree = parser.parse(body) as SyntaxNode;
    const ranges: ProtectedRange[] = [];
    collectRanges(tree, body, ranges);
    return {
      format,
      mode: "hybrid",
      source,
      body,
      bodyStart,
      segments: segment(body, bodyStart, ranges),
      reason: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知解析错误";
    return sourceFallback(source, body, bodyStart, format, reason);
  }
}

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
