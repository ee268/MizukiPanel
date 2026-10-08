import type { Node } from "@milkdown/kit/prose/model";
import type { Mapping } from "@milkdown/kit/prose/transform";
import type { MarkdownSourceRange } from "./markdown-source-range";

export interface SourceRepairRange extends MarkdownSourceRange {
  id: number;
}

export function mapSourceRepair(
  range: SourceRepairRange,
  mapping: Mapping,
): SourceRepairRange | null {
  const from = mapping.map(range.from, -1);
  const to = mapping.map(range.to, 1);
  return to > from ? { ...range, from, to } : null;
}

// Read only the literal fragment that previously came from source editing.
// Ordinary article text must never be reparsed as Markdown automatically.
export function sourceRepairText(doc: Node, range: SourceRepairRange): string | null {
  const from = doc.resolve(range.from);
  const to = doc.resolve(range.to);
  if (range.kind !== "heading" && (!from.sameParent(to) || !from.parent.isTextblock)) {
    return null;
  }
  const content = doc.slice(range.from, range.to).content;
  if (
    range.kind === "heading" &&
    (content.childCount !== 1 || content.firstChild?.type.name !== "paragraph")
  ) {
    return null;
  }
  let valid = true;
  content.descendants((node) => {
    if (
      node.marks.length ||
      (!node.isText && node.type.name !== "hardbreak" && node.type.name !== "paragraph")
    ) {
      valid = false;
    }
  });
  return valid
    ? content.textBetween(0, content.size, "\n", (node) =>
        node.type.name === "hardbreak" ? "\n" : "",
      )
    : null;
}
