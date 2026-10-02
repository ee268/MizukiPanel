import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";

type DirectiveKind = "admonition" | "github" | "grid";

interface DirectiveNode {
  type: string;
  name?: string;
  attributes?: Record<string, string | null>;
  children?: DirectiveNode[];
  url?: string;
  alt?: string;
  title?: string | null;
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export interface DirectiveImage {
  url: string;
  alt: string;
  title: string | null;
}

export interface MizukiDirective {
  kind: DirectiveKind;
  name: string;
  raw: string;
  header: string;
  title: string;
  repo: string;
  columns: string;
  aspect: string;
  fit: string;
  body: string;
  images: DirectiveImage[];
  newline: string;
  closing: string;
  bodyRaw: string;
}

export type DirectiveChanges = Partial<
  Pick<MizukiDirective, "title" | "repo" | "columns" | "aspect" | "fit" | "body">
>;

const parser = unified().use(remarkParse).use(remarkDirective);
const admonitions = new Set([
  "note",
  "tip",
  "important",
  "warning",
  "caution",
  "info",
  "abstract",
  "summary",
  "tldr",
  "todo",
  "hint",
  "success",
  "check",
  "done",
  "question",
  "help",
  "faq",
  "failure",
  "fail",
  "missing",
  "danger",
  "error",
  "bug",
  "example",
  "quote",
  "cite",
]);

function onlyAttributes(node: DirectiveNode, allowed: string[]): boolean {
  return Object.keys(node.attributes ?? {}).every((key) => allowed.includes(key));
}

function collectImages(node: DirectiveNode, images: DirectiveImage[]): void {
  if (node.type === "image") {
    images.push({
      url: node.url ?? "",
      alt: node.alt ?? "",
      title: node.title ?? null,
    });
  }
  for (const child of node.children ?? []) {
    collectImages(child, images);
  }
}

function containerParts(raw: string) {
  const firstBreak = raw.indexOf("\n");
  const lastBreak = raw.lastIndexOf("\n");
  if (firstBreak < 0 || lastBreak <= firstBreak) {
    return null;
  }

  const newline = raw[firstBreak - 1] === "\r" ? "\r\n" : "\n";
  const header = raw.slice(0, firstBreak + 1 - newline.length);
  const closing = raw.slice(lastBreak + 1);
  const bodyRaw = raw.slice(firstBreak + 1, lastBreak + 1);
  if (!/^:::[ \t]*$/.test(closing) || !bodyRaw.endsWith(newline)) {
    return null;
  }

  return {
    header,
    closing,
    newline,
    bodyRaw,
    body: bodyRaw.slice(0, -newline.length),
  };
}

/** Only expose directives whose complete source range and attributes are understood. */
export function parseMizukiDirective(raw: string): MizukiDirective | null {
  const tree = parser.parse(raw) as { children: DirectiveNode[] };
  const node = tree.children[0];
  if (
    tree.children.length !== 1 ||
    !node ||
    node.position?.start.offset !== 0 ||
    node.position.end.offset !== raw.length
  ) {
    return null;
  }

  const name = node.name ?? "";
  const attributes = node.attributes ?? {};
  const base = {
    name,
    raw,
    title: "",
    repo: "",
    columns: "",
    aspect: "",
    fit: "",
    body: "",
    images: [] as DirectiveImage[],
    newline: "",
    closing: "",
    bodyRaw: "",
  };

  if (name === "github" && (node.type === "leafDirective" || node.type === "containerDirective")) {
    if (
      !/^:{2,3}github\{[^{}\r\n]*\}$/.test(raw) ||
      !onlyAttributes(node, ["repo"]) ||
      !/^[\w.-]+\/[\w.-]+$/.test(attributes.repo ?? "") ||
      (node.children?.length ?? 0) > 0
    ) {
      return null;
    }
    return { ...base, kind: "github", header: raw, repo: attributes.repo ?? "" };
  }

  if (node.type !== "containerDirective") {
    return null;
  }
  const parts = containerParts(raw);
  if (!parts) {
    return null;
  }

  if (admonitions.has(name)) {
    const match = parts.header.match(/^:::[a-z]+(?:\[([^\]\r\n]*)\]|\{title="([^"\r\n]*)"\})?$/);
    if (
      !match ||
      !onlyAttributes(node, ["title"]) ||
      !parts.body.trim() ||
      !node.children?.length
    ) {
      return null;
    }
    const title = match[1] ?? attributes.title ?? "";
    return { ...base, ...parts, kind: "admonition", title };
  }

  if (name === "grid") {
    if (
      !/^:::grid(?:\{[^{}\r\n]*\})?$/.test(parts.header) ||
      !onlyAttributes(node, ["columns", "aspect", "fit"])
    ) {
      return null;
    }
    const columns = attributes.columns ?? "";
    const aspect = attributes.aspect ?? "";
    const fit = attributes.fit ?? "";
    const ratio = aspect.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
    if (
      (columns !== "" && !/^[1-6]$/.test(columns)) ||
      (aspect !== "" && (!ratio || Number(ratio[1]) <= 0 || Number(ratio[2]) <= 0)) ||
      (fit !== "" && fit !== "cover" && fit !== "contain")
    ) {
      return null;
    }
    const images: DirectiveImage[] = [];
    for (const child of node.children ?? []) {
      collectImages(child, images);
    }
    if (images.length === 0) {
      return null;
    }
    return {
      ...base,
      ...parts,
      kind: "grid",
      columns,
      aspect,
      fit,
      images,
    };
  }

  return null;
}

function encodeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("}", "&#125;");
}

function attribute(name: string, value: string): string {
  return `${name}="${encodeAttribute(value)}"`;
}

/** Rewrite only the edited directive; adjacent Markdown and other islands are untouched. */
export function updateMizukiDirective(
  directive: MizukiDirective,
  changes: DirectiveChanges,
): string | null {
  const title = changes.title ?? directive.title;
  const repo = changes.repo ?? directive.repo;
  const columns = changes.columns ?? directive.columns;
  const aspect = changes.aspect ?? directive.aspect;
  const fit = changes.fit ?? directive.fit;
  const body = changes.body ?? directive.body;
  let header = directive.header;

  if (directive.kind === "admonition" && changes.title !== undefined) {
    header = title ? `:::${directive.name}{${attribute("title", title)}}` : `:::${directive.name}`;
  } else if (directive.kind === "github" && changes.repo !== undefined) {
    const marker = directive.header.startsWith(":::") ? ":::" : "::";
    header = `${marker}github{${attribute("repo", repo)}}`;
  } else if (
    directive.kind === "grid" &&
    (changes.columns !== undefined || changes.aspect !== undefined || changes.fit !== undefined)
  ) {
    const values = [
      columns ? attribute("columns", columns) : "",
      aspect ? attribute("aspect", aspect) : "",
      fit ? attribute("fit", fit) : "",
    ].filter(Boolean);
    header = values.length ? `:::grid{${values.join(" ")}}` : ":::grid";
  }

  const bodyRaw = changes.body === undefined ? directive.bodyRaw : body + directive.newline;
  const next =
    directive.kind === "github"
      ? header
      : `${header}${directive.newline}${bodyRaw}${directive.closing}`;
  const parsed = parseMizukiDirective(next);
  if (
    !parsed ||
    parsed.kind !== directive.kind ||
    parsed.name !== directive.name ||
    parsed.title !== title ||
    parsed.repo !== repo ||
    parsed.columns !== columns ||
    parsed.aspect !== aspect ||
    parsed.fit !== fit ||
    parsed.body !== body
  ) {
    return null;
  }
  return next;
}
