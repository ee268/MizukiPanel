import { parserCtx, serializerCtx } from "@milkdown/kit/core";
import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type Transaction } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import {
  markdownSourceAt,
  mapUnchangedSource,
  sourceContentBounds,
  sourceCursorOffset,
  type MarkdownSourceRange,
} from "./markdown-source-range";
import { sourceRevealContent, type SourcePresentation } from "./source-reveal-content";
import { mapSourceRepair, sourceRepairText, type SourceRepairRange } from "./source-repair-range";

interface SourceRevealState extends MarkdownSourceRange {
  id: number;
  raw: string;
  cursor: number;
  presentation: SourcePresentation;
}

interface SourceRevealPluginState {
  active: SourceRevealState | null;
  repairs: SourceRepairRange[];
}

interface SourceRevealMeta {
  active: SourceRevealState | null;
  repair?: SourceRepairRange;
  repairedId?: number;
}

const key = new PluginKey<SourceRevealPluginState>("markdown-source-reveal");

export function imageSourceCursor(view: EditorView, position: number): number | null {
  const active = key.getState(view.state)?.active;
  return active?.kind === "image" && active.from === position ? active.cursor : null;
}

let nextImageRepairId = 0;

export function recordBrokenImageSource(tr: Transaction, from: number, to: number) {
  tr.setMeta(key, {
    active: null,
    repair: { id: --nextImageRepairId, from, to, kind: "image" },
  } satisfies SourceRevealMeta);
}

function highlightSource(element: Element, raw: string, presentation: SourcePresentation) {
  const separator = raw.lastIndexOf("](");
  if (presentation === "plain" || separator < 0) {
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
  wrapper.dataset.sourceKind = initial.presentation;
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
    image: "图片",
  };
  input.setAttribute("aria-label", `Markdown ${labels[initial.kind]}源码`);
  input.rows = 1;
  input.spellcheck = false;
  input.value = initial.raw;
  highlightSource(measure, initial.raw, initial.presentation);
  wrapper.append(measure, input);
  let composing = false;

  function current() {
    const active = key.getState(view.state)?.active;
    return active?.id === initial.id ? active : null;
  }

  function update() {
    const active = current();
    highlightSource(measure, input.value, active?.presentation ?? "plain");
    if (!active || composing || input.value === active.raw) return;
    const next = sourceRevealContent(input.value, active.kind, parse, view.state.schema);
    const isHeading = active.kind === "heading";
    wrapper.dataset.sourceKind = next.presentation;
    highlightSource(measure, input.value, next.presentation);
    const tr = view.state.tr.replaceWith(active.from, active.to, next.content);
    const to = tr.mapping.map(active.to, 1);
    if (input.value.includes("\n")) {
      // Continue at the inserted break in the ordinary editor, whose inline
      // layout keeps preceding text on its original line and removes old marks.
      tr.setSelection(
        TextSelection.create(tr.doc, active.from + (isHeading ? 1 : 0) + input.selectionStart),
      );
      tr.setMeta(key, {
        active: null,
        repair: { id: active.id, from: active.from, to, kind: active.kind },
      } satisfies SourceRevealMeta);
      view.dispatch(tr);
      view.focus();
      return;
    }
    tr.setSelection(TextSelection.create(tr.doc, active.from + (isHeading ? 1 : 0)));
    tr.setMeta(key, {
      active: {
        ...active,
        to,
        raw: input.value,
        cursor: input.selectionStart,
        presentation: next.presentation,
      },
    } satisfies SourceRevealMeta);
    view.dispatch(tr);
  }

  function close(position?: number) {
    const active = current();
    if (!active) return;
    const tr = view.state.tr.setMeta(key, { active: null } satisfies SourceRevealMeta);
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
    if (event.key === "Escape" || left || right) {
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
    return new Plugin<SourceRevealPluginState>({
      key,
      state: {
        init: () => ({ active: null, repairs: [] }),
        apply(tr, previous, oldState, state) {
          const meta: SourceRevealMeta | undefined = tr.getMeta(key);
          const repairs = previous.repairs.flatMap((range) => {
            if (range.id === meta?.repairedId) return [];
            const mapped = tr.docChanged ? mapSourceRepair(range, tr.mapping) : range;
            return mapped ? [mapped] : [];
          });
          if (meta?.repair) repairs.push(meta.repair);
          if (meta) return { active: meta.active, repairs };
          const active = previous.active;
          if (active && !tr.selectionSet) {
            if (!tr.docChanged) return previous;
            const mapped = mapUnchangedSource(active, oldState.doc, state.doc, tr.mapping);
            return { active: mapped ? { ...active, ...mapped } : null, repairs };
          }
          if (readOnly || !tr.selectionSet || !state.selection.empty)
            return { active: null, repairs };
          const range = markdownSourceAt(state.doc, state.selection.from);
          if (!range) return { active: null, repairs };
          const raw = serializeSource(state.doc, range, ctx.get(serializerCtx));
          const bounds = sourceContentBounds(range);
          return {
            active: {
              ...range,
              id: ++nextId,
              raw,
              presentation: range.kind,
              cursor: sourceCursorOffset(raw, state.selection.from - bounds.from),
            },
            repairs,
          };
        },
      },
      appendTransaction(transactions, _oldState, state) {
        if (readOnly || !transactions.some((tr) => tr.docChanged)) return null;
        for (const repair of key.getState(state)?.repairs ?? []) {
          const raw = sourceRepairText(state.doc, repair);
          if (raw === null || /[\r\n]/.test(raw)) continue;
          const next = sourceRevealContent(raw, repair.kind, ctx.get(parserCtx), state.schema);
          if (next.presentation === "plain") continue;
          const bounds = sourceContentBounds(repair);
          const selected =
            state.selection.empty &&
            state.selection.from >= bounds.from &&
            state.selection.from <= bounds.to;
          const tr = state.tr.replaceWith(repair.from, repair.to, next.content);
          const active: SourceRevealState | null = selected
            ? {
                ...repair,
                id: ++nextId,
                to: tr.mapping.map(repair.to, 1),
                raw,
                cursor: state.selection.from - bounds.from,
                presentation: next.presentation,
              }
            : null;
          if (active)
            tr.setSelection(TextSelection.create(tr.doc, sourceContentBounds(active).from));
          tr.setMeta(key, { active, repairedId: repair.id } satisfies SourceRevealMeta);
          return tr;
        }
        return null;
      },
      props: {
        decorations(state) {
          const active = key.getState(state)?.active;
          if (!active || active.kind === "image") return null;
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
          const active = key.getState(view.state)?.active;
          const input = view.dom.querySelector<HTMLTextAreaElement>(".markdown-source-input");
          if (!active || !input) return;
          const wrapper = input.parentElement!;
          if (input.value !== active.raw || wrapper.dataset.sourceKind !== active.presentation) {
            input.value = active.raw;
            wrapper.dataset.sourceKind = active.presentation;
            const measure = input.previousElementSibling;
            if (measure) highlightSource(measure, active.raw, active.presentation);
          }
          if (key.getState(previousState)?.active?.id !== active.id) return;
          queueMicrotask(() => {
            if (!input.isConnected || key.getState(view.state)?.active?.id !== active.id) return;
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
