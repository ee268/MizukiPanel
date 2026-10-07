import { Box, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { parseQuotedHtmlImages } from "../../lib/articles/quoted-html-images";
import type { SourceSegment } from "../../lib/articles/source-islands";
import { HtmlImageCard } from "./HtmlImageCard";
import { LiteralSourceEditor } from "./LiteralSourceEditor";

interface QuotedHtmlImageBlockProps {
  articleId: string;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (raw: string) => void;
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
      <Stack spacing={1}>
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
          ) : part.text.trim() ? (
            <Typography key={index} component="p" sx={{ m: 0, lineHeight: 1.85 }}>
              {part.text}
            </Typography>
          ) : null,
        )}
      </Stack>
    </Box>
  );
}
