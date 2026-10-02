import type { Editor } from "@milkdown/kit/core";
import { Alert, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useMemo, useRef, useState } from "react";
import { parseGithubAlert } from "../../lib/articles/github-alerts";
import { parseInlineExtension } from "../../lib/articles/inline-extensions";
import { parseMizukiDirective } from "../../lib/articles/mizuki-directives";
import {
  replaceArticleSegments,
  segmentArticleSource,
  type SourceSegment,
} from "../../lib/articles/source-islands";
import type { ArticleRecord } from "../types";
import { ArticleFormatToolbar } from "./ArticleFormatToolbar";
import { DirectiveBlock } from "./DirectiveBlock";
import { GithubAlertBlock } from "./GithubAlertBlock";
import { InlineExtensionCard } from "./InlineExtensionCard";
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

interface VisualBodyEditorProps {
  article: ArticleRecord;
  source: string;
  busy: boolean;
  readOnly: boolean;
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
  onChange,
  onSave,
  onSourceMode,
  onValidityChange,
}: VisualBodyEditorProps) {
  const [snapshot] = useState(() => segmentArticleSource(source, article.format));
  const directives = useMemo(
    () =>
      new Map(
        snapshot.segments
          .filter((segment) => segment.mode === "source")
          .map((segment) => [segment.id, parseMizukiDirective(segment.raw)]),
      ),
    [snapshot],
  );
  const inlineExtensions = useMemo(
    () =>
      new Map(
        snapshot.segments
          .filter((segment) => segment.syntax === "wikiLink" || segment.syntax === "textDirective")
          .map((segment) => [segment.id, parseInlineExtension(segment.raw)]),
      ),
    [snapshot],
  );
  const githubAlerts = useMemo(
    () =>
      new Map(
        snapshot.segments
          .filter((segment) => segment.syntax === "githubAdmonition")
          .map((segment) => [segment.id, parseGithubAlert(segment.raw)]),
      ),
    [snapshot],
  );
  const replacements = useRef(new Map<number, string>());
  const editors = useRef(new Map<number, Editor>());
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(
    snapshot.segments.find((segment) => segment.mode === "editable")?.id ?? null,
  );
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
    const leftInline = segment.start > 0 && !/[\r\n]/.test(snapshot.body[segment.start - 1]);
    const rightInline =
      segment.end < snapshot.body.length && !/[\r\n]/.test(snapshot.body[segment.end]);
    const replacement = preserveSegmentBoundary(segment.raw, markdown, leftInline, rightInline);
    replaceSegment(segment, replacement);
  }

  function replaceSegment(segment: SourceSegment, replacement: string) {
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

  if (snapshot.mode === "source") {
    return (
      <Alert severity="warning" sx={{ m: 3 }}>
        无法安全分段正文：{snapshot.reason}。请使用
        <Button size="small" onClick={onSourceMode}>
          完整源码
        </Button>
        编辑。
      </Alert>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
      <Alert severity="info">
        普通 Markdown、已识别的 Mizuki 指令、Wiki Link、Spoiler 和 GitHub
        风格提示块可在此编辑。其他扩展语法与 MDX 仍保留原文，请切换完整源码修改。
      </Alert>
      <ArticleFormatToolbar
        disabled={!activeEditor || busy || readOnly}
        saving={busy || readOnly || !extensionsValid}
        format={format}
        onAction={formatAction}
        onHeading={headingAction}
        onTable={insertTable}
        onTask={insertTask}
        onLink={openLink}
        onImage={() => setImageOpen(true)}
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
      <Paper variant="outlined" inert={busy} sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={1.5}>
          {snapshot.segments.map((segment) => {
            if (segment.mode === "editable") {
              return (
                <MilkdownSegment
                  key={segment.id}
                  articleId={article.id}
                  segment={segment}
                  readOnly={readOnly}
                  onChange={(markdown) => updateSegment(segment, markdown)}
                  onFocus={() => selectSegment(segment.id)}
                  onReady={(editor) => registerSegment(segment.id, editor)}
                  onFormatChange={(next) => updateFormat(segment.id, next)}
                  onShortcut={handleShortcut}
                />
              );
            }
            const directive = directives.get(segment.id);
            if (directive) {
              return (
                <DirectiveBlock
                  key={segment.id}
                  articleId={article.id}
                  directive={directive}
                  readOnly={readOnly}
                  onChange={(raw) => replaceSegment(segment, raw)}
                  onValidityChange={(valid) => updateExtensionValidity(segment.id, valid)}
                />
              );
            }
            const inline = inlineExtensions.get(segment.id);
            if (inline) {
              return (
                <InlineExtensionCard
                  key={segment.id}
                  extension={inline}
                  readOnly={readOnly}
                  onChange={(raw) => replaceSegment(segment, raw)}
                  onValidityChange={(valid) => updateExtensionValidity(segment.id, valid)}
                />
              );
            }
            const githubAlert = githubAlerts.get(segment.id);
            if (githubAlert) {
              return (
                <GithubAlertBlock
                  key={segment.id}
                  alert={githubAlert}
                  readOnly={readOnly}
                  onChange={(raw) => replaceSegment(segment, raw)}
                  onValidityChange={(valid) => updateExtensionValidity(segment.id, valid)}
                />
              );
            }
            return (
              <Paper
                key={segment.id}
                variant="outlined"
                sx={{ p: 1.5, backgroundColor: "action.hover" }}
              >
                <Chip size="small" label={segment.syntax ?? "源码片段"} sx={{ mb: 1 }} />
                <Typography
                  component="pre"
                  sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13 }}
                >
                  {segment.raw}
                </Typography>
              </Paper>
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
