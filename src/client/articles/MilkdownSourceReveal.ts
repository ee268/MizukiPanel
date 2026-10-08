import { parserCtx, serializerCtx } from "@milkdown/kit/core";
import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import {
  markdownSourceAt,
  mapUnchangedSource,
  sourceContentBounds,
  sourceCursorOffset,
  type MarkdownSourceRange,
} from "./markdown-source-range";

interface SourceRevealState extends MarkdownSourceRange {
  id: number;
  raw: string;
  cursor: number;
}

const key = new PluginKey<SourceRevealState | null>("markdown-source-reveal");

function highlightSource(element: Element, raw: string) {
  const separator = raw.lastIndexOf("](");
  if (separator < 0) {
    element.textContent = raw || " ";
    return;
  }
  const destination = document.createElement("span");
  destination.className = "markdown-source-destination";
  destination.textContent = raw.slice(separator + 1);
  element.replaceChildren(document.createTextNode(raw.slice(0, separator + 1)), destination);
}

function serializeSource(doc: Node, range: MarkdownSourceRange, serialize: (doc: Node) => string) {
  if (range.kind === "heading") {
    return serialize(doc.type.create(null, doc.slice(range.from, range.to).content)).trimEnd();
  }
  const paragraph = doc.type.schema.nodes.paragraph.create(
    null,
    doc.slice(range.from, range.to).content,
  );
  return serialize(doc.type.create(null, paragraph)).trimEnd();
}

function createSourceWidget(
  view: EditorView,
  initial: SourceRevealState,
  parse: (raw: string) => Node | null,
) {
  const wrapper = document.createElement("span");
  wrapper.className = "markdown-source-reveal";
  wrapper.dataset.sourceKind = initial.kind;
  const measure = document.createElement("span");
  measure.className = "markdown-source-measure";
  measure.setAttribute("aria-hidden", "true");
  const input = document.createElement("textarea");
  input.className = "markdown-source-input";
  const labels = {
    heading: "标题",
    link: "链接",
    strong: "加粗",
    emphasis: "斜体",
    strike_through: "删除线",
    inlineCode: "行内代码",
  };
  input.setAttribute("aria-label", `Markdown ${labels[initial.kind]}源码`);
  input.rows = 1;
  input.spellcheck = false;
  input.value = initial.raw;
  highlightSource(measure, initial.raw);
  wrapper.append(measure, input);
  let composing = false;

  function current() {
    const active = key.getState(view.state);
    return active?.id === initial.id ? active : null;
  }

  function update() {
    highlightSource(measure, input.value);
    const active = current();
    if (!active || composing || input.value === active.raw) return;
    // Incomplete syntax stays editable as literal text until it is complete.
    const parsed = parse(input.value);
    const block = parsed?.childCount === 1 ? parsed.firstChild : null;
    const isHeading = active.kind === "heading";
    const text = input.value ? view.state.schema.text(input.value) : null;
    const content = isHeading
      ? block?.isTextblock && ["heading", "paragraph"].includes(block.type.name)
        ? block
        : view.state.schema.nodes.paragraph.create(null, text)
      : block?.type.name === "paragraph"
        ? block.content
        : text;
    const tr = view.state.tr.replaceWith(active.from, active.to, content ?? []);
    const to = tr.mapping.map(active.to, 1);
    tr.setSelection(TextSelection.create(tr.doc, active.from + (isHeading ? 1 : 0)));
    tr.setMeta(key, { ...active, to, raw: input.value, cursor: input.selectionStart });
    view.dispatch(tr);
  }

  function close(position?: number) {
    const active = current();
    if (!active) return;
    const tr = view.state.tr.setMeta(key, null);
    if (position !== undefined) {
      tr.setSelection(TextSelection.create(tr.doc, position));
    }
    view.dispatch(tr);
    if (position !== undefined) view.focus();
  }

  input.addEventListener("input", update);
  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    update();
  });
  input.addEventListener("blur", () => {
    // Let DOM replacement restore native focus before treating blur as an exit.
    requestAnimationFrame(() => {
      if (wrapper.isConnected && document.activeElement !== input) close();
    });
  });
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.isComposing) return;
    const active = current();
    if (!active) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const left = event.key === "ArrowLeft" && start === 0 && end === 0;
    const right = event.key === "ArrowRight" && start === input.value.length && end === start;
    if (event.key === "Escape" || event.key === "Enter" || left || right) {
      event.preventDefault();
      const bounds = sourceContentBounds(active);
      close(left ? bounds.from : bounds.to);
    }
  });

  // Keep the native textarea selection and IME events outside ProseMirror.
  for (const event of ["mousedown", "click", "beforeinput", "paste", "copy", "cut"]) {
    input.addEventListener(event, (item) => item.stopPropagation());
  }
  queueMicrotask(() => {
    if (!wrapper.isConnected || !current()) return;
    input.focus({ preventScroll: true });
    const cursor = Math.min(initial.cursor, input.value.length);
    input.setSelectionRange(cursor, cursor);
  });
  return wrapper;
}

