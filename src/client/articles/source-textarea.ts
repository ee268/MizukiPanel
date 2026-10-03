import type { SourceSelection } from "./source-format";

export function toSourceOffset(source: string, textareaOffset: number): number {
  let raw = 0;
  let normalized = 0;
  while (raw < source.length && normalized < textareaOffset) {
    if (source[raw] === "\r" && source[raw + 1] === "\n") {
      raw += 2;
    } else {
      raw++;
    }
    normalized++;
  }
  return raw;
}

export function toTextareaOffset(source: string, sourceOffset: number): number {
  return source.slice(0, sourceOffset).replace(/\r\n?/g, "\n").length;
}

export function toSourceSelection(source: string, selection: SourceSelection): SourceSelection {
  return {
    start: toSourceOffset(source, selection.start),
    end: toSourceOffset(source, selection.end),
  };
}

export function toTextareaSelection(source: string, selection: SourceSelection): SourceSelection {
  return {
    start: toTextareaOffset(source, selection.start),
    end: toTextareaOffset(source, selection.end),
  };
}

export function mergeTextareaChange(source: string, nextValue: string): string {
  const previous = source.replace(/\r\n?/g, "\n");
  if (previous === nextValue) {
    return source;
  }

  let start = 0;
  while (
    start < previous.length &&
    start < nextValue.length &&
    previous[start] === nextValue[start]
  ) {
    start++;
  }

  let previousEnd = previous.length;
  let nextEnd = nextValue.length;
  while (
    previousEnd > start &&
    nextEnd > start &&
    previous[previousEnd - 1] === nextValue[nextEnd - 1]
  ) {
    previousEnd--;
    nextEnd--;
  }

  const rawStart = toSourceOffset(source, start);
  const rawEnd = toSourceOffset(source, previousEnd);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const inserted = nextValue.slice(start, nextEnd).replaceAll("\n", newline);
  return source.slice(0, rawStart) + inserted + source.slice(rawEnd);
}
