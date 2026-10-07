interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

function splitUnparsedStrong(node: MarkdownNode, source: string): MarkdownNode[] {
  const value = node.value;
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (
    !value?.includes("**") ||
    start === undefined ||
    end === undefined ||
    source.slice(start, end) !== value
  ) {
    return [node];
  }

  const result: MarkdownNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(/\*\*([^*\r\n]+?)\*\*/g)) {
    const content = match[1];
    if (!content || content.trim() !== content) {
      continue;
    }
    const index = match.index;
    if (index > cursor) {
      result.push({ type: "text", value: value.slice(cursor, index) });
    }
    result.push({
      type: "strong",
      children: [{ type: "text", value: content }],
    });
    cursor = index + match[0].length;
  }
  if (cursor === 0) {
    return [node];
  }
  if (cursor < value.length) {
    result.push({ type: "text", value: value.slice(cursor) });
  }
  return result;
}

/** Restore explicit strong markers left as text by CommonMark's punctuation rules. */
export function restoreLooseStrong(tree: MarkdownNode, source: string): void {
  if (!tree.children) {
    return;
  }
  const children: MarkdownNode[] = [];
  for (const child of tree.children) {
    if (child.type === "text") {
      children.push(...splitUnparsedStrong(child, source));
    } else {
      restoreLooseStrong(child, source);
      children.push(child);
    }
  }
  tree.children = children;
}
