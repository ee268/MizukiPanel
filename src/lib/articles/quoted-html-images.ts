import { parseHtmlImages } from "./html-images";

export type QuotedHtmlPart =
  | { kind: "text"; text: string; start: number; end: number; prefix: string }
  | { kind: "image"; raw: string; start: number; end: number };

/** Keep a quoted HTML image with its surrounding quote instead of splitting the quote apart. */
export function parseQuotedHtmlImages(raw: string): QuotedHtmlPart[] | null {
  const parts: QuotedHtmlPart[] = [];
  let imageCount = 0;
  let textLines: string[] = [];
  let textStart = 0;
  let textEnd = 0;
  let textPrefix = ">";

  function flushText() {
    if (textLines.length) {
      parts.push({
        kind: "text",
        text: textLines.join("\n"),
        start: textStart,
        end: textEnd,
        prefix: textPrefix,
      });
      textLines = [];
    }
  }

  for (const match of raw.matchAll(/([^\r\n]*)(?:\r\n|\n|$)/g)) {
    const line = match[1];
    if (!line && match.index + match[0].length === raw.length) {
      continue;
    }

    const quote = /^( {0,3}>)[ \t]?(.*)$/.exec(line);
    if (!quote) {
      return null;
    }

    const content = quote[2];
    const trimmed = content.trim();
    if (/^<img\b/i.test(trimmed)) {
      if (!parseHtmlImages(trimmed)) {
        return null;
      }
      flushText();
      const start = match.index + line.indexOf(trimmed);
      parts.push({ kind: "image", raw: trimmed, start, end: start + trimmed.length });
      imageCount += 1;
    } else {
      if (!textLines.length) {
        textStart = match.index;
        textPrefix = quote[1];
      }
      textLines.push(content);
      textEnd = match.index + line.length;
    }
  }

  flushText();

  return imageCount ? parts : null;
}

export function replaceQuotedText(
  raw: string,
  part: Extract<QuotedHtmlPart, { kind: "text" }>,
  text: string,
): string {
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const quoted = text
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .map((line) => `${part.prefix}${line ? ` ${line}` : ""}`)
    .join(newline);
  return raw.slice(0, part.start) + quoted + raw.slice(part.end);
}
