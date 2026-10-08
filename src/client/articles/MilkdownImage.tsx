import { parserCtx, serializerCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { Node } from "@milkdown/kit/prose/model";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import { ThemeProvider, type Theme } from "@mui/material/styles";
import { createRoot } from "react-dom/client";
import { MarkdownImageCard } from "./MarkdownImageCard";
import { imageSourceCursor, recordBrokenImageSource } from "./MilkdownSourceReveal";
import { sourceRevealContent } from "./source-reveal-content";

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
    recordBrokenImageSource(tr, position, tr.mapping.map(position + currentNode.nodeSize, 1));
    view.dispatch(tr);
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
