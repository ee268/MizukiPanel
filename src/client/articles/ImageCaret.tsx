import { Box, useTheme } from "@mui/material";
import { useRef, type FormEvent, type KeyboardEvent } from "react";

export type ImageSide = "before" | "after";

interface ImageCaretProps {
  label: string;
  side: ImageSide;
  readOnly: boolean;
  onPosition?: (side: ImageSide) => void;
  onDelete: (side: ImageSide, key: "Backspace" | "Delete") => void;
  onInsert: (side: ImageSide, text: string) => void;
  onMove: (side: ImageSide, direction: "left" | "right") => void;
}

const placeholder = "\u200b";

export function ImageCaret({
  label,
  side,
  readOnly,
  onPosition,
  onDelete,
  onInsert,
  onMove,
}: ImageCaretProps) {
  const theme = useTheme();
  const inputRef = useRef<HTMLSpanElement>(null);
  if (readOnly) return null;
  function commit(input: HTMLElement) {
    const text = input.textContent?.replaceAll(placeholder, "") ?? "";
    input.textContent = placeholder;
    if (text) onInsert(side, text);
  }
  function position(input: HTMLElement) {
    onPosition?.(side);
    const range = document.createRange();
    range.setStart(input.firstChild ?? input, input.firstChild?.textContent?.length ?? 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  return (
    <Box
      component="span"
      className="image-caret-hitbox"
      data-image-hit={side}
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        // Own the first press; browser/ProseMirror mouse handling must not
        // replace this caret or require another click to focus it.
        event.preventDefault();
        event.stopPropagation();
        const input = inputRef.current;
        if (!input) return;
        input.focus({ preventScroll: true });
        position(input);
      }}
      sx={{
        display: "flex",
        alignItems: "flex-end",
        alignSelf: "stretch",
        flex: side === "after" ? "1 0 12px" : "0 0 12px",
        minWidth: 12,
        minHeight: "1.85em",
        cursor: "text",
      }}
    >
      <Box
        component="span"
        ref={inputRef}
        className="image-caret"
        data-image-side={side}
        aria-label={label}
        role="textbox"
        contentEditable
        suppressContentEditableWarning
        tabIndex={0}
        onFocus={(event) => position(event.currentTarget)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          position(event.currentTarget);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Backspace" || event.key === "Delete") {
            event.preventDefault();
            event.stopPropagation();
            onDelete(side, event.key);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            event.stopPropagation();
            onMove(side, event.key === "ArrowLeft" ? "left" : "right");
          } else if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            onInsert(side, "\n");
          }
        }}
        onInput={(event: FormEvent<HTMLElement>) => {
          if (!(event.nativeEvent as InputEvent).isComposing) commit(event.currentTarget);
        }}
        onCompositionEnd={(event) => commit(event.currentTarget)}
        onPaste={(event) => {
          event.preventDefault();
          onInsert(side, event.clipboardData.getData("text/plain"));
        }}
        sx={{
          display: "block",
          width: "100%",
          minHeight: "1.85em",
          fontSize: "1rem",
          lineHeight: 1.85,
          outline: "none",
          cursor: "text",
          color: "text.secondary",
          caretColor: theme.palette.text.primary,
          whiteSpace: "pre-wrap",
        }}
      >
        {placeholder}
      </Box>
    </Box>
  );
}
