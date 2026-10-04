import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  rootCtx,
} from "@milkdown/kit/core";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { Box, Typography, useTheme } from "@mui/material";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { SourceSegment } from "../../lib/articles/source-islands";
import { mediaPreviewUrl } from "./article-media";
import { readFormatState, type EditorFormatState } from "./editor-format";
import { articleShortcut, type EditorShortcut } from "./editor-shortcuts";
import { createMilkdownCodeBlock } from "./MilkdownCodeBlock";
import { remarkImageTitle } from "./remark-image-title";

interface MilkdownSegmentProps {
  articleId: string;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (markdown: string) => void;
  onFocus: () => void;
  onReady: (editor: Editor | null) => void;
  onFormatChange: (format: EditorFormatState) => void;
  onShortcut: (shortcut: EditorShortcut) => void;
}

function SegmentEditor({
  articleId,
  segment,
  readOnly,
  onChange,
  onFocus,
  onReady,
  onFormatChange,
  onShortcut,
}: MilkdownSegmentProps) {
  const theme = useTheme();
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);
  const onFormatChangeRef = useRef(onFormatChange);
  const onShortcutRef = useRef(onShortcut);
  const formatFrame = useRef<number | null>(null);
  onChangeRef.current = onChange;
  onReadyRef.current = onReady;
  onFormatChangeRef.current = onFormatChange;
  onShortcutRef.current = onShortcut;
  const currentMarkdown = useRef(segment.raw);
  const { get, loading } = useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, currentMarkdown.current);
          ctx.set(editorViewOptionsCtx, {
            editable: () => !readOnly,
            nodeViews: {
              code_block: (node, view, getPos) =>
                createMilkdownCodeBlock(node, view, getPos, readOnly),
              image: (node) => {
                const dom = document.createElement("img");
                dom.loading = "lazy";

                function updateImage(src: string, alt: string, title: string) {
                  const preview = mediaPreviewUrl(articleId, src);
                  if (preview) {
                    dom.src = preview;
                  } else {
                    dom.removeAttribute("src");
                  }
                  dom.alt = alt;
                  dom.title = title;
                }

                updateImage(node.attrs.src, node.attrs.alt, node.attrs.title);
                return {
                  dom,
                  update(next) {
                    if (next.type !== node.type) {
                      return false;
                    }
                    updateImage(next.attrs.src, next.attrs.alt, next.attrs.title);
                    return true;
                  },
                };
              },
              list_item: (node, view, getPos) => {
                const dom = document.createElement("li");
                const contentDOM = document.createElement("div");
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.setAttribute("aria-label", "切换任务完成状态");
                dom.append(contentDOM);
                let current = node;

                function updateItem(next: typeof node) {
                  current = next;
                  const task = next.attrs.checked !== null;
                  if (task) {
                    dom.dataset.itemType = "task";
                    checkbox.checked = Boolean(next.attrs.checked);
                    if (!checkbox.isConnected) {
                      dom.insertBefore(checkbox, contentDOM);
                    }
                  } else {
                    delete dom.dataset.itemType;
                    checkbox.remove();
                  }
                }

                checkbox.addEventListener("change", () => {
                  const position = getPos();
                  if (typeof position !== "number") {
                    return;
                  }
                  view.dispatch(
                    view.state.tr.setNodeMarkup(position, undefined, {
                      ...current.attrs,
                      checked: checkbox.checked,
                    }),
                  );
                });
                updateItem(node);
                return {
                  dom,
                  contentDOM,
                  update(next) {
                    if (next.type !== node.type) {
                      return false;
                    }
                    updateItem(next);
                    return true;
                  },
                  stopEvent(event) {
                    return event.target === checkbox;
                  },
                };
              },
            },
          });
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, previous) => {
            if (markdown !== previous) {
              currentMarkdown.current = markdown;
              onChangeRef.current(markdown);
            }
          });
          const updateFormat = () => {
            if (formatFrame.current !== null) {
              cancelAnimationFrame(formatFrame.current);
            }
            formatFrame.current = requestAnimationFrame(() => {
              formatFrame.current = null;
              onFormatChangeRef.current(readFormatState(ctx.get(editorViewCtx).state));
            });
          };
          ctx.get(listenerCtx).selectionUpdated(updateFormat);
          ctx.get(listenerCtx).updated(updateFormat);
          ctx.get(listenerCtx).destroy(() => {
            if (formatFrame.current !== null) {
              cancelAnimationFrame(formatFrame.current);
              formatFrame.current = null;
            }
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(remarkImageTitle)
        .use(history)
        .use(listener),
    [articleId, readOnly],
  );
  const getRef = useRef(get);
  getRef.current = get;

  useEffect(() => {
    if (loading) {
      return;
    }

    onReadyRef.current(getRef.current() ?? null);
    return () => onReadyRef.current(null);
  }, [loading]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(".mizuki-inserted-code-toolbar")
    ) {
      return;
    }
    if (
      (event.nativeEvent.isComposing || event.keyCode === 229) &&
      (event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const shortcut = articleShortcut(event);
    if (shortcut && shortcut !== "save") {
      event.preventDefault();
      event.stopPropagation();
      onShortcutRef.current(shortcut);
    }
  }

  return (
    <Box
      onFocusCapture={onFocus}
      onKeyDownCapture={handleKeyDown}
      sx={{
        "& .milkdown .editor": {
          minHeight: 56,
          outline: "none",
          border: 0,
          boxShadow: "none",
          fontSize: "1rem",
          lineHeight: 1.85,
          color: "text.primary",
          overflowWrap: "anywhere",
        },
        "& .milkdown .ProseMirror": {
          outline: "none",
          border: 0,
          boxShadow: "none",
        },
        "& .milkdown .ProseMirror:focus, & .milkdown .ProseMirror:focus-visible, & .milkdown .ProseMirror.ProseMirror-focused":
          {
            outline: "none",
            border: 0,
            boxShadow: "none",
          },
        "& .milkdown .editor > :first-of-type": { mt: 0 },
        "& .milkdown .editor > :last-child": { mb: 0 },
        "& .milkdown h1, & .milkdown h2, & .milkdown h3": { lineHeight: 1.35 },
        "& .milkdown h1": { fontSize: "2rem" },
        "& .milkdown h2": { fontSize: "1.6rem" },
        "& .milkdown h3": { fontSize: "1.3rem" },
        "& .milkdown blockquote": {
          borderLeft: "3px solid",
          borderColor: "primary.main",
          pl: 2,
          ml: 0,
          color: "text.secondary",
        },
        "& .mizuki-inserted-code-card": {
          position: "relative",
          py: 2.5,
          px: 2,
          my: 1.5,
          border: 0,
          borderRadius: "15px",
          overflowX: "auto",
          backgroundColor: theme.palette.mode === "dark" ? "#0b110e" : "#e5e9ed",
          color: "text.primary",
          fontSize: "1rem",
          lineHeight: 1.6,
        },
        "& .mizuki-inserted-code-card.is-editing": { py: 2 },
        "& .mizuki-inserted-code-content": {
          display: "flex",
          alignItems: "flex-start",
        },
        "& .mizuki-inserted-code-toolbar": {
          display: "none",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 1.5,
          mb: 1.5,
        },
        "& .mizuki-inserted-code-card.is-editing .mizuki-inserted-code-toolbar": {
          display: "flex",
        },
        "& .mizuki-inserted-code-toolbar input": {
          width: 180,
          maxWidth: "100%",
          p: 1,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          outline: "none",
          backgroundColor: "transparent",
          color: "text.primary",
          font: "inherit",
        },
        "& .mizuki-inserted-code-toolbar input:focus": { borderColor: "primary.main" },
        "& .mizuki-inserted-code-toolbar button": {
          border: 0,
          backgroundColor: "transparent",
          color: "error.main",
          font: "inherit",
          cursor: "pointer",
        },
        "& .mizuki-inserted-code-gutter": {
          flex: "none",
          width: 26,
          mr: 2.5,
          pr: 0.5,
          borderRight: "1px solid",
          borderColor: "divider",
          color: "text.secondary",
          textAlign: "right",
          whiteSpace: "pre",
          pointerEvents: "none",
        },
        "& .mizuki-inserted-code-card pre": {
          flex: "1 0 auto",
          m: 0,
          pr: 7,
          backgroundColor: "transparent",
          color: "inherit",
          fontSize: "inherit",
          lineHeight: "inherit",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        },
        "& .mizuki-inserted-code-language": {
          position: "absolute",
          top: 8,
          right: 10,
          px: 1,
          py: 0.4,
          borderRadius: "0.375rem",
          backgroundColor: `color-mix(in srgb, ${theme.palette.primary.main} 25%, transparent)`,
          color: "primary.main",
          fontFamily: "var(--mizuki-panel-font-mono)",
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.2,
          textTransform: "uppercase",
          pointerEvents: "none",
        },
        "& .mizuki-inserted-code-card.is-editing .mizuki-inserted-code-language": {
          display: "none",
        },
        "& .milkdown code": { fontFamily: "var(--mizuki-panel-font-mono)" },
        "& .mizuki-inserted-code-card code": {
          fontFamily: "MizukiEditorBody, MizukiEditorCjk, var(--mizuki-panel-font-sans)",
          fontSize: "inherit",
          lineHeight: "inherit",
          whiteSpace: "inherit",
        },
        "& .milkdown :not(pre) > code": {
          backgroundColor: "color-mix(in srgb, var(--mui-palette-primary-main) 25%, transparent)",
          borderRadius: "0.375rem",
          color: "primary.main",
          fontSize: "inherit",
          fontWeight: 600,
          px: 0.7,
          py: 0.25,
        },
        "& .milkdown img": { maxWidth: "100%" },
        "& .milkdown table": { borderCollapse: "collapse", display: "block", overflowX: "auto" },
        "& .milkdown td, & .milkdown th": {
          border: "1px solid",
          borderColor: "divider",
          px: 1.5,
          py: 0.75,
        },
        '& .milkdown li[data-item-type="task"]': {
          display: "flex",
          alignItems: "flex-start",
          gap: 1,
          listStyle: "none",
        },
        '& .milkdown li[data-item-type="task"] > input': {
          mt: "0.45em",
          accentColor: "primary.main",
        },
        '& .milkdown li[data-item-type="task"] > div > p': { my: 0 },
      }}
    >
      {loading && <Typography color="text.secondary">正在加载编辑器…</Typography>}
      <Milkdown />
    </Box>
  );
}

export function MilkdownSegment(props: MilkdownSegmentProps) {
  return (
    <MilkdownProvider>
      <SegmentEditor {...props} />
    </MilkdownProvider>
  );
}
