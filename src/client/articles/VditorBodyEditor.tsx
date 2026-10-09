import { Alert, Box, Button, Stack, useTheme } from "@mui/material";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type Vditor from "vditor";
import type { ArticleRecord } from "../types";
import type { EditorFontMode } from "../../lib/server/editor-fonts";
import { ImagePickerDialog } from "./ImagePickerDialog";
import {
  replaceVditorBody,
  vditorBody,
  vditorImageMarkdown,
  vditorImagePreviewUrl,
} from "./vditor-source";
import { loadVditorRuntime } from "./vditor-runtime";
import { splitArticleSource } from "../../lib/articles/article-source";
import { useOptionalPersonalSettings } from "../settings/PersonalSettingsProvider";
import "vditor/dist/index.css";
import "./vditor-editor.css";

const cdn = "/assets/vditor";
export interface VditorBodyEditorHandle {
  flush: () => void;
}
interface VditorBodyEditorProps {
  onLoadEnd?: () => void;
  article: ArticleRecord;
  source: string;
  busy: boolean;
  readOnly: boolean;
  fontMode: EditorFontMode;
  showSave?: boolean;
  initialMode?: "ir" | "sv" | "wysiwyg";
  onChange: (source: string) => void;
  onSave: () => void;
}

export const VditorBodyEditor = forwardRef<VditorBodyEditorHandle, VditorBodyEditorProps>(
  function VditorBodyEditor(
    {
      article,
      source,
      busy,
      readOnly,
      fontMode,
      showSave = true,
      initialMode,
      onChange,
      onSave,
      onLoadEnd,
    },
    ref,
  ) {
    const theme = useTheme();
    const preferences = useOptionalPersonalSettings();
    const host = useRef<HTMLDivElement>(null);
    const frame = useRef<HTMLDivElement>(null);
    const editor = useRef<Vditor | null>(null);
    const latest = useRef({ source, onChange, onSave, onLoadEnd, busy, readOnly, theme });
    latest.current = { source, onChange, onSave, onLoadEnd, busy, readOnly, theme };
    const baseline = useRef("");
    const initial = useRef({ value: "", body: "" });
    const [ready, setReady] = useState(false);
    const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
    const [error, setError] = useState("");
    const [imageOpen, setImageOpen] = useState(false);
    const imageRange = useRef<Range | null>(null);

    function flush() {
      const instance = editor.current;
      if (!instance?.vditor.lute || latest.current.readOnly || latest.current.busy) return;
      const value = instance.getValue();
      if (value === baseline.current) return;
      baseline.current = value;
      latest.current.onChange(
        replaceVditorBody(
          latest.current.source,
          value === initial.current.value ? initial.current.body : value,
        ),
      );
    }
    useImperativeHandle(ref, () => ({ flush }));

    useEffect(() => {
      let disposed = false;
      let instance: Vditor | null = null;
      let initialized = false;
      const container = host.current!;
      let originalBodyOverflow = document.body.style.overflow;
      let originalScroll = { top: 0, left: 0 };
      const fullscreenEvent = navigator.userAgent.includes("iPhone") ? "touchstart" : "click";
      const beforeFullscreen = (event: Event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target.closest('button[data-type="fullscreen"]')
        )
          return;
        if (!container.classList.contains("vditor--fullscreen") && frame.current) {
          // Keep the page height when the editor leaves normal flow.
          frame.current.style.height = `${container.offsetHeight}px`;
          originalBodyOverflow = document.body.style.overflow;
          originalScroll = { top: window.scrollY, left: window.scrollX };
        }
      };
      container.addEventListener(fullscreenEvent, beforeFullscreen, true);
      const mapped = new WeakSet<HTMLImageElement>();
      const mapImages = () => {
        container.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
          const original = image.getAttribute("src") ?? "";
          const preview = vditorImagePreviewUrl(article.id, original);
          // CSS replaces the displayed resource while the original src remains available
          // to Vditor's Markdown serializer and native undo history.
          if (preview && preview !== original) {
            const content = `url(${JSON.stringify(preview)})`;
            if (image.style.content !== content) image.style.content = content;
            mapped.add(image);
          } else if (mapped.has(image)) {
            image.style.removeProperty("content");
            mapped.delete(image);
          }
        });
      };
      const observer = new MutationObserver(mapImages);
      void Promise.all([import("vditor"), loadVditorRuntime()])
        .then(([{ default: Constructor }]) => {
          if (disposed) return;
          instance = new Constructor(container, {
            cdn,
            value: vditorBody(latest.current.source),
            mode: initialMode ?? (article.format === "mdx" ? "sv" : "ir"),
            lang: "zh_CN",
            i18n: window.VditorI18n,
            theme: latest.current.theme.palette.mode === "dark" ? "dark" : "classic",
            cache: { enable: false },
            minHeight: 480,
            height: "auto",
            toolbarConfig: { pin: true },
            fullscreen: { index: latest.current.theme.zIndex.drawer + 2 },
            undoDelay: 100,
            placeholder: "开始撰写正文…",
            icon: "material",
            resize: { enable: false },
            link: { isOpen: false },
            image: { isPreview: false },
            hint: { emojiPath: `${cdn}/dist/images/emoji` },
            toolbar: [
              "headings",
              "bold",
              "italic",
              "strike",
              "link",
              "|",
              "list",
              "ordered-list",
              "check",
              "outdent",
              "indent",
              "|",
              "quote",
              "line",
              "code",
              "inline-code",
              "table",
              {
                name: "article-image",
                tip: "插入图片",
                tipPosition: "n",
                icon: '<svg><use xlink:href="#vditor-icon-image"></use></svg>',
                click: () => {
                  if (latest.current.busy || latest.current.readOnly) return;
                  const range = window.getSelection()?.rangeCount
                    ? window.getSelection()!.getRangeAt(0)
                    : null;
                  imageRange.current =
                    range && container.contains(range.commonAncestorContainer)
                      ? range.cloneRange()
                      : null;
                  setImageOpen(true);
                },
              },
              "|",
              "undo",
              "redo",
              "|",
              "edit-mode",
              "both",
              "outline",
              {
                name: "fullscreen",
                click: () => {
                  if (!container.classList.contains("vditor--fullscreen")) {
                    if (frame.current) frame.current.style.height = "";
                    document.body.style.overflow = originalBodyOverflow;
                    window.scrollTo({ ...originalScroll, behavior: "instant" });
                  }
                  container
                    .querySelector('button[data-type="fullscreen"]')
                    ?.setAttribute(
                      "aria-label",
                      container.classList.contains("vditor--fullscreen")
                        ? "退出全屏（Esc）"
                        : "全屏",
                    );
                },
              },
            ],
            preview: {
              delay: 200,
              maxWidth: 1200,
              actions: [],
              theme: {
                current: latest.current.theme.palette.mode === "dark" ? "dark" : "light",
                path: `${cdn}/dist/css/content-theme`,
              },
              markdown: {
                sanitize: true,
                autoSpace: false,
                fixTermTypo: false,
                codeBlockPreview: true,
                mathBlockPreview: true,
              },
              hljs: {
                enable: true,
                style: latest.current.theme.palette.mode === "dark" ? "github-dark" : "github",
              },
              math: { engine: "KaTeX" },
              parse: mapImages,
            },
            input: () => flush(),
            blur: () => flush(),
            after: () => {
              initialized = true;
              if (disposed) {
                instance?.destroy();
                return;
              }
              editor.current = instance;
              for (const input of [
                instance!.vditor.ir?.element,
                instance!.vditor.wysiwyg?.element,
                instance!.vditor.sv?.element,
              ]) {
                if (!input) continue;
                input.setAttribute("aria-label", "文章 Markdown 正文");
                input.setAttribute("aria-multiline", "true");
              }
              baseline.current = instance!.getValue();
              initial.current = {
                value: baseline.current,
                body: splitArticleSource(latest.current.source)?.body ?? latest.current.source,
              };
              if (latest.current.readOnly || latest.current.busy) instance!.disabled();
              observer.observe(container, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["src"],
              });
              mapImages();
              setToolbar(instance!.vditor.toolbar?.element ?? null);
              setReady(true);
              latest.current.onLoadEnd?.();
            },
          });
        })
        .catch((cause) => {
          if (!disposed) {
            setError(cause instanceof Error ? cause.message : "编辑器加载失败");
            latest.current.onLoadEnd?.();
          }
        });
      return () => {
        disposed = true;
        observer.disconnect();
        container.removeEventListener(fullscreenEvent, beforeFullscreen, true);
        if (frame.current) frame.current.style.height = "";
        if (container.classList.contains("vditor--fullscreen")) {
          document.body.style.overflow = originalBodyOverflow;
        }
        editor.current = null;
        if (initialized) instance?.destroy();
      };
    }, [article.id, article.version, article.format, initialMode]);

    useEffect(() => {
      if (!toolbar || !host.current) return;
      const container = host.current;
      const measureToolbar = () => {
        container.style.setProperty("--panel-vditor-toolbar-height", `${toolbar.offsetHeight}px`);
      };
      const observer = new ResizeObserver(measureToolbar);
      observer.observe(toolbar);
      measureToolbar();
      return () => observer.disconnect();
    }, [toolbar]);
    useEffect(() => {
      if (!ready || !editor.current) return;
      editor.current.setTheme(
        theme.palette.mode === "dark" ? "dark" : "classic",
        theme.palette.mode === "dark" ? "dark" : "light",
        theme.palette.mode === "dark" ? "github-dark" : "github",
        `${cdn}/dist/css/content-theme`,
      );
    }, [ready, theme.palette.mode]);
    useEffect(() => {
      if (!ready || !editor.current) return;
      if (busy || readOnly) editor.current.disabled();
      else editor.current.enable();
      const imageButton = host.current?.querySelector<HTMLButtonElement>(
        'button[data-type="article-image"]',
      );
      if (imageButton) {
        imageButton.disabled = busy || readOnly;
        imageButton.classList.toggle("vditor-menu--disabled", busy || readOnly);
      }
    }, [ready, busy, readOnly]);

    return (
      <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
        {error && <Alert severity="error">Vditor 加载失败：{error}。请刷新页面重试。</Alert>}
        {article.format === "mdx" && (!initialMode || initialMode === "sv") && (
          <Alert severity="info">
            MDX 默认使用分屏源码编辑以保留组件语法。Mizuki 扩展和组件的最终效果可通过真实预览查看。
          </Alert>
        )}
        {/* Vditor owns its runtime classes; theme updates must keep the host className stable. */}
        <Box ref={frame}>
          <div
            ref={host}
            onClickCapture={(event) => {
              const instance = editor.current;
              if (
                busy ||
                readOnly ||
                event.button !== 0 ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                instance?.getCurrentMode() !== "ir" ||
                !(event.target instanceof Element)
              )
                return;
              const link = event.target.closest('.vditor-ir__node[data-type="a"]');
              if (!link || !instance.vditor.ir?.element.contains(link)) return;
              // Vditor returns early for collapsed links even when link.isOpen is false.
              // Open the existing node before its click handler resolves the caret and markers.
              link.classList.add("vditor-ir__node--expand");
              link.classList.remove("vditor-ir__node--hidden");
            }}
            onKeyDownCapture={(event) => {
              const instance = editor.current;
              if (
                event.key === "Escape" &&
                !event.nativeEvent.isComposing &&
                host.current?.classList.contains("vditor--fullscreen")
              ) {
                event.preventDefault();
                event.stopPropagation();
                host.current.querySelector('button[data-type="fullscreen"]')?.dispatchEvent(
                  new Event(navigator.userAgent.includes("iPhone") ? "touchstart" : "click", {
                    bubbles: true,
                    cancelable: true,
                  }),
                );
                return;
              }
              if (
                !instance ||
                busy ||
                readOnly ||
                event.nativeEvent.isComposing ||
                (event.key !== "Backspace" && event.key !== "Delete") ||
                instance.getCurrentMode() === "sv"
              )
                return;
              const selection = window.getSelection();
              const editable =
                instance.getCurrentMode() === "ir"
                  ? instance.vditor.ir?.element
                  : instance.vditor.wysiwyg?.element;
              if (
                !selection?.rangeCount ||
                !selection.toString() ||
                !editable?.contains(selection.getRangeAt(0).commonAncestorContainer)
              )
                return;
              // Vditor's first-key caret recording can collapse a selected HTML block.
              // Its public deletion API keeps that selection and records the resulting input.
              event.preventDefault();
              event.stopPropagation();
              instance.deleteValue();
            }}
            className="mizuki-document-content mizuki-vditor"
            data-font-mode={fontMode}
            data-body-font={
              preferences?.effective.appearance.font === "system" ? "system" : undefined
            }
            inert={busy}
            style={
              {
                "--panel-vditor-bg": theme.palette.background.paper,
                "--panel-vditor-text": theme.palette.text.secondary,
                "--panel-vditor-strong": theme.palette.text.primary,
                "--panel-vditor-accent":
                  theme.palette.mode === "dark"
                    ? "color-mix(in srgb, var(--panel-vditor-primary) 50%, white)"
                    : theme.palette.primary.dark,
                "--panel-vditor-inline-text": "var(--panel-vditor-accent)",
                "--panel-vditor-inline-bg":
                  theme.palette.mode === "dark"
                    ? "color-mix(in srgb, var(--panel-vditor-primary) 24%, transparent)"
                    : "color-mix(in srgb, var(--panel-vditor-primary) 10%, transparent)",
                "--panel-vditor-code-bg": theme.palette.background.default,
                "--panel-vditor-primary": theme.palette.primary.main,
                "--panel-vditor-border": theme.palette.divider,
                "--panel-vditor-toolbar-layer": theme.zIndex.appBar,
              } as CSSProperties
            }
          />
        </Box>
        {showSave &&
          toolbar &&
          createPortal(
            <Box className="mizuki-vditor-save">
              <Button
                size="small"
                variant="contained"
                disabled={!ready || busy || readOnly}
                onClick={onSave}
              >
                保存正文
              </Button>
            </Box>,
            toolbar,
          )}
        <ImagePickerDialog
          open={imageOpen}
          articleId={article.id}
          onClose={() => setImageOpen(false)}
          onInsert={(alt, src) => {
            const instance = editor.current;
            if (!instance || busy || readOnly) return;
            instance.focus();
            if (imageRange.current?.commonAncestorContainer.isConnected) {
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(imageRange.current);
            }
            instance.insertMD(vditorImageMarkdown(alt, src));
            flush();
            setImageOpen(false);
          }}
        />
      </Stack>
    );
  },
);
