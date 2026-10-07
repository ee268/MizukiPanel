import type { Editor } from "@milkdown/kit/core";
import { Alert, Button, Paper, Stack } from "@mui/material";
import { startTransition, useEffect, useRef, useState } from "react";
import type { SegmentedArticle, SourceSegment } from "../../lib/articles/source-islands";
import { replaceArticleSegments } from "../../lib/articles/replace-article-segments";
import type { ArticleRecord } from "../types";
import { ArticleFormatToolbar } from "./ArticleFormatToolbar";
import { preserveSegmentBoundary } from "./article-draft";
import {
  insertArticleImage,
  insertArticleLink,
  insertArticleTable,
  insertArticleTask,
  selectedEditorLink,
  selectedEditorText,
} from "./editor-commands";
import {
  editorFormatState,
  emptyFormatState,
  runFormatAction,
  setArticleHeading,
  type EditorFormatState,
  type FormatAction,
} from "./editor-format";
import type { EditorShortcut } from "./editor-shortcuts";
import { ImagePickerDialog } from "./ImagePickerDialog";
import { LinkInsertDialog } from "./LinkInsertDialog";
import { MilkdownSegment } from "./MilkdownSegment";
import { SourceSegmentEditor } from "./SourceSegmentEditor";
import { LiteralSourceEditor } from "./LiteralSourceEditor";
import { ArticleLoading } from "./ArticleLoading";
import type { SegmentResult } from "./segmentArticle.worker";
import type { EditorFontMode } from "../../lib/server/editor-fonts";

interface VisualBodyEditorProps {
  article: ArticleRecord;
  source: string;
  busy: boolean;
  readOnly: boolean;
  showSave?: boolean;
  fontMode: EditorFontMode;
  onChange: (source: string) => void;
  onSave: () => void;
  onSourceMode: () => void;
  onValidityChange: (valid: boolean) => void;
}

