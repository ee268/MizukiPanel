import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import { ThemeProvider, type Theme } from "@mui/material/styles";
import { createRoot } from "react-dom/client";
import { parseFencedCode } from "../../lib/articles/fenced-code";
import { CodeBlockCard } from "./CodeBlockCard";

function nodeSignature(node: ProseMirrorNode) {
  return String(node.attrs.language ?? "") + "\0" + node.textContent;
}

function fencedSource(node: ProseMirrorNode) {
  const body = node.textContent;
  const tick = String.fromCharCode(96);
  const longestRun = Math.max(
    2,
    ...Array.from(body.matchAll(new RegExp(tick + "+", "g")), (match) => match[0].length),
  );
  const fence = tick.repeat(longestRun + 1);
  const language = String(node.attrs.language ?? "")
    .replace(/\s|~/g, "")
    .replaceAll(tick, "");
  const raw = fence + language + "\n" + (body ? body + "\n" : "") + fence;
  const block = parseFencedCode(raw);
  if (!block) throw new Error("无法将 Milkdown 代码块转换为围栏源码");
  return block;
}

export function createMilkdownCodeBlock(
  node: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined,
  readOnly: boolean,
  theme: Theme,
  onValidityChange: (valid: boolean) => void,
): NodeView {
  const dom = document.createElement("div");
  const root = createRoot(dom);
  let currentNode = node;
  let revision = 0;
  let submittedSignature: string | null = null;

  function updateSource(raw: string) {
    const position = getPos();
    if (typeof position !== "number") return;
    if (!raw) {
      view.dispatch(view.state.tr.delete(position, position + currentNode.nodeSize));
      view.focus();
      return;
    }

    const block = parseFencedCode(raw);
    if (!block) return;
    const content = block.body ? view.state.schema.text(block.body) : null;
    const nextNode = currentNode.type.create(
      { ...currentNode.attrs, language: block.lang },
      content,
    );
    submittedSignature = nodeSignature(nextNode);
    view.dispatch(view.state.tr.replaceWith(position, position + currentNode.nodeSize, nextNode));
  }

  function render() {
    root.render(
      <ThemeProvider theme={theme}>
        <CodeBlockCard
          key={revision}
          block={fencedSource(currentNode)}
          readOnly={readOnly}
          onChange={updateSource}
          onValidityChange={onValidityChange}
        />
      </ThemeProvider>,
    );
  }

  render();
  return {
    dom,
    update(next) {
      if (next.type !== currentNode.type) return false;
      const changed = nodeSignature(next) !== nodeSignature(currentNode);
      if (changed && nodeSignature(next) !== submittedSignature) revision++;
      submittedSignature = null;
      currentNode = next;
      render();
      return true;
    },
    stopEvent() {
      return true;
    },
    ignoreMutation() {
      return true;
    },
    destroy() {
      queueMicrotask(() => root.unmount());
      onValidityChange(true);
    },
  };
}
