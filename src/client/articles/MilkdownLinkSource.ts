import { parserCtx, serializerCtx } from "@milkdown/kit/core";
import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { markdownLinkAt, type MarkdownLinkRange } from "./markdown-link-range";

interface LinkSourceState {
  id: number;
  from: number;
  to: number;
  raw: string;
  cursor: number;
}

const key = new PluginKey<LinkSourceState | null>("markdown-link-source");

function highlightSource(element: Element, raw: string) {
  const separator = raw.lastIndexOf("](");
  if (separator < 0) {
    element.textContent = raw || " ";
    return;
  }
  const destination = document.createElement("span");
  destination.className = "markdown-link-source-destination";
  destination.textContent = raw.slice(separator + 1);
  element.replaceChildren(document.createTextNode(raw.slice(0, separator + 1)), destination);
}

function serializeLink(doc: Node, range: MarkdownLinkRange, serialize: (doc: Node) => string) {
  const paragraph = doc.type.schema.nodes.paragraph.create(
    null,
    doc.slice(range.from, range.to).content,
  );
  return serialize(doc.type.create(null, paragraph)).trimEnd();
}

function createSourceWidget(
  view: EditorView,
  initial: LinkSourceState,
  parse: (raw: string) => Node | null,
) {
  const wrapper = document.createElement("span");
  wrapper.className = "markdown-link-source";
  const measure = document.createElement("span");
  measure.className = "markdown-link-source-measure";
  measure.setAttribute("aria-hidden", "true");
  const input = document.createElement("textarea");
  input.className = "markdown-link-source-input";
  input.setAttribute("aria-label", "Markdown 链接源码");
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
    const paragraph = parsed?.childCount === 1 ? parsed.firstChild : null;
    const content =
      paragraph?.type.name === "paragraph"
        ? paragraph.content
        : input.value
          ? view.state.schema.text(input.value)
          : null;
    const tr = view.state.tr.replaceWith(active.from, active.to, content ?? []);
    const to = tr.mapping.map(active.to, 1);
    tr.setSelection(TextSelection.create(tr.doc, active.from));
    tr.setMeta(key, { ...active, to, raw: input.value });
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
  input.addEventListener("blur", () => close());
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
      close(left ? active.from : active.to);
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

export function createMilkdownLinkSource(readOnly: boolean) {
  return $prose((ctx) => {
    let nextId = 0;
    return new Plugin<LinkSourceState | null>({
      key,
      state: {
        init: () => null,
        apply(tr, active, _oldState, state) {
          if (tr.getMeta(key) !== undefined) return tr.getMeta(key);
          if (active && !tr.selectionSet && !tr.docChanged) return active;
          if (readOnly || !tr.selectionSet || !state.selection.empty) return null;
          const range = markdownLinkAt(state.doc, state.selection.from);
          if (!range) return null;
          const raw = serializeLink(state.doc, range, ctx.get(serializerCtx));
          return {
            id: ++nextId,
            from: range.from,
            to: range.to,
            raw,
            cursor: 1 + state.selection.from - range.from,
          };
        },
      },
      props: {
        decorations(state) {
          const active = key.getState(state);
          if (!active) return null;
          const decorations = [
            Decoration.widget(
              active.from,
              (view) => createSourceWidget(view, active, ctx.get(parserCtx)),
              { key: `link-source-${active.id}`, side: -1, stopEvent: () => true },
            ),
          ];
          if (active.to > active.from) {
            decorations.push(Decoration.inline(active.from, active.to, { style: "display:none" }));
          }
          return DecorationSet.create(state.doc, decorations);
        },
        handleClick(view, position, event) {
          if (readOnly || !(event.target instanceof Element) || !event.target.closest("a[href]")) {
            return false;
          }
          const range =
            markdownLinkAt(view.state.doc, position) ??
            markdownLinkAt(view.state.doc, Math.max(0, position - 1));
          if (!range) return false;
          const cursor = Math.max(range.from, Math.min(position, range.to - 1));
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor)));
          return true;
        },
      },
      view: () => ({
        update(view) {
          const active = key.getState(view.state);
          const input = view.dom.querySelector<HTMLTextAreaElement>(".markdown-link-source-input");
          if (!active || !input || input.value === active.raw) return;
          input.value = active.raw;
          const measure = input.previousElementSibling;
          if (measure) highlightSource(measure, active.raw);
        },
      }),
    });
  });
}
