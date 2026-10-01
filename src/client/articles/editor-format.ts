import { editorViewCtx, type Editor } from "@milkdown/kit/core";
import { lift } from "@milkdown/kit/prose/commands";
import { redoDepth, undoDepth } from "@milkdown/kit/prose/history";
import type { EditorState } from "@milkdown/kit/prose/state";
import {
  createCodeBlockCommand,
  liftListItemCommand,
  toggleEmphasisCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { redoCommand, undoCommand } from "@milkdown/kit/plugin/history";
import { callCommand } from "@milkdown/kit/utils";

export type FormatAction =
  "bold" | "italic" | "bullet" | "ordered" | "quote" | "code" | "undo" | "redo";

export interface EditorFormatState {
  heading: number;
  bold: boolean;
  italic: boolean;
  link: boolean;
  bullet: boolean;
  ordered: boolean;
  task: boolean;
  quote: boolean;
  code: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export const emptyFormatState: EditorFormatState = {
  heading: 0,
  bold: false,
  italic: false,
  link: false,
  bullet: false,
  ordered: false,
  task: false,
  quote: false,
  code: false,
  canUndo: false,
  canRedo: false,
};

export function readFormatState(state: EditorState): EditorFormatState {
  const { $from } = state.selection;
  const marks = state.storedMarks ?? $from.marks();
  const ancestors = Array.from({ length: $from.depth + 1 }, (_, depth) => $from.node(depth));
  const hasNode = (name: string) => ancestors.some((node) => node.type.name === name);
  const listItem = ancestors.find((node) => node.type.name === "list_item");

  return {
    heading: $from.parent.type.name === "heading" ? Number($from.parent.attrs.level) : 0,
    bold: marks.some((mark) => mark.type.name === "strong"),
    italic: marks.some((mark) => mark.type.name === "emphasis"),
    link: marks.some((mark) => mark.type.name === "link"),
    bullet: hasNode("bullet_list"),
    ordered: hasNode("ordered_list"),
    task: listItem !== undefined && listItem.attrs.checked !== null,
    quote: hasNode("blockquote"),
    code: hasNode("code_block"),
    canUndo: undoDepth(state) > 0,
    canRedo: redoDepth(state) > 0,
  };
}

export function editorFormatState(editor: Editor): EditorFormatState {
  return editor.action((ctx) => readFormatState(ctx.get(editorViewCtx).state));
}

function focusEditor(editor: Editor): void {
  editor.action((ctx) => ctx.get(editorViewCtx).focus());
}

export function setArticleHeading(editor: Editor, level: number): boolean {
  const changed = editor.action(callCommand(wrapInHeadingCommand.key, level));
  focusEditor(editor);
  return changed;
}

export function runFormatAction(editor: Editor, action: FormatAction): boolean {
  const current = editorFormatState(editor);
  let changed = false;

  switch (action) {
    case "bold":
      changed = editor.action(callCommand(toggleStrongCommand.key));
      break;
    case "italic":
      changed = editor.action(callCommand(toggleEmphasisCommand.key));
      break;
    case "bullet":
      changed = editor.action(
        callCommand(current.bullet ? liftListItemCommand.key : wrapInBulletListCommand.key),
      );
      break;
    case "ordered":
      changed = editor.action(
        callCommand(current.ordered ? liftListItemCommand.key : wrapInOrderedListCommand.key),
      );
      break;
    case "quote":
      changed = current.quote
        ? editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            return lift(view.state, view.dispatch);
          })
        : editor.action(callCommand(wrapInBlockquoteCommand.key));
      break;
    case "code":
      changed = editor.action(
        callCommand(current.code ? turnIntoTextCommand.key : createCodeBlockCommand.key),
      );
      break;
    case "undo":
      changed = editor.action(callCommand(undoCommand.key));
      break;
    case "redo":
      changed = editor.action(callCommand(redoCommand.key));
      break;
  }

  focusEditor(editor);
  return changed;
}
