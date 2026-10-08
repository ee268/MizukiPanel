import { parserCtx, serializerCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { Node } from "@milkdown/kit/prose/model";
import { NodeSelection, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import { ThemeProvider, type Theme } from "@mui/material/styles";
import { createRoot } from "react-dom/client";
import { MarkdownImageCard } from "./MarkdownImageCard";
import { imageSourceCursor, recordBrokenImageSource } from "./MilkdownSourceReveal";
import { sourceRevealContent } from "./source-reveal-content";
import type { ImageSide } from "./ImageCaret";
import { joinBackward, joinForward } from "@milkdown/kit/prose/commands";

export interface ThemedImageView extends NodeView {
  refreshTheme: () => void;
}

function signature(node: Node) {
  return JSON.stringify(node.toJSON());
}

export function createMilkdownImage(
  node: Node,
  view: EditorView,
  getPos: () => number | undefined,
  ctx: Ctx,
  articleId: string,
  readOnly: boolean,
  getTheme: () => Theme,
  onDispose: () => void,
): ThemedImageView {
  const dom = document.createElement("span");
  dom.className = "markdown-image-view";
  dom.contentEditable = "false";
  const root = createRoot(dom);
  let currentNode = node;
  let revision = 0;
  let submittedSignature: string | null = null;

  function change(raw: string, cursor: number) {
    const position = getPos();
    if (typeof position !== "number" || readOnly) return;
    const next = sourceRevealContent(raw, "image", ctx.get(parserCtx), view.state.schema);
    if (next.presentation === "image") {
      const image = next.content.firstChild!.mark(currentNode.marks);
      submittedSignature = signature(image);
      view.dispatch(view.state.tr.replaceWith(position, position + currentNode.nodeSize, image));
      return;
    }
    const tr = view.state.tr.replaceWith(position, position + currentNode.nodeSize, next.content);
    tr.setSelection(TextSelection.create(tr.doc, position + cursor));
    const to = tr.mapping.map(position + currentNode.nodeSize, 1);
    if (to > position) recordBrokenImageSource(tr, position, to);
    view.dispatch(tr);
    view.focus();
  }

  function select() {
    const position = getPos();
    if (readOnly || typeof position !== "number") return;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, position)));
    view.focus();
  }

  function remove() {
    const position = getPos();
    if (readOnly || typeof position !== "number") return;
    const tr = view.state.tr.delete(position, position + currentNode.nodeSize);
    tr.setSelection(TextSelection.near(tr.doc.resolve(position)));
    view.dispatch(tr);
    view.focus();
  }

  function positionCaret(side: ImageSide) {
    const start = getPos();
    if (readOnly || typeof start !== "number") return;
    const pos = start + (side === "after" ? currentNode.nodeSize : 0);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
  }

  function insert(side: ImageSide, text: string) {
    if (!text || readOnly) return;
    positionCaret(side);
    const from = view.state.selection.from;
    const content = sourceRevealContent(text, "image", () => null, view.state.schema).content;
    const tr = view.state.tr.replaceWith(from, from, content);
    tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(from, 1)));
    view.dispatch(tr);
    view.focus();
  }

  function caretDelete(side: ImageSide, key: "Backspace" | "Delete") {
    if ((side === "after" && key === "Backspace") || (side === "before" && key === "Delete")) {
      remove();
      return;
    }
    positionCaret(side);
    const { $from } = view.state.selection;
    const backwards = key === "Backspace";
    const neighbor = backwards ? $from.nodeBefore : $from.nodeAfter;
    if (neighbor) {
      const size = neighbor.isText
        ? [...neighbor.text!][backwards ? [...neighbor.text!].length - 1 : 0].length
        : neighbor.nodeSize;
      view.dispatch(
        view.state.tr.delete(
          $from.pos - (backwards ? size : 0),
          $from.pos + (backwards ? 0 : size),
        ),
      );
    } else {
      (backwards ? joinBackward : joinForward)(view.state, view.dispatch, view);
    }
    view.focus();
  }

  function move(side: ImageSide, direction: "left" | "right") {
    if (
      (side === "before" && direction === "right") ||
      (side === "after" && direction === "left")
    ) {
      dom
        .querySelector<HTMLElement>(`[data-image-side="${side === "before" ? "after" : "before"}"]`)
        ?.focus();
      return;
    }
    positionCaret(side);
    const next = Math.max(
      0,
      Math.min(
        view.state.doc.content.size,
        view.state.selection.from + (direction === "left" ? -1 : 1),
      ),
    );
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.near(view.state.doc.resolve(next), direction === "left" ? -1 : 1),
      ),
    );
    view.focus();
  }

  function render() {
    const paragraph = view.state.schema.nodes.paragraph.create(null, currentNode.mark([]));
    const source = ctx
      .get(serializerCtx)(view.state.schema.nodes.doc.create(null, paragraph))
      .trimEnd();
    const position = getPos();
    root.render(
      <ThemeProvider theme={getTheme()}>
        <MarkdownImageCard
          key={revision}
          articleId={articleId}
          source={source}
          src={currentNode.attrs.src}
          alt={currentNode.attrs.alt}
          title={currentNode.attrs.title}
          readOnly={readOnly}
          initialCursor={typeof position === "number" ? imageSourceCursor(view, position) : null}
          onChange={change}
          onSelect={select}
          onDelete={remove}
          onPosition={positionCaret}
          onCaretDelete={caretDelete}
          onInsert={insert}
          onMove={move}
        />
      </ThemeProvider>,
    );
  }
  render();
  return {
    dom,
    update(next) {
      if (next.type !== currentNode.type) return false;
      if (signature(next) !== signature(currentNode) && signature(next) !== submittedSignature)
        revision++;
      submittedSignature = null;
      currentNode = next;
      render();
      return true;
    },
    stopEvent: () => true,
    ignoreMutation: () => true,
    destroy() {
      onDispose();
      queueMicrotask(() => root.unmount());
    },
    refreshTheme: render,
  };
}
