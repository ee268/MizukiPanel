import type { EditorFormatState, FormatAction } from "./editor-format";
import { emptyFormatState } from "./editor-format";

export interface SourceSelection {
  start: number;
  end: number;
}

export interface SourceEdit extends SourceSelection {
  source: string;
}

type LineAction = "bullet" | "ordered" | "task" | "quote";

function replaceRange(
  source: string,
  selection: SourceSelection,
  replacement: string,
  nextSelection: SourceSelection,
): SourceEdit {
  return {
    source: source.slice(0, selection.start) + replacement + source.slice(selection.end),
    start: nextSelection.start,
    end: nextSelection.end,
  };
}

function lineRange(source: string, selection: SourceSelection): SourceSelection {
  const start = selection.start === 0 ? 0 : source.lastIndexOf("\n", selection.start - 1) + 1;
  const last = selection.end > selection.start ? selection.end - 1 : selection.end;
  const next = source.indexOf("\n", last);
  const end = next < 0 ? source.length : next > 0 && source[next - 1] === "\r" ? next - 1 : next;
  return { start, end };
}

function mapLines(
  source: string,
  selection: SourceSelection,
  transform: (line: string, index: number) => string,
): SourceEdit {
  const range = lineRange(source, selection);
  const lines = source.slice(range.start, range.end).split(/(\r?\n)/);
  let index = 0;
  const replacement = lines
    .map((part, position) => (position % 2 === 0 ? transform(part, index++) : part))
    .join("");
  const collapsed = selection.start === selection.end;
  const delta = replacement.length - (range.end - range.start);
  const cursor = Math.max(range.start, selection.start + delta);
  return replaceRange(source, range, replacement, {
    start: collapsed ? cursor : range.start,
    end: collapsed ? cursor : range.start + replacement.length,
  });
}

function toggleInline(source: string, selection: SourceSelection, marker: string): SourceEdit {
  const { start, end } = selection;
  const before = source.slice(start - marker.length, start);
  const after = source.slice(end, end + marker.length);
  if (before === marker && after === marker) {
    return replaceRange(
      source,
      { start: start - marker.length, end: end + marker.length },
      source.slice(start, end),
      { start: start - marker.length, end: end - marker.length },
    );
  }

  const selected = source.slice(start, end);
  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length >= marker.length * 2
  ) {
    const inner = selected.slice(marker.length, -marker.length);
    return replaceRange(source, selection, inner, { start, end: start + inner.length });
  }

  return replaceRange(source, selection, marker + selected + marker, {
    start: start + marker.length,
    end: end + marker.length,
  });
}

export function setSourceHeading(
  source: string,
  selection: SourceSelection,
  level: number,
): SourceEdit {
  return mapLines(source, selection, (line) => {
    const indent = line.match(/^\s*/)?.[0] ?? "";
    const body = line.slice(indent.length).replace(/^#{1,6}\s+/, "");
    return indent + (level ? "#".repeat(level) + " " : "") + body;
  });
}

export function toggleSourceLine(
  source: string,
  selection: SourceSelection,
  action: LineAction,
): SourceEdit {
  const range = lineRange(source, selection);
  const text = source.slice(range.start, range.end);
  const currentPrefix = {
    bullet: /^\s*[-*+]\s+(?!\[)/,
    ordered: /^\s*\d+\.\s+/,
    task: /^\s*[-*+]\s+\[[ xX]\]\s+/,
    quote: /^\s*>\s+/,
  }[action];
  const allSelected = text.split(/\r?\n/).every((line) => !line.trim() || currentPrefix.test(line));
  let ordinal = 0;
  return mapLines(source, selection, (line) => {
    if (!line.trim()) {
      return line;
    }
    const indent = line.match(/^\s*/)?.[0] ?? "";
    const body = line
      .slice(indent.length)
      .replace(/^(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+|>\s+)/, "");
    const prefix =
      action === "ordered"
        ? `${++ordinal}. `
        : { bullet: "- ", task: "- [ ] ", quote: "> " }[action];
    return indent + (allSelected ? "" : prefix) + body;
  });
}

export function toggleSourceCode(source: string, selection: SourceSelection): SourceEdit {
  const range = lineRange(source, selection);
  const selected = source.slice(range.start, range.end);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const opening = `\`\`\`${newline}`;
  const closing = `${newline}\`\`\``;
  const fenced = selected.startsWith(opening) && selected.endsWith(closing);
  const replacement = fenced
    ? selected.slice(opening.length, -closing.length)
    : opening + selected + closing;
  const cursor = range.start + (fenced ? 0 : opening.length);
  return replaceRange(source, range, replacement, {
    start: selection.start === selection.end ? cursor : range.start,
    end: selection.start === selection.end ? cursor : range.start + replacement.length,
  });
}

export function insertSourceTable(source: string, selection: SourceSelection): SourceEdit {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const start = selection.end;
  const before = source.slice(0, start);
  const after = source.slice(start);
  const prefix = before && !before.endsWith("\n") ? newline : "";
  const suffix = after && !after.startsWith("\n") ? newline : "";
  const table = ["| 列 1 | 列 2 |", "| --- | --- |", "| 内容 | 内容 |"].join(newline);
  const insertion = prefix + table + suffix;
  return replaceRange(source, { start, end: start }, insertion, {
    start: start + prefix.length + 2,
    end: start + prefix.length + 5,
  });
}

export function insertSourceLink(
  source: string,
  selection: SourceSelection,
  label: string,
  href: string,
): SourceEdit {
  const markdown = `[${label.replaceAll("]", "\\]")}](${href.replace(/[()]/g, "\\$&")})`;
  const end = selection.start + markdown.length;
  return replaceRange(source, selection, markdown, { start: end, end });
}

export function insertSourceImage(
  source: string,
  selection: SourceSelection,
  alt: string,
  src: string,
): SourceEdit {
  const start = selection.end;
  const markdown = `![${alt.replaceAll("]", "\\]")}](${src.replace(/[()]/g, "\\$&")})`;
  const end = start + markdown.length;
  return replaceRange(source, { start, end: start }, markdown, { start: end, end });
}

export function applySourceFormat(
  source: string,
  selection: SourceSelection,
  action: Exclude<FormatAction, "undo" | "redo">,
): SourceEdit {
  if (action === "bold" || action === "italic") {
    return toggleInline(source, selection, action === "bold" ? "**" : "*");
  }
  if (action === "code") {
    return toggleSourceCode(source, selection);
  }
  return toggleSourceLine(source, selection, action);
}

export function sourceFormatState(
  source: string,
  selection: SourceSelection,
  canUndo: boolean,
  canRedo: boolean,
): EditorFormatState {
  const range = lineRange(source, selection);
  const line = source.slice(range.start, range.end).split(/\r?\n/)[0];
  const heading = line.match(/^\s*(#{1,6})\s+/);
  const selected = source.slice(selection.start, selection.end);
  return {
    ...emptyFormatState,
    heading: heading?.[1].length ?? 0,
    bold: selected.startsWith("**") && selected.endsWith("**") && selected.length > 4,
    italic: selected.startsWith("*") && selected.endsWith("*") && selected.length > 2,
    link: /^\[[^\]]+\]\([^)]+\)$/.test(selected),
    bullet: /^\s*[-*+]\s+/.test(line),
    ordered: /^\s*\d+\.\s+/.test(line),
    task: /^\s*[-*+]\s+\[[ xX]\]\s+/.test(line),
    quote: /^\s*>\s+/.test(line),
    code: /^\s*\`\`\`/.test(line),
    canUndo,
    canRedo,
  };
}
