import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { SourceSegment } from "./source-islands";

interface Position {
  start: { offset?: number };
  end: { offset?: number };
}

interface MdxAttributeNode {
  type: string;
  name?: string;
  value?: string | null | object;
  position?: Position;
}

interface MdxNode {
  type: string;
  name?: string | null;
  attributes?: MdxAttributeNode[];
  children?: MdxNode[];
  position?: Position;
}

export interface StaticMdxAttribute {
  index: number;
  name: string;
  kind: "string" | "boolean";
  value: string | boolean;
  start: number;
  end: number;
  valueStart: number | null;
  valueEnd: number | null;
  quote: '"' | "'" | null;
}

export interface MdxComponent {
  raw: string;
  name: string;
  syntax: string;
  attributes: StaticMdxAttribute[];
  dynamicAttributes: string[];
}

const parser = unified().use(remarkParse).use(remarkMdx);

function jsxNode(raw: string): MdxNode | null {
  try {
    const tree = parser.parse(raw) as MdxNode;
    const root = tree.children?.[0];
    if (!root || tree.children?.length !== 1) return null;
    const node = root.type === "paragraph" ? root.children?.[0] : root;
    if (
      !node ||
      (root.type === "paragraph" && root.children?.length !== 1) ||
      node.position?.start.offset !== 0 ||
      node.position?.end.offset !== raw.length
    ) {
      return null;
    }
    return node;
  } catch {
    return null;
  }
}

function valueSpan(
  raw: string,
  start: number,
  end: number,
): {
  start: number;
  end: number;
  quote: '"' | "'";
} | null {
  const attribute = raw.slice(start, end);
  const equals = attribute.indexOf("=");
  if (equals < 0) return null;
  const valueOffset = attribute.slice(equals + 1).search(/\S/);
  if (valueOffset < 0) return null;
  const opening = equals + 1 + valueOffset;
  const quote = attribute[opening];
  if ((quote !== '"' && quote !== "'") || attribute.at(-1) !== quote) return null;
  return { start: start + opening + 1, end: end - 1, quote };
}

export function parseMdxComponent(
  segment: Pick<SourceSegment, "raw" | "syntax">,
): MdxComponent | null {
  if (segment.syntax !== "mdxJsxFlowElement" && segment.syntax !== "mdxJsxTextElement") {
    return null;
  }
  const node = jsxNode(segment.raw);
  if (
    (node?.type !== "mdxJsxFlowElement" && node?.type !== "mdxJsxTextElement") ||
    !node.name ||
    !/^[A-Z][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(node.name)
  ) {
    return null;
  }

  const attributes: StaticMdxAttribute[] = [];
  const dynamicAttributes: string[] = [];
  const names = new Set<string>();
  for (const [index, item] of (node.attributes ?? []).entries()) {
    const start = item.position?.start.offset;
    const end = item.position?.end.offset;
    if (start === undefined || end === undefined || end <= start) return null;
    if (
      item.type !== "mdxJsxAttribute" ||
      !item.name ||
      (item.value !== null && typeof item.value !== "string")
    ) {
      dynamicAttributes.push(segment.raw.slice(start, end));
      continue;
    }
    if (names.has(item.name)) return null;
    names.add(item.name);
    const kind = item.value === null ? "boolean" : "string";
    const span = kind === "string" ? valueSpan(segment.raw, start, end) : null;
    if (kind === "string" && !span) {
      dynamicAttributes.push(segment.raw.slice(start, end));
      continue;
    }
    attributes.push({
      index,
      name: item.name,
      kind,
      value: item.value ?? true,
      start,
      end,
      valueStart: span?.start ?? null,
      valueEnd: span?.end ?? null,
      quote: span?.quote ?? null,
    });
  }

  return {
    raw: segment.raw,
    name: node.name,
    syntax: segment.syntax,
    attributes,
    dynamicAttributes,
  };
}

function encodeAttributeValue(value: string, quote: '"' | "'"): string {
  const encoded = value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return quote === '"' ? encoded.replace(/"/g, "&quot;") : encoded.replace(/'/g, "&#39;");
}

/** Apply only changed attribute ranges from the original component text. */
export function updateMdxComponent(
  component: MdxComponent,
  values: ReadonlyMap<number, string | boolean>,
): string | null {
  const changes: Array<{ start: number; end: number; source: string }> = [];
  for (const attribute of component.attributes) {
    const value = values.get(attribute.index) ?? attribute.value;
    if (value === attribute.value) continue;
    if (attribute.kind === "boolean") {
      if (typeof value !== "boolean") return null;
      if (!value) changes.push({ start: attribute.start, end: attribute.end, source: "" });
      continue;
    }
    if (
      typeof value !== "string" ||
      /[\r\n]/.test(value) ||
      attribute.valueStart === null ||
      attribute.valueEnd === null ||
      !attribute.quote
    ) {
      return null;
    }
    changes.push({
      start: attribute.valueStart,
      end: attribute.valueEnd,
      source: encodeAttributeValue(value, attribute.quote),
    });
  }
  for (const index of values.keys()) {
    if (!component.attributes.some((attribute) => attribute.index === index)) return null;
  }

  let source = component.raw;
  for (const change of changes.sort((left, right) => right.start - left.start)) {
    source = source.slice(0, change.start) + change.source + source.slice(change.end);
  }
  const parsed = parseMdxComponent({ raw: source, syntax: component.syntax });
  if (!parsed || parsed.name !== component.name) return null;
  for (const attribute of component.attributes) {
    const expected = values.get(attribute.index) ?? attribute.value;
    const matching = parsed.attributes.find((item) => item.name === attribute.name);
    if (expected === false && attribute.kind === "boolean") {
      if (matching) return null;
    } else if (!matching || matching.value !== expected) {
      return null;
    }
  }
  return source;
}