export function createMilkdownSourceReveal(readOnly: boolean) {
  return $prose((ctx) => {
    let nextId = 0;
    return new Plugin<SourceRevealState | null>({
      key,
      state: {
        init: () => null,
        apply(tr, active, oldState, state) {
          if (tr.getMeta(key) !== undefined) return tr.getMeta(key);
          if (active && !tr.selectionSet) {
            if (!tr.docChanged) return active;
            const mapped = mapUnchangedSource(active, oldState.doc, state.doc, tr.mapping);
            return mapped ? { ...active, ...mapped } : null;
          }
          if (readOnly || !tr.selectionSet || !state.selection.empty) return null;
          const range = markdownSourceAt(state.doc, state.selection.from);
          if (!range) return null;
          const raw = serializeSource(state.doc, range, ctx.get(serializerCtx));
          const bounds = sourceContentBounds(range);
          return {
            ...range,
            id: ++nextId,
            raw,
            cursor: sourceCursorOffset(raw, state.selection.from - bounds.from),
          };
        },
      },
      props: {
        decorations(state) {
          const active = key.getState(state);
          if (!active) return null;
          const bounds = sourceContentBounds(active);
          const decorations = [
            Decoration.widget(
              bounds.from,
              (view) => createSourceWidget(view, active, ctx.get(parserCtx)),
              { key: `source-reveal-${active.id}`, side: -1, stopEvent: () => true },
            ),
          ];
          if (bounds.to > bounds.from) {
            decorations.push(
              Decoration.inline(bounds.from, bounds.to, {
                class: "markdown-source-hidden",
                style: "display:none",
              }),
            );
          }
          return DecorationSet.create(state.doc, decorations);
        },
        handleClick(view, position, event) {
          if (
            readOnly ||
            !(event.target instanceof Element) ||
            !event.target.closest("a[href], strong, em, del, code, h1, h2, h3, h4, h5, h6")
          ) {
            return false;
          }
          const range =
            markdownSourceAt(view.state.doc, position) ??
            markdownSourceAt(view.state.doc, Math.max(0, position - 1));
          if (!range) return false;
          const bounds = sourceContentBounds(range);
          const cursor = Math.max(
            bounds.from,
            Math.min(position, Math.max(bounds.from, bounds.to - 1)),
          );
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor)));
          return true;
        },
      },
      view: () => ({
        update(view, previousState) {
          const active = key.getState(view.state);
          const input = view.dom.querySelector<HTMLTextAreaElement>(".markdown-source-input");
          if (!active || !input) return;
          if (input.value !== active.raw) {
            input.value = active.raw;
            const measure = input.previousElementSibling;
            if (measure) highlightSource(measure, active.raw);
          }
          if (key.getState(previousState)?.id !== active.id) return;
          queueMicrotask(() => {
            if (!input.isConnected || key.getState(view.state)?.id !== active.id) return;
            if (document.activeElement === document.body || document.activeElement === view.dom) {
              input.focus({ preventScroll: true });
              input.setSelectionRange(active.cursor, active.cursor);
            }
          });
        },
      }),
    });
  });
}
