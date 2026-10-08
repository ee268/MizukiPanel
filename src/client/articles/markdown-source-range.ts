import type { Mark, Node } from "@milkdown/kit/prose/model";
import type { Mapping } from "@milkdown/kit/prose/transform";

export interface MarkdownMarkRange {
  from: number;
  to: number;
  mark: Mark;
}

export type MarkdownSourceKind =
  "heading" | "link" | "strong" | "emphasis" | "strike_through" | "inlineCode";

export interface MarkdownSourceRange {
  from: number;
  to: number;
  kind: MarkdownSourceKind;
}

const inlineKinds: MarkdownSourceKind[] = [
  "link",
  "strong",
  "emphasis",
  "strike_through",
  "inlineCode",
];

// A single formatted span can contain several text nodes and inline images.
export function markdownMarkAt(
  doc: Node,
  position: number,
  name: string,
): MarkdownMarkRange | null {
  const resolved = doc.resolve(position);
  if (!resolved.parent.isTextblock) return null;
  const ranges: MarkdownMarkRange[] = [];

  resolved.parent.forEach((node, offset) => {
    const mark = node.marks.find((item) => item.type.name === name);
    if (!mark) return;
    const from = resolved.start() + offset;
    const last = ranges.at(-1);
    if (last && last.to === from && last.mark.eq(mark)) {
      last.to += node.nodeSize;
    } else {
      ranges.push({ from, to: from + node.nodeSize, mark });
    }
  });

  return ranges.find((range) => position >= range.from && position < range.to) ?? null;
}

export function markdownSourceAt(doc: Node, position: number): MarkdownSourceRange | null {
  const resolved = doc.resolve(position);
  if (resolved.parent.type.name === "heading") {
    return { from: resolved.before(), to: resolved.after(), kind: "heading" };
  }

  // Expand the outer formatted span so editing a nested mark cannot split it.
  const ranges = inlineKinds.flatMap((kind) => {
    const range = markdownMarkAt(doc, position, kind);
    return range ? [{ from: range.from, to: range.to, kind }] : [];
  });
  ranges.sort((left, right) => right.to - right.from - (left.to - left.from));
  return ranges[0] ?? null;
}

export function sourceContentBounds(range: MarkdownSourceRange) {
  const inset = range.kind === "heading" ? 1 : 0;
  return { from: range.from + inset, to: range.to - inset };
}

// Heading ID maintenance changes node attributes without changing its source.
export function mapUnchangedSource(
  range: MarkdownSourceRange,
  before: Node,
  after: Node,
  mapping: Mapping,
): MarkdownSourceRange | null {
  const mapped = {
    ...range,
    from: mapping.map(range.from, -1),
    to: mapping.map(range.to, 1),
  };
  const previousBounds = sourceContentBounds(range);
  const bounds = sourceContentBounds(mapped);
  if (bounds.from > bounds.to) return null;
  if (range.kind === "heading") {
    const previousHeading = before.nodeAt(range.from);
    const heading = after.nodeAt(mapped.from);
    if (
      heading?.type.name !== previousHeading?.type.name ||
      heading?.attrs.level !== previousHeading?.attrs.level
    ) {
      return null;
    }
  }
  const previousContent = before.slice(previousBounds.from, previousBounds.to).content;
  return previousContent.eq(after.slice(bounds.from, bounds.to).content) ? mapped : null;
}

export function sourceCursorOffset(raw: string, contentOffset: number): number {
  const headingPrefix = /^#{1,6}[ \t]+/.exec(raw);
  let prefix = headingPrefix?.[0].length ?? 0;
  if (!headingPrefix) {
    while (prefix < raw.length && "*_~`[".includes(raw[prefix])) prefix += 1;
  }
  return Math.min(raw.length, prefix + contentOffset);
}
