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
    doc = parse(raw);
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
  const literal = raw ? Fragment.from(schema.text(raw)) : Fragment.empty;
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
