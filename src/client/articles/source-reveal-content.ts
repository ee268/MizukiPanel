import { Fragment, type Node, type Schema } from "@milkdown/kit/prose/model";
import { markdownSourceAt, type MarkdownSourceKind } from "./markdown-source-range";

export type SourcePresentation = MarkdownSourceKind | "plain";

export interface SourceRevealContent {
  content: Node | Fragment;
  presentation: SourcePresentation;
}

export function sourceRevealContent(
  raw: string,
  scope: MarkdownSourceKind,
  parse: (raw: string) => Node | null,
  schema: Schema,
): SourceRevealContent {
  let doc: Node | null = null;
  try {
    // Editing a revealed span across lines invalidates its original syntax,
    // even when Markdown would normalize it into a valid inline mark.
    if (!/[\r\n]/.test(raw)) doc = parse(raw);
  } catch {
    // Parser failures must not discard the text or leave the previous formatting.
  }
  const block = doc?.childCount === 1 ? doc.firstChild : null;
  let presentation: SourcePresentation = "plain";
  if (scope === "heading" && block?.type.name === "heading") {
    presentation = "heading";
  } else if (block?.type.name === "paragraph" && block.content.size > 0) {
    const range = markdownSourceAt(doc!, 1);
    if (range?.from === 1 && range.to === block.content.size + 1) {
      presentation = range.kind;
    }
  }

  // A partial parse (e.g. **bold* becoming '*' + italic) is ordinary text.
  const literal = Fragment.fromArray(
    raw
      .split(/\r\n|[\r\n]/)
      .flatMap((line, index) => [
        ...(index ? [schema.nodes.hardbreak.create()] : []),
        ...(line ? [schema.text(line)] : []),
      ]),
  );
  return {
    presentation,
    content:
      scope === "heading"
        ? presentation === "plain"
          ? schema.nodes.paragraph.create(null, literal)
          : block!
        : presentation === "plain"
          ? literal
          : block!.content,
  };
}