export function VisualBodyEditor({
  article,
  source,
  busy,
  readOnly,
  showSave = true,
  fontMode,
  onChange,
  onSave,
  onSourceMode,
  onValidityChange,
}: VisualBodyEditorProps) {
  const [snapshot, setSnapshot] = useState<SegmentedArticle | null>(null);
  const [segmentError, setSegmentError] = useState("");
  const replacements = useRef(new Map<number, string>());
  const editors = useRef(new Map<number, Editor>());
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectedHref, setSelectedHref] = useState("");
  const [insertError, setInsertError] = useState("");
  const [formats, setFormats] = useState(new Map<number, EditorFormatState>());
  const invalidExtensions = useRef(new Set<number>());
  const [extensionsValid, setExtensionsValid] = useState(true);
  const format =
    activeSegmentId === null
      ? emptyFormatState
      : (formats.get(activeSegmentId) ?? emptyFormatState);

  useEffect(() => {
    let active = true;
    const worker = new Worker(new URL("./segmentArticle.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<SegmentResult>) => {
      if (!active) return;
      if (event.data.error) {
        setSegmentError(event.data.error);
        return;
      }
      const next = event.data.snapshot;
      if (!next) {
        setSegmentError("正文解析未返回结果，请切换源码模式编辑。");
        return;
      }
      startTransition(() => {
        setActiveSegmentId(
          next.segments.find((segment) => segment.mode === "editable")?.id ?? null,
        );
        setSnapshot(next);
      });
    };
    worker.onerror = (event) => {
      event.preventDefault();
      if (active) setSegmentError("正文解析线程启动失败，请切换源码模式编辑。");
    };
    worker.postMessage({ source, format: article.format });
    return () => {
      active = false;
      worker.terminate();
    };
  }, [article.id, article.version, article.format]);

  function updateFormat(id: number, next: EditorFormatState) {
    setFormats((current) => {
      const previous = current.get(id);
      if (
        previous &&
        Object.keys(next).every(
          (key) =>
            previous[key as keyof EditorFormatState] === next[key as keyof EditorFormatState],
        )
      ) {
        return current;
      }
      const updated = new Map(current);
      updated.set(id, next);
      return updated;
    });
  }

  function refreshFormat(id: number, editor: Editor) {
    updateFormat(id, editorFormatState(editor));
  }

  function selectSegment(id: number) {
    setActiveSegmentId(id);
    const editor = editors.current.get(id) ?? null;
    setActiveEditor(editor);
    if (editor) {
      refreshFormat(id, editor);
    }
  }

  function registerSegment(id: number, editor: Editor | null) {
    if (editor) {
      editors.current.set(id, editor);
    } else {
      editors.current.delete(id);
    }
    if (id === activeSegmentId) {
      setActiveEditor(editor);
    }
    if (editor) {
      refreshFormat(id, editor);
    }
  }

  function formatAction(action: FormatAction) {
    if (!activeEditor || busy || readOnly) {
      return;
    }
    if (runFormatAction(activeEditor, action) && activeSegmentId !== null) {
      refreshFormat(activeSegmentId, activeEditor);
    }
  }

  function headingAction(level: number) {
    if (activeEditor && !busy && !readOnly) {
      setArticleHeading(activeEditor, level);
      if (activeSegmentId !== null) {
        refreshFormat(activeSegmentId, activeEditor);
      }
    }
  }

  function handleShortcut(shortcut: EditorShortcut) {
    if (busy || readOnly) {
      return;
    }
    if (shortcut === "link") {
      openLink();
    } else if (shortcut !== "save") {
      formatAction(shortcut);
    }
  }

  function insertTable() {
    if (activeEditor && !insertArticleTable(activeEditor)) {
      setInsertError("当前光标位置无法插入表格，请选择正文中的普通段落。");
    } else {
      setInsertError("");
    }
  }

  function insertTask() {
    if (activeEditor) {
      insertArticleTask(activeEditor);
      setInsertError("");
    }
  }

  function openLink() {
    if (activeEditor) {
      const existing = selectedEditorLink(activeEditor);
      setSelectedText(selectedEditorText(activeEditor) || existing?.label || "");
      setSelectedHref(existing?.href ?? "");
      setLinkOpen(true);
    }
  }

  function addLink(label: string, href: string) {
    if (activeEditor) {
      insertArticleLink(activeEditor, label, href);
      setLinkOpen(false);
    }
  }

  function addImage(alt: string, src: string) {
    if (activeEditor && insertArticleImage(activeEditor, alt, src)) {
      setImageOpen(false);
      setInsertError("");
    } else {
      setInsertError("当前光标位置无法插入图片，请选择正文中的普通段落。");
    }
  }

  function updateSegment(segment: SourceSegment, markdown: string) {
    if (!snapshot) return;
    const leftInline = segment.start > 0 && !/[\r\n]/.test(snapshot.body[segment.start - 1]);
    const rightInline =
      segment.end < snapshot.body.length && !/[\r\n]/.test(snapshot.body[segment.end]);
    const replacement = preserveSegmentBoundary(segment.raw, markdown, leftInline, rightInline);
    replaceSegment(segment, replacement);
  }

  function replaceSegment(segment: SourceSegment, replacement: string) {
    if (!snapshot) return;
    if (replacement === segment.raw) {
      replacements.current.delete(segment.id);
    } else {
      replacements.current.set(segment.id, replacement);
    }
    onChange(replaceArticleSegments(snapshot, replacements.current));
  }

  function updateExtensionValidity(id: number, valid: boolean) {
    if (valid) {
      invalidExtensions.current.delete(id);
    } else {
      invalidExtensions.current.add(id);
    }
    const nextValid = invalidExtensions.current.size === 0;
    setExtensionsValid(nextValid);
    onValidityChange(nextValid);
  }

  if (segmentError) {
    return (
      <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
        <Alert severity="error">{segmentError}</Alert>
        <Button onClick={onSourceMode} sx={{ alignSelf: "flex-start" }}>
          切换源码模式
        </Button>
      </Stack>
    );
  }

  if (!snapshot) {
    return <ArticleLoading title={article.title} phase="preparing" />;
  }

  if (snapshot.mode === "source") {
    return (
      <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
        <ArticleFormatToolbar
          mode="visual"
          disabled
          saving={busy || readOnly}
          showSave={showSave}
          format={emptyFormatState}
          onAction={() => {}}
          onHeading={() => {}}
          onTable={() => {}}
          onTask={() => {}}
          onLink={() => {}}
          onImage={() => {}}
          onModeChange={(mode) => {
            if (mode === "source") onSourceMode();
          }}
          onSave={onSave}
        />
        <Paper
          variant="outlined"
          className="mizuki-document-content"
          data-font-mode={fontMode}
          sx={{ p: { xs: 2, md: 3 } }}
        >
          <LiteralSourceEditor
            segment={snapshot.segments[0]}
            readOnly={busy || readOnly}
            onChange={(body) => onChange(source.slice(0, snapshot.bodyStart) + body)}
          />
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
      <Alert severity="info">
        普通 Markdown、已识别的 Mizuki 扩展和 MDX 组件可在此编辑。HTML
        图片直接显示，点击图片可编辑源码；未识别或错误语法按正文原文显示。
      </Alert>
      <ArticleFormatToolbar
        mode="visual"
        disabled={!activeEditor || busy || readOnly}
        saving={busy || readOnly || !extensionsValid}
        showSave={showSave}
        format={format}
        onAction={formatAction}
        onHeading={headingAction}
        onTable={insertTable}
        onTask={insertTask}
        onLink={openLink}
        onImage={() => setImageOpen(true)}
        onModeChange={(mode) => {
          if (mode === "source") {
            onSourceMode();
          }
        }}
        onSave={() => {
          if (invalidExtensions.current.size === 0) {
            onSave();
          }
        }}
      />
      {insertError && (
        <Alert severity="warning" onClose={() => setInsertError("")}>
          {insertError}
        </Alert>
      )}
      <Paper
        variant="outlined"
        inert={busy}
        className="mizuki-document-content"
        data-font-mode={fontMode}
        sx={{ p: { xs: 2, md: 3 } }}
      >
        <Stack spacing={1.5}>
          {snapshot.segments.map((segment) => {
            if (segment.mode === "editable") {
              return (
                <div
                  key={segment.id}
                  data-article-segment="editable"
                  data-source-start={segment.sourceStart}
                >
                  <MilkdownSegment
                    articleId={article.id}
                    segment={segment}
                    readOnly={readOnly}
                    onChange={(markdown) => updateSegment(segment, markdown)}
                    onFocus={() => selectSegment(segment.id)}
                    onReady={(editor) => registerSegment(segment.id, editor)}
                    onFormatChange={(next) => updateFormat(segment.id, next)}
                    onShortcut={handleShortcut}
                    onValidityChange={(valid) => updateExtensionValidity(segment.id, valid)}
                  />
                </div>
              );
            }
            return (
              <div
                key={segment.id}
                data-article-segment="source"
                data-source-start={segment.sourceStart}
                data-source-match={segment.raw.slice(0, 80)}
              >
                <SourceSegmentEditor
                  articleId={article.id}
                  article={snapshot}
                  segment={segment}
                  readOnly={readOnly}
                  onChange={(raw) => replaceSegment(segment, raw)}
                  onValidityChange={(valid) => updateExtensionValidity(segment.id, valid)}
                />
              </div>
            );
          })}
        </Stack>
      </Paper>
      <LinkInsertDialog
        open={linkOpen}
        selectedText={selectedText}
        selectedHref={selectedHref}
        onClose={() => setLinkOpen(false)}
        onInsert={addLink}
      />
      <ImagePickerDialog
        open={imageOpen}
        articleId={article.id}
        onClose={() => setImageOpen(false)}
        onInsert={addImage}
      />
    </Stack>
  );
}
