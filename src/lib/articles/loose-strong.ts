interface MarkdownNode {
  type: string;
  value?: string;
  alt?: string | null;
  title?: string | null;
  url?: string;
  label?: string;
  identifier?: string;
  name?: string;
  children?: MarkdownNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

const stringFields = ["value", "alt", "title", "url", "label", "identifier", "name"] as const;
const adjacentClosingMarker = /\*\*([^*\r\n]+?[)\]}!?.,;:，。！？、])\*\*(?=[\p{L}\p{N}])/gu;

/** Substitute one punctuation character without shifting any source offsets. */
export function normalizeLooseStrong(source: string): {
  normalized: string;
  markers: Map<string, string>;
} {
  const markers = new Map<string, string>();
  const substitutions = new Map<string, string>();
  let nextMarker = 0xe000;
  let cursor = 0;
  let normalized = "";

  for (const match of source.matchAll(adjacentClosingMarker)) {
    const punctuation = match[1].at(-1)!;
    let marker = substitutions.get(punctuation);
    if (!marker) {
      while (nextMarker <= 0xf8ff && source.includes(String.fromCharCode(nextMarker))) {
        nextMarker++;
      }
      if (nextMarker > 0xf8ff) {
        return { normalized: source, markers: new Map() };
      }
      marker = String.fromCharCode(nextMarker++);
      substitutions.set(punctuation, marker);
      markers.set(marker, punctuation);
    }
    const punctuationIndex = match.index + 2 + match[1].length - 1;
    normalized += source.slice(cursor, punctuationIndex) + marker;
    cursor = punctuationIndex + 1;
  }

  return { normalized: cursor ? normalized + source.slice(cursor) : source, markers };
}

/** Return parsed text to its original bytes before any Markdown transformer runs. */
export function restoreLooseStrongMarkers(node: MarkdownNode, markers: Map<string, string>): void {
  if (markers.size === 0) {
    return;
  }
  for (const field of stringFields) {
    const value = node[field];
    if (typeof value !== "string") {
      continue;
    }
    let restored = value;
    for (const [marker, punctuation] of markers) {
      restored = restored.replaceAll(marker, punctuation);
    }
    (node as unknown as Record<string, unknown>)[field] = restored;
  }
  for (const child of node.children ?? []) {
    restoreLooseStrongMarkers(child, markers);
  }
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
