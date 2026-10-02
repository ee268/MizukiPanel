import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";

interface SyntaxNode {
  type: string;
  name?: string;
  attributes?: Record<string, string | null>;
  children?: SyntaxNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export interface WikiLink {
  kind: "wiki";
  raw: string;
  target: string;
  label: string;
}

export interface Spoiler {
  kind: "spoiler";
  raw: string;
  content: string;
}

export type InlineExtension = WikiLink | Spoiler;

const parser = unified().use(remarkParse).use(remarkDirective);

function validWikiTarget(target: string): boolean {
  const value = target.trim();
  const separator = value.indexOf("#");
  const page = separator < 0 ? value : value.slice(0, separator);
  const heading = separator < 0 ? "" : value.slice(separator + 1).trim();
  const normalized = page
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .replace(/\/+$/, "")
    .replace(/\.(?:md|mdx|markdown)$/i, "");
  const segments = normalized.split("/").filter(Boolean);
  const contentSegments = segments[0] === "posts" ? segments.slice(1) : segments;
  return (
    (contentSegments.length > 0 || heading.length > 0) &&
    (!page || contentSegments.length > 0) &&
    contentSegments.every((segment) => segment !== "." && segment !== "..")
  );
}

/** Match only syntax handled by Mizuki, leaving embeds and unknown directives protected. */
export function parseInlineExtension(raw: string): InlineExtension | null {
  const wiki = raw.match(/^\[\[([^\[\]\r\n]+)\]\]$/);
  if (wiki) {
    const separator = wiki[1].indexOf("|");
    const target = (separator < 0 ? wiki[1] : wiki[1].slice(0, separator)).trim();
    const label = separator < 0 ? "" : wiki[1].slice(separator + 1).trim();
    return validWikiTarget(target) ? { kind: "wiki", raw, target, label } : null;
  }

  const spoiler = raw.match(/^:spoiler\[([^\]\r\n]+)\]$/);
  if (!spoiler) {
    return null;
  }
  const tree = parser.parse(raw) as { children: SyntaxNode[] };
  const node = tree.children[0]?.children?.[0];
  if (
    tree.children.length !== 1 ||
    tree.children[0].type !== "paragraph" ||
    tree.children[0].children?.length !== 1 ||
    node?.type !== "textDirective" ||
    node.name !== "spoiler" ||
    Object.keys(node.attributes ?? {}).length > 0 ||
    node.position?.start.offset !== 0 ||
    node.position?.end.offset !== raw.length
  ) {
    return null;
  }
  return { kind: "spoiler", raw, content: spoiler[1] };
}

export function updateInlineExtension(
  extension: InlineExtension,
  values: { target?: string; label?: string; content?: string },
): string | null {
  const next =
    extension.kind === "wiki"
      ? `[[${values.target ?? extension.target}${(values.label ?? extension.label) ? `|${values.label ?? extension.label}` : ""}]]`
      : `:spoiler[${values.content ?? extension.content}]`;
  const parsed = parseInlineExtension(next);
  return parsed?.kind === extension.kind ? next : null;
}
