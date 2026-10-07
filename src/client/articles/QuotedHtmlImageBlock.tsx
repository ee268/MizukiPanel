import { Box, Stack } from "@mui/material";
import { useLayoutEffect, useRef, useState } from "react";
import { parseQuotedHtmlImages, replaceQuotedText } from "../../lib/articles/quoted-html-images";
import type { SourceSegment } from "../../lib/articles/source-islands";
import { HtmlImageCard } from "./HtmlImageCard";
import { LiteralSourceEditor } from "./LiteralSourceEditor";

interface QuotedHtmlImageBlockProps {
  articleId: string;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (raw: string) => void;
}

interface QuotedTextEditorProps {
  text: string;
  readOnly: boolean;
  onChange: (text: string) => void;
}

function QuotedTextEditor({ text, readOnly, onChange }: QuotedTextEditorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [text]);

  return (
    <Box
      component="textarea"
      ref={inputRef}
      aria-label="引用文字"
      value={text}
      rows={text.split("\n").length}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      sx={{
        display: "block",
        width: "100%",
        p: 0,
        border: 0,
        outline: "none",
        resize: "none",
        overflow: "hidden",
        background: "transparent",
        color: "text.secondary",
        font: "inherit",
        fontSize: "1rem",
        lineHeight: 1.85,
        overflowWrap: "anywhere",
      }}
    />
  );
}

export function QuotedHtmlImageBlock({
  articleId,
  segment,
  readOnly,
  onChange,
}: QuotedHtmlImageBlockProps) {
  const [draft, setDraft] = useState(segment.raw);
  const parts = parseQuotedHtmlImages(draft);

  function update(next: string) {
    setDraft(next);
    onChange(next);
  }

  if (!parts) {
    return (
      <LiteralSourceEditor segment={segment} value={draft} readOnly={readOnly} onChange={update} />
    );
  }

  return (
    <Box
      component="blockquote"
      sx={{
        borderLeft: "3px solid",
        borderColor: "primary.main",
        pl: 2,
        ml: 0,
        my: 0,
        color: "text.secondary",
      }}
    >
      <Stack spacing={0}>
        {parts.map((part, index) =>
          part.kind === "image" ? (
            <HtmlImageCard
              key={index}
              articleId={articleId}
              segment={{ ...segment, raw: part.raw }}
              readOnly={readOnly}
              onChange={(imageRaw) =>
                update(draft.slice(0, part.start) + imageRaw + draft.slice(part.end))
              }
            />
          ) : (
            <QuotedTextEditor
              key={index}
              text={part.text}
              readOnly={readOnly}
              onChange={(text) => update(replaceQuotedText(draft, part, text))}
            />
          ),
        )}
      </Stack>
    </Box>
  );
}
