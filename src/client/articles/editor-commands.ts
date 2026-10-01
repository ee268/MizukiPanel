import { editorViewCtx, type Editor } from "@milkdown/kit/core";
import { insertImageCommand, linkSchema } from "@milkdown/kit/preset/commonmark";
import { exitTable, insertTableCommand } from "@milkdown/kit/preset/gfm";
import { callCommand, insert } from "@milkdown/kit/utils";

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
    const link = linkSchema.type(ctx).create({ href, title: "" });
    const text = view.state.schema.text(label, [link]);
    view.dispatch(view.state.tr.replaceSelectionWith(text, false).scrollIntoView());
    view.focus();
  });
}

export function insertArticleImage(editor: Editor, alt: string, src: string): boolean {
  const inserted = editor.action(callCommand(insertImageCommand.key, { alt, src }));
  editor.action((ctx) => ctx.get(editorViewCtx).focus());
  return inserted;
}
