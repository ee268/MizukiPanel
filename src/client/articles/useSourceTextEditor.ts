import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { articleShortcut } from "./editor-shortcuts";
import { splitArticleSource } from "../../lib/articles/article-source";
import {
  applySourceFormat,
  insertSourceImage,
  insertSourceLink,
  insertSourceTable,
  setSourceHeading,
  sourceFormatState,
  toggleSourceLine,
  type SourceEdit,
  type SourceSelection,
} from "./source-format";
import type { FormatAction } from "./editor-format";
import {
  mergeTextareaChange,
  toSourceSelection,
  toTextareaOffset,
  toTextareaSelection,
} from "./source-textarea";

interface Snapshot extends SourceSelection {
  source: string;
}

export function useSourceTextEditor(
  source: string,
  onChange: (source: string) => void,
  onLink: () => void,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyStart = toTextareaOffset(source, splitArticleSource(source)?.bodyStart ?? 0);
  const selection = useRef<SourceSelection>({ start: bodyStart, end: bodyStart });
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const [, setRevision] = useState(0);

  useLayoutEffect(() => {
    textareaRef.current?.setSelectionRange(bodyStart, bodyStart);
  }, []);

  const format = sourceFormatState(
    source,
    toSourceSelection(source, selection.current),
    history.current.past.length > 0,
    history.current.future.length > 0,
  );

  function updateSelection(next: SourceSelection) {
    selection.current = next;
    setRevision((value) => value + 1);
  }

  function readSelection() {
    const textarea = textareaRef.current;
    return textarea
      ? { start: textarea.selectionStart, end: textarea.selectionEnd }
      : selection.current;
  }

  function pushHistory(previousSelection: SourceSelection) {
    history.current.past.push({ source, ...previousSelection });
    if (history.current.past.length > 150) {
      history.current.past.shift();
    }
    history.current.future = [];
    setRevision((value) => value + 1);
  }

  function restoreSelection(next: SourceSelection) {
    updateSelection(next);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(next.start, next.end);
      }
    });
  }

  function apply(edit: SourceEdit) {
    if (edit.source === source) {
      return;
    }
    pushHistory(readSelection());
    onChange(edit.source);
    restoreSelection(toTextareaSelection(edit.source, edit));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const next = mergeTextareaChange(source, event.target.value);
    if (next === source) {
      return;
    }
    pushHistory(selection.current);
    onChange(next);
    updateSelection({
      start: event.target.selectionStart ?? selection.current.start,
      end: event.target.selectionEnd ?? selection.current.end,
    });
  }

  function handleSelect() {
    const next = readSelection();
    if (next.start !== selection.current.start || next.end !== selection.current.end) {
      updateSelection(next);
    }
  }

  function undo() {
    const previous = history.current.past.pop();
    if (!previous) {
      return;
    }
    history.current.future.push({ source, ...readSelection() });
    onChange(previous.source);
    restoreSelection(previous);
  }

  function redo() {
    const next = history.current.future.pop();
    if (!next) {
      return;
    }
    history.current.past.push({ source, ...readSelection() });
    onChange(next.source);
    restoreSelection(next);
  }

  function action(value: FormatAction) {
    if (value === "undo") {
      undo();
      return;
    }
    if (value === "redo") {
      redo();
      return;
    }
    apply(applySourceFormat(source, toSourceSelection(source, readSelection()), value));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && !event.altKey && (key === "z" || key === "y")) {
      event.preventDefault();
      if (key === "y" || event.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }
    const shortcut = articleShortcut(event);
    if (!shortcut || shortcut === "save") {
      return;
    }
    event.preventDefault();
    if (shortcut === "link") {
      onLink();
      return;
    }
    action(shortcut);
  }

  return {
    textareaRef,
    selection,
    readSelection,
    readSourceSelection: () => toSourceSelection(source, readSelection()),
    format,
    apply,
    action,
    handleChange,
    handleSelect,
    handleKeyDown,
    setHeading: (level: number) =>
      apply(setSourceHeading(source, toSourceSelection(source, readSelection()), level)),
    toggleTask: () =>
      apply(toggleSourceLine(source, toSourceSelection(source, readSelection()), "task")),
    insertTable: () => apply(insertSourceTable(source, toSourceSelection(source, readSelection()))),
    insertLink: (label: string, href: string) =>
      apply(insertSourceLink(source, toSourceSelection(source, readSelection()), label, href)),
    insertImage: (alt: string, src: string) =>
      apply(insertSourceImage(source, toSourceSelection(source, readSelection()), alt, src)),
  };
}
