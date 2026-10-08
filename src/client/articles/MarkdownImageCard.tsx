import { Box, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState, type MouseEvent, type KeyboardEvent } from "react";
import { mediaPreviewUrl } from "./article-media";
import { SyntaxCodeEditor } from "./SyntaxCodeEditor";
import { ImageCaret, type ImageSide } from "./ImageCaret";

interface MarkdownImageCardProps {
  articleId: string;
  source: string;
  src: string;
  alt: string;
  title: string;
  readOnly: boolean;
  initialCursor: number | null;
  onChange: (raw: string, cursor: number) => void;
  onSelect: () => void;
  onDelete: () => void;
  onPosition: (side: ImageSide) => void;
  onCaretDelete: (side: ImageSide, key: "Backspace" | "Delete") => void;
  onInsert: (side: ImageSide, text: string) => void;
  onMove: (side: ImageSide, direction: "left" | "right") => void;
}

export function MarkdownImageCard({
  articleId,
  source,
  src,
  alt,
  title,
  readOnly,
  initialCursor,
  onChange,
  onSelect,
  onDelete,
  onPosition,
  onCaretDelete,
  onInsert,
  onMove,
}: MarkdownImageCardProps) {
  const [editing, setEditing] = useState(initialCursor !== null && !readOnly);
  const [draft, setDraft] = useState(source);
  const cardRef = useRef<HTMLSpanElement>(null);
  const preview = mediaPreviewUrl(articleId, src);

  useEffect(() => {
    if (!editing) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !cardRef.current?.contains(event.target))
        setEditing(false);
    };
    document.addEventListener("pointerdown", closeOutside, true);
    return () => document.removeEventListener("pointerdown", closeOutside, true);
  }, [editing]);

  return (
    <Stack
      component="span"
      ref={cardRef}
      spacing={1}
      onKeyDown={(event) => {
        if (editing && event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          setEditing(false);
        }
      }}
    >
      {editing && !readOnly && (
        <SyntaxCodeEditor
          label="图片 Markdown 源码"
          language="markdown"
          value={draft}
          readOnly={false}
          onChange={(raw, cursor) => {
            setDraft(raw);
            onChange(raw, cursor);
          }}
          onReady={(view) => {
            view.dispatch({
              selection: { anchor: Math.min(initialCursor ?? draft.length, draft.length) },
            });
            if (initialCursor !== null) view.focus();
          }}
        />
      )}
      <Box
        component="span"
        className="image-preview-row"
        sx={{ display: "flex", alignItems: "flex-end", width: "100%" }}
      >
        <ImageCaret
          label="Markdown 图片前光标"
          side="before"
          readOnly={readOnly}
          onPosition={onPosition}
          onDelete={onCaretDelete}
          onInsert={onInsert}
          onMove={onMove}
        />
        <Box
          component={readOnly ? "span" : "button"}
          type={readOnly ? undefined : "button"}
          aria-label={readOnly ? undefined : `编辑 Markdown 图片源码：${alt || src}`}
          onClick={(event: MouseEvent<HTMLElement>) => {
            if (readOnly) return;
            event.preventDefault();
            setEditing(true);
            onSelect();
          }}
          onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
            if (
              readOnly ||
              event.nativeEvent.isComposing ||
              (event.key !== "Backspace" && event.key !== "Delete")
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
          sx={{
            display: "block",
            p: 0,
            border: 0,
            background: "transparent",
            cursor: readOnly ? "default" : "pointer",
            textAlign: "left",
            width: "fit-content",
            maxWidth: readOnly ? "100%" : "calc(100% - 24px)",
            minWidth: 0,
            flexShrink: 1,
            borderRadius: 1,
            "&:focus": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 3 },
          }}
        >
          {preview ? (
            <Box
              component="img"
              src={preview}
              alt={alt}
              title={title}
              loading="lazy"
              sx={{ display: "block", maxWidth: "100%", height: "auto", borderRadius: 1 }}
            />
          ) : (
            <Typography component="span">{alt || "图片地址不可用"}</Typography>
          )}
        </Box>
        <ImageCaret
          label="Markdown 图片后光标"
          side="after"
          readOnly={readOnly}
          onPosition={onPosition}
          onDelete={onCaretDelete}
          onInsert={onInsert}
          onMove={onMove}
        />
      </Box>
    </Stack>
  );
}
