import { parseHtmlImages } from "./html-images";

export type QuotedHtmlPart =
  { kind: "text"; text: string } | { kind: "image"; raw: string; start: number; end: number };

/** Keep a quoted HTML image with its surrounding quote instead of splitting the quote apart. */
export function parseQuotedHtmlImages(raw: string): QuotedHtmlPart[] | null {
  const parts: QuotedHtmlPart[] = [];
  let imageCount = 0;

  for (const match of raw.matchAll(/([^\r\n]*)(?:\r\n|\n|$)/g)) {
    const line = match[1];
    if (!line && match.index + match[0].length === raw.length) {
      continue;
    }

    const quote = /^ {0,3}>[ \t]?(.*)$/.exec(line);
    if (!quote) {
      return null;
    }

    const content = quote[1];
    const trimmed = content.trim();
    if (/^<img\b/i.test(trimmed)) {
      if (!parseHtmlImages(trimmed)) {
        return null;
      }
      const start = match.index + line.indexOf(trimmed);
      parts.push({ kind: "image", raw: trimmed, start, end: start + trimmed.length });
      imageCount += 1;
    } else {
      parts.push({ kind: "text", text: content });
    }
  }

  return imageCount ? parts : null;
}
