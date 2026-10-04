import { Box } from "@mui/material";
import { useLayoutEffect, useRef } from "react";
import type { SourceSegment } from "../../lib/articles/source-islands";

interface LiteralSourceEditorProps {
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (raw: string) => void;
}

export function LiteralSourceEditor({ segment, readOnly, onChange }: LiteralSourceEditorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function fitHeight(input: HTMLTextAreaElement) {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }

  useLayoutEffect(() => {
    if (inputRef.current) fitHeight(inputRef.current);
  }, []);

  return (
    <Box
      component="textarea"
      ref={inputRef}
      aria-label="未识别正文原文"
      defaultValue={segment.raw}
      readOnly={readOnly}
      onChange={(event) => {
        fitHeight(event.target);
        onChange(event.target.value);
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
