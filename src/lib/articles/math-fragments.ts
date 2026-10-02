import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";

interface MathNode {
  type: string;
  value?: string;
  children?: MathNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export interface MathFragment {
  raw: string;
  mode: "inline" | "display";
  value: string;
  newline: string;
}

const parser = unified().use(remarkParse).use(remarkMath);

export function parseMathFragment(raw: string): MathFragment | null {
  const tree = parser.parse(raw) as { children: MathNode[] };
  const root = tree.children[0];
  const node = root?.type === "paragraph" ? root.children?.[0] : root;
  if (
    tree.children.length !== 1 ||
    !node ||
    node.position?.start.offset !== 0 ||
    node.position?.end.offset !== raw.length
  ) {
    return null;
  }

  if (
    node.type === "inlineMath" &&
    root.type === "paragraph" &&
    root.children?.length === 1 &&
    /^\$[^\r\n]+\$$/.test(raw)
  ) {
    return { raw, mode: "inline", value: node.value ?? "", newline: "" };
  }

  if (node.type === "math" && root.type === "math") {
    const match = raw.match(/^\$\$(\r?\n)([\s\S]*?)(\r?\n)\$\$$/);
    if (match && match[1] === match[3] && match[2].trim()) {
      return { raw, mode: "display", value: match[2], newline: match[1] };
    }
  }
  return null;
}

export function updateMathFragment(fragment: MathFragment, value: string): string | null {
  const normalized =
    fragment.mode === "display" ? value.replace(/\r?\n/g, fragment.newline) : value;
  const next =
    fragment.mode === "inline"
      ? `$${normalized}$`
      : `$$${fragment.newline}${normalized}${fragment.newline}$$`;
  const parsed = parseMathFragment(next);
  return parsed?.mode === fragment.mode && parsed.value === normalized ? next : null;
}
