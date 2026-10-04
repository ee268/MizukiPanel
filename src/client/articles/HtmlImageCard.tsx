import { Box, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseHtmlImages } from "../../lib/articles/html-images";
import type { SourceSegment } from "../../lib/articles/source-islands";
import { mediaPreviewUrl } from "./article-media";
import { LiteralSourceEditor } from "./LiteralSourceEditor";

interface HtmlImageCardProps {
  articleId: string;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (raw: string) => void;
}

export function HtmlImageCard({ articleId, segment, readOnly, onChange }: HtmlImageCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(segment.raw);
  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<number | null>(null);
  const wasImage = useRef(Boolean(parseHtmlImages(segment.raw)));
  const images = parseHtmlImages(draft);

  useLayoutEffect(() => {
    if (wasImage.current && !images && bodyRef.current && !readOnly) {
      bodyRef.current.focus();
      const position = Math.min(pendingSelection.current ?? draft.length, draft.length);
      bodyRef.current.setSelectionRange(position, position);
    } else if (!wasImage.current && images && editing && inputRef.current) {
      inputRef.current.focus();
      const position = Math.min(pendingSelection.current ?? draft.length, draft.length);
      inputRef.current.setSelectionRange(position, position);
    }
    wasImage.current = Boolean(images);
    pendingSelection.current = null;
  }, [draft, images, readOnly]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !editorRef.current?.contains(event.target)) {
        setEditing(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside, true);
    return () => document.removeEventListener("pointerdown", closeOutside, true);
  }, [editing]);

  function change(next: string, selectionStart: number) {
    pendingSelection.current = selectionStart;
    setDraft(next);
    const valid = Boolean(parseHtmlImages(next));
    if (!valid) {
      setEditing(false);
    } else if (!images) {
      setEditing(true);
    }
    onChange(next);
  }

  return (
    <Stack spacing={1}>
      {!images ? (
        <LiteralSourceEditor
          segment={segment}
          value={draft}
          textareaRef={bodyRef}
          ariaLabel="图片 HTML 正文"
          readOnly={readOnly}
          onChange={change}
        />
      ) : (
        <>
          {editing && !readOnly && (
            <Box ref={editorRef}>
              <TextField
                label="图片 HTML 源码"
                value={draft}
                onChange={(event) =>
                  change(
                    event.target.value,
                    event.target.selectionStart ?? event.target.value.length,
                  )
                }
                inputRef={inputRef}
                fullWidth
                multiline
                minRows={2}
                slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 14 } } }}
              />
            </Box>
          )}
          {images.map((image, index) => {
            const src = mediaPreviewUrl(articleId, image.src);
            return (
              <Box
                key={`${image.src}:${index}`}
                component="button"
                type="button"
                aria-label={`编辑图片源码：${image.alt || image.src}`}
                onClick={() => !readOnly && setEditing(true)}
                sx={{
                  display: "block",
                  p: 0,
                  border: 0,
                  background: "transparent",
                  cursor: readOnly ? "default" : "pointer",
                  textAlign: "left",
                  width: "fit-content",
                  maxWidth: "100%",
                }}
              >
                {src ? (
                  <Box
                    component="img"
                    src={src}
                    alt={image.alt}
                    title={image.title}
                    loading="lazy"
                    sx={{
                      display: "block",
                      maxWidth: "100%",
                      height: "auto",
                      zoom: image.zoom ?? 1,
                      borderRadius: 1,
                    }}
                  />
                ) : (
                  <Typography>{image.alt || "图片地址不可用"}</Typography>
                )}
              </Box>
            );
          })}
        </>
      )}
    </Stack>
  );
}
