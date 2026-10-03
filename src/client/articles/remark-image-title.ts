import { $remark } from "@milkdown/kit/utils";

interface MarkdownNode {
  type: string;
  title?: string | null;
  children?: MarkdownNode[];
}

function normalizeImageTitle(node: MarkdownNode): void {
  if (node.type === "image" && node.title == null) {
    node.title = "";
  }

  for (const child of node.children ?? []) {
    normalizeImageTitle(child);
  }
}

// Milkdown's image schema requires a string title; Markdown images normally omit it.
export const remarkImageTitle = $remark("normalizeImageTitle", () => () => (tree) => {
  normalizeImageTitle(tree as MarkdownNode);
});
