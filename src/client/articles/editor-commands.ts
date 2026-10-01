import { editorViewCtx, type Editor } from "@milkdown/kit/core";
import { insertImageCommand, linkSchema } from "@milkdown/kit/preset/commonmark";
import { exitTable, insertTableCommand } from "@milkdown/kit/preset/gfm";
import { TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import { callCommand, insert } from "@milkdown/kit/utils";

interface EditorLink {
  label: string;
  href: string;
  from: number;
  to: number;
}

function linkAtCursor(state: EditorState): EditorLink | null {
  const { $from } = state.selection;
  const parentOffset = $from.parentOffset;
  let result: EditorLink | null = null;

  $from.parent.forEach((node, offset) => {
    if (result || !node.isText || parentOffset < offset || parentOffset > offset + node.nodeSize) {
      return;
    }
    const link = node.marks.find((mark) => mark.type.name === "link");
    if (link) {
      result = {
        label: node.textContent,
        href: String(link.attrs.href ?? ""),
        from: $from.start() + offset,
        to: $from.start() + offset + node.nodeSize,
      };
    }
  });

  return result;
}

export function selectedEditorLink(editor: Editor): Pick<EditorLink, "label" | "href"> | null {
  return editor.action((ctx) => linkAtCursor(ctx.get(editorViewCtx).state));
}

export function selectedEditorText(editor: Editor): string {
  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { from, to } = view.state.selection;
    return view.state.doc.textBetween(from, to, " ");
  });
}

export function insertArticleTable(editor: Editor): boolean {
  const inserted = editor.action(callCommand(insertTableCommand.key, { row: 3, col: 3 }));
  editor.action((ctx) => ctx.get(editorViewCtx).focus());
  return inserted;
}

export function insertArticleTask(editor: Editor): void {
  const label = selectedEditorText(editor).replace(/\s+/g, " ").trim() || "待办事项";
  editor.action(callCommand(exitTable.key));
  editor.action(insert(`- [ ] ${label}`, false));
  editor.action((ctx) => ctx.get(editorViewCtx).focus());
}

export function insertArticleLink(editor: Editor, label: string, href: string): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const existing = view.state.selection.empty ? linkAtCursor(view.state) : null;
    const selection = existing
      ? TextSelection.create(view.state.doc, existing.from, existing.to)
      : view.state.selection;
    const link = linkSchema.type(ctx).create({ href, title: "" });
    const text = view.state.schema.text(label, [link]);
    view.dispatch(
      view.state.tr.setSelection(selection).replaceSelectionWith(text, false).scrollIntoView(),
    );
    view.focus();
  });
}

export function insertArticleImage(editor: Editor, alt: string, src: string): boolean {
  const inserted = editor.action(callCommand(insertImageCommand.key, { alt, src }));
  editor.action((ctx) => ctx.get(editorViewCtx).focus());
  return inserted;
}
