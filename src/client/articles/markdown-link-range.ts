import type { Mark, Node } from "@milkdown/kit/prose/model";

export interface MarkdownLinkRange {
  from: number;
  to: number;
  mark: Mark;
}

// One link can contain several text nodes (bold, italic, code, or an image).
export function markdownLinkAt(doc: Node, position: number): MarkdownLinkRange | null {
  const resolved = doc.resolve(position);
  if (!resolved.parent.isTextblock) return null;
  const ranges: MarkdownLinkRange[] = [];

  resolved.parent.forEach((node, offset) => {
    const mark = node.marks.find((item) => item.type.name === "link");
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
