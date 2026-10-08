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
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import type { SourceSegment } from "../../lib/articles/source-islands";
import { mediaPreviewUrl } from "./article-media";
import { readFormatState, type EditorFormatState } from "./editor-format";
import { articleShortcut, type EditorShortcut } from "./editor-shortcuts";
import { createMilkdownCodeBlock, type ThemedCodeBlockView } from "./MilkdownCodeBlock";
import { createMilkdownLinkSource } from "./MilkdownLinkSource";
import { remarkImageTitle } from "./remark-image-title";
import { remarkLooseStrong } from "./remark-loose-strong";

interface MilkdownSegmentProps {
  articleId: string;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (markdown: string) => void;
  onFocus: () => void;
  onReady: (editor: Editor | null) => void;
  onFormatChange: (format: EditorFormatState) => void;
  onShortcut: (shortcut: EditorShortcut) => void;
  onValidityChange: (valid: boolean) => void;
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
  onValidityChange,
}: MilkdownSegmentProps) {
  const theme = useTheme();
  const themeRef = useRef(theme);
  const codeBlockViews = useRef(new Set<ThemedCodeBlockView>());
  themeRef.current = theme;

  useLayoutEffect(() => {
    codeBlockViews.current.forEach((view) => view.refreshTheme());
  }, [theme]);
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);
  const onFormatChangeRef = useRef(onFormatChange);
  const onShortcutRef = useRef(onShortcut);
  const onValidityChangeRef = useRef(onValidityChange);
  const invalidCodeBlocks = useRef(new Set<symbol>());
  const formatFrame = useRef<number | null>(null);
  onChangeRef.current = onChange;
  onReadyRef.current = onReady;
  onFormatChangeRef.current = onFormatChange;
  onShortcutRef.current = onShortcut;
  onValidityChangeRef.current = onValidityChange;
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
              code_block: (node, view, getPos) => {
                const id = Symbol("code-block");
                let codeBlockView: ThemedCodeBlockView;
                codeBlockView = createMilkdownCodeBlock(
                  node,
                  view,
                  getPos,
                  readOnly,
                  () => themeRef.current,
                  (valid) => {
                    if (valid) invalidCodeBlocks.current.delete(id);
                    else invalidCodeBlocks.current.add(id);
                    onValidityChangeRef.current(invalidCodeBlocks.current.size === 0);
                  },
                  () => codeBlockViews.current.delete(codeBlockView),
                );
                codeBlockViews.current.add(codeBlockView);
                return codeBlockView;
              },
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
        .use(remarkLooseStrong)
        .use(remarkImageTitle)
        .use(createMilkdownLinkSource(readOnly))
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
      event.target.classList.contains("markdown-link-source-input")
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
          color: "text.secondary",
          overflowWrap: "anywhere",
        },
        "& .milkdown .editor strong": {
          color: "text.primary",
          fontWeight: 700,
        },
        "& .milkdown .editor a[href]": {
          color: "primary.main",
          textDecorationLine: "underline",
          textDecorationStyle: "dashed",
          textDecorationThickness: "1px",
          textUnderlineOffset: "0.2em",
        },
        "& .markdown-link-source": {
          position: "relative",
          display: "inline-block",
          maxWidth: "100%",
          verticalAlign: "bottom",
          color: "text.primary",
        },
        "& .markdown-link-source-measure": {
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        },
        "& .markdown-link-source-destination": { color: "primary.main" },
        "& .markdown-link-source-input": {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          p: 0,
          border: 0,
          outline: "none",
          resize: "none",
          overflow: "hidden",
          background: "transparent",
          color: "transparent",
          caretColor: "text.primary",
          font: "inherit",
          lineHeight: "inherit",
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
        "& .milkdown h1, & .milkdown h2, & .milkdown h3": {
          color: "text.primary",
          lineHeight: 1.35,
        },
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
        "& .milkdown code": { fontFamily: "var(--mizuki-panel-font-mono)" },
        "& .milkdown :not(pre) > code": {
          backgroundColor: "color-mix(in srgb, var(--mui-palette-primary-main) 25%, transparent)",
          borderRadius: "0.375rem",
          color: "primary.main",
          fontSize: "inherit",
          fontWeight: 600,
          px: 0.7,
          py: 0.25,
        },
        "& .milkdown img": { maxWidth: "100%", borderRadius: 1 },
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
