import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

interface SyntaxNode {
  type: string;
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export interface GithubAlert {
  raw: string;
  type: string;
  title: string;
  body: string;
  newline: string;
  firstLine: string;
  tailRaw: string;
  prefix: string;
}

const parser = unified().use(remarkParse).use(remarkGfm);
export const githubAlertTypes = [
  "NOTE",
  "ABSTRACT",
  "SUMMARY",
  "TLDR",
  "INFO",
  "TODO",
  "TIP",
  "HINT",
  "IMPORTANT",
  "SUCCESS",
  "CHECK",
  "DONE",
  "QUESTION",
  "HELP",
  "FAQ",
  "WARNING",
  "CAUTION",
  "ATTENTION",
  "FAILURE",
  "FAIL",
  "MISSING",
  "DANGER",
  "ERROR",
  "BUG",
  "EXAMPLE",
  "QUOTE",
  "CITE",
] as const;
const supportedTypes = new Set<string>(githubAlertTypes);

export function parseGithubAlert(raw: string): GithubAlert | null {
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  if (raw.includes("\r") && newline === "\n") {
    return null;
  }
  const lines = raw.split(newline);
  const firstLine = lines[0];
  const declaration = firstLine.match(/^( {0,3}>[ \t]*)\[!([\w-]+)\](?:[ \t]+([^\r\n]+))?$/);
  const type = declaration?.[2]?.toUpperCase() ?? "";
  if (
    !declaration ||
    !supportedTypes.has(type) ||
    lines.length < 2 ||
    lines.slice(1).some((line) => !/^>[ \t]?/.test(line))
  ) {
    return null;
  }
  const body = lines
    .slice(1)
    .map((line) => line.replace(/^>[ \t]?/, ""))
    .join(newline);
  if (!body.trim()) {
    return null;
  }
  const tree = parser.parse(raw) as { children: SyntaxNode[] };
  const node = tree.children[0];
  if (
    tree.children.length !== 1 ||
    node?.type !== "blockquote" ||
    node.position?.start.offset !== 0 ||
    node.position?.end.offset !== raw.length
  ) {
    return null;
  }
  return {
    raw,
    type,
    title: declaration[3]?.trim() ?? "",
    body,
    newline,
    firstLine,
    tailRaw: raw.slice(firstLine.length + newline.length),
    prefix: declaration[1],
  };
}

export function updateGithubAlert(
  alert: GithubAlert,
  changes: { type?: string; title?: string; body?: string },
): string | null {
  const type = (changes.type ?? alert.type).toUpperCase();
  const title = changes.title ?? alert.title;
  const body = changes.body ?? alert.body;
  const normalizedBody = body.replace(/\r?\n/g, alert.newline);
  const firstLine =
    changes.type === undefined && changes.title === undefined
      ? alert.firstLine
      : `${alert.prefix}[!${type}]${title ? ` ${title}` : ""}`;
  const tail =
    changes.body === undefined
      ? alert.tailRaw
      : normalizedBody
          .split(/\r?\n/)
          .map((line) => (line ? `> ${line}` : ">"))
          .join(alert.newline);
  const next = `${firstLine}${alert.newline}${tail}`;
  const parsed = parseGithubAlert(next);
  if (
    !parsed ||
    parsed.type !== type ||
    parsed.title !== title.trim() ||
    parsed.body !== normalizedBody
  ) {
    return null;
  }
  return next;
}
