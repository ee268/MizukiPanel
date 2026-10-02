import remarkParse from "remark-parse";
import { unified } from "unified";

interface CodeNode {
  type: string;
  lang?: string | null;
  meta?: string | null;
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export interface FencedCode {
  raw: string;
  lang: string;
  meta: string;
  body: string;
  header: string;
  bodyRaw: string;
  closing: string;
  newline: string;
  prefix: string;
  fence: string;
}

const parser = unified().use(remarkParse);

export function parseFencedCode(raw: string): FencedCode | null {
  const firstBreak = raw.indexOf("\n");
  const lastBreak = raw.lastIndexOf("\n");
  if (firstBreak < 0 || lastBreak <= firstBreak) {
    return null;
  }
  const newline = raw[firstBreak - 1] === "\r" ? "\r\n" : "\n";
  const header = raw.slice(0, firstBreak + 1 - newline.length);
  const opening = header.match(/^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/);
  const closing = raw.slice(lastBreak + 1);
  if (!opening || !new RegExp(`^${opening[2][0]}{${opening[2].length},}[ \\t]*$`).test(closing)) {
    return null;
  }
  const bodyRaw = raw.slice(firstBreak + 1, lastBreak + 1);
  if (!bodyRaw.endsWith(newline)) {
    return null;
  }
  const tree = parser.parse(raw) as { children: CodeNode[] };
  const node = tree.children[0];
  if (
    tree.children.length !== 1 ||
    node?.type !== "code" ||
    node.position?.start.offset !== 0 ||
    node.position?.end.offset !== raw.length
  ) {
    return null;
  }
  return {
    raw,
    lang: node.lang ?? "",
    meta: node.meta ?? "",
    body: bodyRaw.slice(0, -newline.length),
    header,
    bodyRaw,
    closing,
    newline,
    prefix: opening[1],
    fence: opening[2],
  };
}

export function updateFencedCode(
  block: FencedCode,
  changes: { meta?: string; body?: string },
): string | null {
  const meta = changes.meta ?? block.meta;
  const body =
    changes.body === undefined ? block.body : changes.body.replace(/\r?\n/g, block.newline);
  const header =
    changes.meta === undefined
      ? block.header
      : `${block.prefix}${block.fence}${block.lang}${meta ? ` ${meta}` : ""}`;
  const bodyRaw = changes.body === undefined ? block.bodyRaw : body + block.newline;
  const next = `${header}${block.newline}${bodyRaw}${block.closing}`;
  const parsed = parseFencedCode(next);
  if (!parsed || parsed.lang !== block.lang || parsed.meta !== meta || parsed.body !== body) {
    return null;
  }
  return next;
}
