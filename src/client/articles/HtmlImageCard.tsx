import { Box, Stack, Typography } from "@mui/material";
import type { EditorView } from "@uiw/react-codemirror";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
import { parseHtmlImages, removeHtmlImage } from "../../lib/articles/html-images";
import type { SourceSegment } from "../../lib/articles/source-islands";
import { mediaPreviewUrl } from "./article-media";
import { LiteralSourceEditor } from "./LiteralSourceEditor";
import { SyntaxCodeEditor } from "./SyntaxCodeEditor";

interface HtmlImageCardProps {
  articleId: string;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (raw: string) => void;
}

export function HtmlImageCard({ articleId, segment, readOnly, onChange }: HtmlImageCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(segment.raw);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<EditorView | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<number | null>(null);
  const wasImage = useRef(Boolean(parseHtmlImages(segment.raw)));
  const images = parseHtmlImages(draft);

  useLayoutEffect(() => {
    if (wasImage.current && !images && bodyRef.current && !readOnly) {
      inputRef.current = null;
      bodyRef.current.focus();
      const position = Math.min(pendingSelection.current ?? draft.length, draft.length);
      bodyRef.current.setSelectionRange(position, position);
    } else if (!wasImage.current && images && editing && inputRef.current) {
      inputRef.current.focus();
      const position = Math.min(pendingSelection.current ?? draft.length, draft.length);
      inputRef.current.dispatch({ selection: { anchor: position } });
    }
    wasImage.current = Boolean(images);
  }, [draft, images, readOnly]);

  useEffect(() => {
    if (!editing) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !cardRef.current?.contains(event.target)) {
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
    <Stack spacing={1} ref={cardRef} className="html-image-view">
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
            <Box>
              <SyntaxCodeEditor
                label="图片 HTML 源码"
                language="html"
                value={draft}
                readOnly={false}
                onChange={change}
                onReady={(view) => {
                  inputRef.current = view;
                  const position = Math.min(pendingSelection.current ?? draft.length, draft.length);
                  view.dispatch({ selection: { anchor: position } });
                  if (pendingSelection.current !== null) view.focus();
                  pendingSelection.current = null;
                }}
              />
            </Box>
          )}
          {images.map((image, index) => {
            const src = mediaPreviewUrl(articleId, image.src);
            return (
              <Box
                key={`${image.src}:${index}`}
                component={readOnly ? "span" : "button"}
                type={readOnly ? undefined : "button"}
                aria-label={readOnly ? undefined : `编辑图片源码：${image.alt || image.src}`}
                onClick={(event: MouseEvent<HTMLElement>) => {
                  if (readOnly) return;
                  event.preventDefault();
                  pendingSelection.current = null;
                  event.currentTarget.focus();
                  setEditing(true);
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
                  change(removeHtmlImage(draft, index), 0);
                  if (images.length > 1) {
                    requestAnimationFrame(() => {
                      cardRef.current
                        ?.querySelectorAll<HTMLButtonElement>("button")
                        [Math.min(index, images.length - 2)]?.focus();
                    });
                  }
                }}
                sx={{
                  display: "block",
                  p: 0,
                  border: 0,
                  background: "transparent",
                  cursor: readOnly ? "default" : "pointer",
                  textAlign: "left",
                  width: "fit-content",
                  maxWidth: "100%",
                  borderRadius: 1,
                  "&:focus": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 3,
                  },
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
