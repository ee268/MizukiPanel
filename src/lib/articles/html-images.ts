import { validImageReference } from "./media-preview-url";

export interface HtmlImage {
  src: string;
  alt: string;
  title: string;
  zoom: string | null;
}

function decodeAttribute(value: string): string {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|amp|quot|apos|lt|gt);/gi, (entity, code: string) => {
    const named: Record<string, string> = {
      amp: "&",
      quot: '"',
      apos: "'",
      lt: "<",
      gt: ">",
    };
    if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
    const hex = code[1]?.toLowerCase() === "x";
    const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

function attributes(source: string): Record<string, string> | null {
  const result: Record<string, string> = {};
  let remaining = source.replace(/\s*\/\s*$/, "");
  while (remaining.trim()) {
    const match = /^\s+([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/.exec(remaining);
    if (!match) return null;
    result[match[1].toLowerCase()] = decodeAttribute(match[2] ?? match[3] ?? match[4] ?? "");
    remaining = remaining.slice(match[0].length);
  }
  return result;
}

/** Only standalone img tags are rendered; never inject article HTML into the panel DOM. */
export function parseHtmlImages(raw: string): HtmlImage[] | null {
  const content = raw.replace(/<\/?(?:p|div|figure|a)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, "");
  const images: HtmlImage[] = [];
  const tags = /<img\b((?:[^>"']|"[^"]*"|'[^']*')*)\/?\s*>/gi;
  let cursor = 0;
  for (const match of content.matchAll(tags)) {
    if (content.slice(cursor, match.index).trim()) return null;
    const values = attributes(match[1]);
    if (!values || !validImageReference(values.src ?? "")) return null;
    const zoom = /(?:^|;)\s*zoom\s*:\s*(\d+(?:\.\d+)?%)(?:\s*;|$)/i.exec(values.style ?? "")?.[1];
    images.push({
      src: values.src,
      alt: values.alt ?? "",
      title: values.title ?? "",
      zoom: zoom ?? null,
    });
    cursor = match.index + match[0].length;
  }
  return images.length && !content.slice(cursor).trim() ? images : null;
}

export function removeHtmlImage(raw: string, index: number): string {
  const images = parseHtmlImages(raw);
  if (!images || index < 0 || index >= images.length) return raw;
  if (images.length === 1) return "";
  // Scan whole tags so an img-like string inside a wrapper attribute is skipped.
  const tags = [...raw.matchAll(/<\/?[\w:-]+\b(?:[^>"']|"[^"]*"|'[^']*')*>/g)].filter((match) =>
    /^<img\b/i.test(match[0]),
  );
  const tag = tags[index];
  return tag ? raw.slice(0, tag.index) + raw.slice(tag.index + tag[0].length) : raw;
}
