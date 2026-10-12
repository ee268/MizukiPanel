import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import DriveFileRenameOutline from "@mui/icons-material/DriveFileRenameOutline";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { AiWritingContext } from "../../shared/ai-writing";
import { containsApiCredential } from "../../shared/api-credentials";
import { aiCredentials } from "../ai/credentials";
import { flushSync } from "react-dom";
import { Alert, Box, Button, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import type { ArticleRecord } from "../types";
import { FrontmatterEditor } from "./FrontmatterEditor";
import { FrontmatterRepair } from "./FrontmatterRepair";
import { VditorBodyEditor, type VditorBodyEditorHandle } from "./VditorBodyEditor";
import { articleShortcut } from "./editor-shortcuts";
import type { ArticleEditorMode, FrontmatterRow } from "./types";
import { useEditorFontMode } from "./useEditorFontMode";
import { ArticleLoading } from "./ArticleLoading";
import { collectSourceIslandEdits } from "../../lib/articles/source-island-edits";
import "./editor-fonts.css";
import { useSessionRecovery } from "../auth/useSessionRecovery";
import { vditorBody } from "./vditor-source";
const AiWritingPanel = lazy(() => import("../ai/AiWritingPanel"));

interface ArticleEditorProps {
  onLoadEnd?: () => void;
  sourceRevision?: number;
  temporary?: boolean;
  article: ArticleRecord | null;
  projectRoot: string;
  previewPath: string | null;
  frontmatter: FrontmatterRow[];
  source: string;
  mode: ArticleEditorMode;
  busy: boolean;
  readOnly: boolean;
  dirty: boolean;
  sourceDirty: boolean;
  onFrontmatterChange: (rows: FrontmatterRow[]) => void;
  onSourceChange: (source: string) => void;
  onModeChange: (mode: ArticleEditorMode) => void;
  onPreview: (path: string) => void;
  onRename: () => void;
  onDelete: () => void;
  onSaveFrontmatter: () => void;
  onSaveDocument: () => void;
  onSaveBody: () => void;
}

export function ArticleEditor({
  onLoadEnd,
  sourceRevision,
  temporary = false,
  article,
  projectRoot,
  previewPath,
  frontmatter,
  source,
  mode,
  busy,
  readOnly,
  dirty,
  sourceDirty,
  onFrontmatterChange,
  onSourceChange,
  onModeChange,
  onPreview,
  onRename,
  onDelete,
  onSaveFrontmatter,
  onSaveDocument,
  onSaveBody,
}: ArticleEditorProps) {
  const vditorRef = useRef<VditorBodyEditorHandle>(null);
  const [aiContext, setAiContext] = useState<AiWritingContext | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiError, setAiError] = useState("");
  useEffect(() => {
    setAiContext(null);
    setAiOpen(false);
    setAiError("");
  }, [projectRoot, article?.id]);
  const fontMode = useEditorFontMode(projectRoot);
  const activeMode = article?.error ? "frontmatter" : mode;
  useSessionRecovery({
    label: "编辑器输入",
    prepare: () => flushSync(() => vditorRef.current?.flush(true)),
    save: async () => {},
    snapshot: () => null,
  });
  useEffect(() => {
    if (article?.error) onLoadEnd?.();
  }, [article?.id, article?.version, article?.error, onLoadEnd]);

  function saveVisualBody() {
    if (!article || temporary) return;
    try {
      collectSourceIslandEdits(article.source, source, article.format);
      onSaveBody();
    } catch {
      // Syntax repairs can change protected fragment boundaries.
      onSaveDocument();
    }
  }
  const latestSave = useRef(saveVisualBody);
  latestSave.current = saveVisualBody;
  function changeEditorMode(next: ArticleEditorMode) {
    flushSync(() => vditorRef.current?.flush());
    onModeChange(next);
  }
  function saveDocumentBody() {
    flushSync(() => vditorRef.current?.flush());
    latestSave.current();
  }
  function handleSaveShortcut(event: KeyboardEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.target as Node) || articleShortcut(event) !== "save")
      return;
    event.preventDefault();
    if (temporary || busy || readOnly) return;
    if (article?.error) onSaveDocument();
    else if (activeMode === "frontmatter") onSaveFrontmatter();
    else saveDocumentBody();
  }

  if (!article) return <ArticleLoading />;
  return (
    <Stack spacing={2} onKeyDownCapture={handleSaveShortcut}>
      {aiError && (
        <Alert severity="error" onClose={() => setAiError("")}>
          {aiError}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ overflow: "clip" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ p: 2.5, alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h5">{article.title}</Typography>
            {temporary ? (
              <Typography variant="caption" color="text.secondary">
                可在此练习；离开教程后修改会重置，重新进入即恢复默认内容。
              </Typography>
            ) : (
              dirty && (
                <Typography variant="caption" color="warning.main">
                  有未保存修改
                </Typography>
              )
            )}
          </Box>
          {!temporary && (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {previewPath && (
                <Button startIcon={<OpenInNewOutlined />} onClick={() => onPreview(previewPath)}>
                  Mizuki预览
                </Button>
              )}
              <Button startIcon={<DriveFileRenameOutline />} onClick={onRename}>
                重命名
              </Button>
              <Button color="error" startIcon={<DeleteOutline />} onClick={onDelete}>
                删除
              </Button>
            </Stack>
          )}
        </Stack>
        {article.error && (
          <Alert severity="error">
            Frontmatter 需要修复：{article.error}。请在下方修复并保存。
          </Alert>
        )}
        <Tabs
          value={activeMode}
          onChange={(_, value: ArticleEditorMode) => changeEditorMode(value)}
          sx={{ px: 2 }}
        >
          <Tab value="visual" label="文档编辑" disabled={Boolean(article.error)} />
          {!temporary && <Tab value="frontmatter" label="Frontmatter" />}
        </Tabs>
        {!article.error && (
          <Box hidden={activeMode !== "visual"}>
            <VditorBodyEditor
              key={`${projectRoot}:${article.id}:${article.version}`}
              ref={vditorRef}
              article={article}
              source={source}
              busy={busy}
              readOnly={readOnly}
              fontMode={fontMode}
              showSave={!temporary}
              autoMode={temporary ? "ir" : undefined}
              sourceRevision={sourceRevision}
              onChange={onSourceChange}
              onSave={saveDocumentBody}
              onAi={
                temporary
                  ? undefined
                  : () => {
                      try {
                        let context: AiWritingContext | undefined;
                        flushSync(() => {
                          context = vditorRef.current?.captureWritingContext();
                        });
                        if (context) {
                          setAiContext((existing) => existing ?? context!);
                          setAiOpen(true);
                        }
                      } catch (cause) {
                        setAiError(cause instanceof Error ? cause.message : "无法读取当前正文。");
                      }
                    }
              }
              onLoadEnd={onLoadEnd}
            />
          </Box>
        )}
        {activeMode === "frontmatter" &&
          (article.error ? (
            <FrontmatterRepair
              fontMode={fontMode}
              source={source}
              busy={busy}
              readOnly={readOnly}
              onChange={onSourceChange}
              onSave={onSaveDocument}
            />
          ) : (
            <>
              {sourceDirty && (
                <Alert severity="info">
                  正文另有未保存草稿。此表单仍显示独立的 Frontmatter 草稿。
                </Alert>
              )}
              <FrontmatterEditor
                fontMode={fontMode}
                rows={frontmatter}
                busy={busy}
                readOnly={readOnly}
                onChange={onFrontmatterChange}
                onSave={onSaveFrontmatter}
              />
            </>
          ))}
      </Paper>
      {aiContext && (
        <Suspense fallback={null}>
          <AiWritingPanel
            initialContext={aiContext}
            currentBody={vditorBody(source)}
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            getContext={() => {
              let context: AiWritingContext | undefined;
              flushSync(() => {
                context = vditorRef.current?.captureWritingContext();
              });
              if (!context) throw new Error("编辑器尚未就绪。");
              return context;
            }}
            title={article.title}
            disabled={busy || readOnly || Boolean(article.error)}
            onApply={(text, context) => {
              if (
                containsApiCredential(text) ||
                [aiCredentials.get("openai"), aiCredentials.get("anthropic")].some(
                  (key) => key && text.includes(key),
                )
              )
                throw new Error("建议中含有疑似 API Key，已阻止写入。");
              if (!vditorRef.current) throw new Error("编辑器尚未就绪。");
              flushSync(() => vditorRef.current!.applyWriting(text, "replace", context));
            }}
          />
        </Suspense>
      )}
    </Stack>
  );
}
