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
import { ImageCaret, type ImageSide } from "./ImageCaret";

interface HtmlImageCardProps {
  articleId: string;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (raw: string) => void;
}

export function HtmlImageCard({ articleId, segment, readOnly, onChange }: HtmlImageCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(segment.raw);
  const [beforeText, setBeforeText] = useState("");
  const [afterText, setAfterText] = useState("");
  const beforeRef = useRef<HTMLTextAreaElement>(null);
  const afterRef = useRef<HTMLTextAreaElement>(null);
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
    emit(next);
  }

  function emit(markup = draft, before = beforeText, after = afterText) {
    // These are ordinary body paragraphs, separate from the protected HTML.
    const literal = (text: string) =>
      text.replace(/[\\`*{}[\]()#+.!_>~|]/g, "\\$&").replaceAll("\n", "  \n");
    onChange(
      (before ? literal(before) + "\n\n" : "") + markup + (after ? "\n\n" + literal(after) : ""),
    );
  }

  function insert(side: ImageSide, text: string) {
    if (readOnly || !text) return;
    if (side === "before") {
      const next = beforeText + text;
      setBeforeText(next);
      emit(draft, next, afterText);
    } else {
      const next = text + afterText;
      setAfterText(next);
      emit(draft, beforeText, next);
    }
    requestAnimationFrame(() => {
      const input = side === "before" ? beforeRef.current : afterRef.current;
      input?.focus();
      const offset = side === "before" ? beforeText.length + text.length : text.length;
      input?.setSelectionRange(offset, offset);
    });
  }

  function focusOutside(side: ImageSide) {
    const own = side === "before" ? beforeRef.current : afterRef.current;
    const candidates = [
      ...document.querySelectorAll<HTMLElement>(
        '.ProseMirror[contenteditable="true"], textarea:not([readonly])',
      ),
    ].filter((item) => {
      const card = cardRef.current;
      return (
        card &&
        !card.contains(item) &&
        Boolean(
          item.compareDocumentPosition(card) &
          (side === "before" ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING),
        )
      );
    });
    const target = own ?? (side === "before" ? candidates.at(-1) : candidates[0]);
    if (!target) return;
    target.focus();
    if (target instanceof HTMLTextAreaElement) {
      const offset = side === "before" ? target.value.length : 0;
      target.setSelectionRange(offset, offset);
    } else {
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(side === "after");
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  }

  function move(side: ImageSide, direction: "left" | "right") {
    if (
      (side === "before" && direction === "right") ||
      (side === "after" && direction === "left")
    ) {
      cardRef.current
        ?.querySelector<HTMLElement>(
          `[data-image-side="${side === "before" ? "after" : "before"}"]`,
        )
        ?.focus();
    } else {
      focusOutside(side);
    }
  }

  function caretDelete(side: ImageSide, key: "Backspace" | "Delete") {
    if (!images || readOnly) return;
    if ((side === "before" && key === "Delete") || (side === "after" && key === "Backspace")) {
      change(removeHtmlImage(draft, side === "before" ? 0 : images.length - 1), 0);
      requestAnimationFrame(() =>
        cardRef.current?.querySelector<HTMLElement>(`[data-image-side="${side}"]`)?.focus(),
      );
    } else {
      focusOutside(side);
    }
  }

  return (
    <Stack spacing={1} ref={cardRef} className="html-image-view">
      {beforeText && (
        <LiteralSourceEditor
          segment={segment}
          value={beforeText}
          textareaRef={beforeRef}
          ariaLabel="HTML 图片前正文"
          readOnly={readOnly}
          onChange={(text) => {
            setBeforeText(text);
            emit(draft, text, afterText);
          }}
        />
      )}
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
          <Box
            component="span"
            className="image-preview-row"
            sx={{ display: "flex", alignItems: "flex-end", width: "100%" }}
          >
            <ImageCaret
              label="HTML 图片前光标"
              side="before"
              readOnly={readOnly}
              onDelete={caretDelete}
              onInsert={insert}
              onMove={move}
            />
            <Stack
              component="span"
              spacing={1}
              sx={{ minWidth: 0, flexShrink: 1, maxWidth: readOnly ? "100%" : "calc(100% - 24px)" }}
            >
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
            </Stack>
            <ImageCaret
              label="HTML 图片后光标"
              side="after"
              readOnly={readOnly}
              onDelete={caretDelete}
              onInsert={insert}
              onMove={move}
            />
          </Box>
        </>
      )}
      {afterText && (
        <LiteralSourceEditor
          segment={segment}
          value={afterText}
          textareaRef={afterRef}
          ariaLabel="HTML 图片后正文"
          readOnly={readOnly}
          onChange={(text) => {
            setAfterText(text);
            emit(draft, beforeText, text);
          }}
        />
      )}
    </Stack>
  );
}
