import { Box } from "@mui/material";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { SourceSegment } from "../../lib/articles/source-islands";

interface LiteralSourceEditorProps {
  segment: SourceSegment;
  value?: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  ariaLabel?: string;
  readOnly: boolean;
  onChange: (raw: string, selectionStart: number) => void;
}

export function LiteralSourceEditor({
  segment,
  value,
  textareaRef,
  ariaLabel = "未识别正文原文",
  readOnly,
  onChange,
}: LiteralSourceEditorProps) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = textareaRef ?? localRef;

  function fitHeight(input: HTMLTextAreaElement) {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }

  useLayoutEffect(() => {
    if (inputRef.current) fitHeight(inputRef.current);
  }, [inputRef, value]);

  return (
    <Box
      component="textarea"
      ref={inputRef}
      aria-label={ariaLabel}
      value={value}
      defaultValue={value === undefined ? segment.raw : undefined}
      readOnly={readOnly}
      onChange={(event) => {
        fitHeight(event.target);
        onChange(event.target.value, event.target.selectionStart);
      }}
      spellCheck={false}
      sx={{
        display: "block",
        width: "100%",
        minHeight: 56,
        p: 0,
        border: 0,
        outline: "none",
        resize: "none",
        overflow: "hidden",
        background: "transparent",
        color: "text.primary",
        font: "inherit",
        fontSize: "1rem",
        lineHeight: 1.85,
        overflowWrap: "anywhere",
      }}
    />
  );
}
