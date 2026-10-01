import type { Editor } from "@milkdown/kit/core";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { Alert, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useRef, useState } from "react";
import {
  replaceArticleSegments,
  segmentArticleSource,
  type SourceSegment,
} from "../../lib/articles/source-islands";
import type { ArticleRecord } from "../types";
import { ArticleInsertBar } from "./ArticleInsertBar";
import { preserveSegmentBoundary } from "./article-draft";
import {
  insertArticleImage,
  insertArticleLink,
  insertArticleTable,
  insertArticleTask,
  selectedEditorText,
} from "./editor-commands";
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
}

export function VisualBodyEditor({
  article,
  source,
  busy,
  readOnly,
  onChange,
  onSave,
  onSourceMode,
}: VisualBodyEditorProps) {
  const [snapshot] = useState(() => segmentArticleSource(source, article.format));
  const replacements = useRef(new Map<number, string>());
  const editors = useRef(new Map<number, Editor>());
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(
    snapshot.segments.find((segment) => segment.mode === "editable")?.id ?? null,
  );
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [insertError, setInsertError] = useState("");

  function selectSegment(id: number) {
    setActiveSegmentId(id);
    setActiveEditor(editors.current.get(id) ?? null);
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
      setSelectedText(selectedEditorText(activeEditor));
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
    if (replacement === segment.raw) {
      replacements.current.delete(segment.id);
    } else {
      replacements.current.set(segment.id, replacement);
    }
    onChange(replaceArticleSegments(snapshot, replacements.current));
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
        普通 Markdown 可直接编辑。Mizuki 扩展语法与 MDX 暂以原文卡片保护；编辑它们请切换完整源码。
      </Alert>
      <ArticleInsertBar
        disabled={!activeEditor || busy || readOnly}
        onTable={insertTable}
        onTask={insertTask}
        onLink={openLink}
        onImage={() => setImageOpen(true)}
      />
      {insertError && (
        <Alert severity="warning" onClose={() => setInsertError("")}>
          {insertError}
        </Alert>
      )}
      <Paper variant="outlined" inert={busy} sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={1.5}>
          {snapshot.segments.map((segment) =>
            segment.mode === "editable" ? (
              <MilkdownSegment
                key={segment.id}
                articleId={article.id}
                segment={segment}
                readOnly={readOnly}
                onChange={(markdown) => updateSegment(segment, markdown)}
                onFocus={() => selectSegment(segment.id)}
                onReady={(editor) => registerSegment(segment.id, editor)}
              />
            ) : (
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
            ),
          )}
        </Stack>
      </Paper>
      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<SaveOutlined />}
          onClick={onSave}
          disabled={busy || readOnly}
        >
          保存正文
        </Button>
      </Stack>
      <LinkInsertDialog
        open={linkOpen}
        selectedText={selectedText}
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
