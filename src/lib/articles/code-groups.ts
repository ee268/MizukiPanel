import remarkParse from "remark-parse";
import { unified } from "unified";
import { parseFencedCode, updateFencedCode, type FencedCode } from "./fenced-code";

interface GroupNode {
  type: string;
  children?: GroupNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export interface CodeGroupRange {
  start: number;
  end: number;
  syntax: "codeGroup";
}

export interface CodeGroupBlock extends FencedCode {
  start: number;
  end: number;
}

export interface CodeGroup {
  raw: string;
  header: string;
  labels: string[];
  blocks: CodeGroupBlock[];
  newline: string;
}

const parser = unified().use(remarkParse);

function nodeRaw(node: GroupNode, body: string): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined || end < start) {
    throw new Error("代码组节点缺少源码范围");
  }
  return body.slice(start, end);
}

function groupStart(node: GroupNode, body: string): boolean {
  return node.type === "paragraph" && /^:::[ \t]+code-group(?:[ \t]|$)/.test(nodeRaw(node, body));
}

function groupEnd(node: GroupNode, body: string): boolean {
  return node.type === "paragraph" && nodeRaw(node, body) === ":::";
}

/** Recognize the rehype-code-group syntax at root AST boundaries before Milkdown sees it. */
export function findCodeGroupRanges(tree: GroupNode, body: string): CodeGroupRange[] {
  const children = tree.children ?? [];
  const ranges: CodeGroupRange[] = [];
  for (let index = 0; index < children.length; index++) {
    if (!groupStart(children[index], body)) {
      continue;
    }
    const start = children[index].position?.start.offset;
    let closing = index + 1;
    while (closing < children.length && !groupEnd(children[closing], body)) {
      if (groupStart(children[closing], body)) {
        throw new Error("代码组存在嵌套或缺少结束标记，请使用完整源码编辑");
      }
      closing++;
    }
    const end = children[closing]?.position?.end.offset;
    if (start === undefined || end === undefined) {
      throw new Error("代码组缺少结束标记，请使用完整源码编辑");
    }
    ranges.push({ start, end, syntax: "codeGroup" });
    index = closing;
  }
  return ranges;
}

/** Structured editing is limited to groups with one fenced block per label. */
export function parseCodeGroup(raw: string): CodeGroup | null {
  const tree = parser.parse(raw) as GroupNode;
  const children = tree.children ?? [];
  const first = children[0];
  const last = children.at(-1);
  if (
    !first ||
    !last ||
    !groupStart(first, raw) ||
    !groupEnd(last, raw) ||
    first.position?.start.offset !== 0 ||
    last.position?.end.offset !== raw.length
  ) {
    return null;
  }
  const header = nodeRaw(first, raw);
  const headerMatch = header.match(/^:::[ \t]+code-group[ \t]+labels=\[([^\]\r\n]+)\][ \t]*$/);
  if (!headerMatch) {
    return null;
  }
  const labels = headerMatch[1].split(",").map((label) => label.trim());
  if (labels.some((label) => !label)) {
    return null;
  }
  const blocks: CodeGroupBlock[] = [];
  for (const node of children.slice(1, -1)) {
    if (node.type !== "code") {
      return null;
    }
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) {
      return null;
    }
    const block = parseFencedCode(raw.slice(start, end));
    if (!block) {
      return null;
    }
    blocks.push({ ...block, start, end });
  }
  if (blocks.length === 0 || blocks.length !== labels.length) {
    return null;
  }
  return { raw, header, labels, blocks, newline: raw.includes("\r\n") ? "\r\n" : "\n" };
}

export function updateCodeGroup(
  group: CodeGroup,
  changes: { labels?: string[]; blocks?: { meta: string; body: string }[] },
): string | null {
  const labels = changes.labels ?? group.labels;
  if (
    labels.length !== group.blocks.length ||
    (changes.blocks !== undefined && changes.blocks.length !== group.blocks.length) ||
    labels.some((label) => !label.trim() || /[,\]\r\n]/.test(label))
  ) {
    return null;
  }
  const labelsChanged = labels.some((label, index) => label !== group.labels[index]);
  let next = labelsChanged ? `::: code-group labels=[${labels.join(", ")}]` : group.header;
  let cursor = group.header.length;
  for (let index = 0; index < group.blocks.length; index++) {
    const block = group.blocks[index];
    const values = changes.blocks?.[index];
    const updated = values
      ? updateFencedCode(block, {
          ...(values.meta !== block.meta ? { meta: values.meta } : {}),
          ...(values.body !== block.body ? { body: values.body } : {}),
        })
      : block.raw;
    if (!updated) {
      return null;
    }
    next += group.raw.slice(cursor, block.start) + updated;
    cursor = block.end;
  }
  next += group.raw.slice(cursor);
  const parsed = parseCodeGroup(next);
  return parsed &&
    parsed.labels.every((label, index) => label === labels[index]) &&
    parsed.blocks.every(
      (block, index) =>
        block.meta === (changes.blocks?.[index]?.meta ?? group.blocks[index].meta) &&
        block.body ===
          (changes.blocks?.[index]?.body ?? group.blocks[index].body).replace(
            /\r?\n/g,
            block.newline,
          ),
    )
    ? next
    : null;
}
