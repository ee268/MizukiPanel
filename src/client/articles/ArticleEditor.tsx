import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import DriveFileRenameOutline from "@mui/icons-material/DriveFileRenameOutline";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import MoreHorizOutlined from "@mui/icons-material/MoreHorizOutlined";
import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import {
  Alert,
  Box,
  Button,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import type { ArticleRecord } from "../types";
import { ArticleSourceEditor } from "./ArticleSourceEditor";
import { FrontmatterEditor } from "./FrontmatterEditor";
import { VditorBodyEditor, type VditorBodyEditorHandle } from "./VditorBodyEditor";
import { articleShortcut } from "./editor-shortcuts";
import type { ArticleEditorMode, FrontmatterRow } from "./types";
import { useArticleModeScroll } from "./useArticleModeScroll";
import { useEditorFontMode } from "./useEditorFontMode";
import { ArticleLoading } from "./ArticleLoading";
import { collectSourceIslandEdits } from "../../lib/articles/source-island-edits";
import "./editor-fonts.css";

const VisualBodyEditor = lazy(() =>
  import("./VisualBodyEditor").then((module) => ({ default: module.VisualBodyEditor })),
);

interface ArticleEditorProps {
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
  onSaveSource: () => void;
  onSaveBody: () => void;
}

export function ArticleEditor({
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
  onSaveSource,
  onSaveBody,
}: ArticleEditorProps) {
  const [visualValid, setVisualValid] = useState(true);
  const [legacyEditor, setLegacyEditor] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const vditorRef = useRef<VditorBodyEditorHandle>(null);
  const fontMode = useEditorFontMode(projectRoot);
  const { visualRef, sourceRef, changeMode } = useArticleModeScroll(mode, onModeChange, source);

  useEffect(() => {
    setVisualValid(true);
  }, [article?.id, article?.version]);
  useEffect(() => {
    setLegacyEditor(false);
  }, [article?.id]);

  function saveVisualBody() {
    if (!article || temporary) return;
    try {
      collectSourceIslandEdits(article.source, source, article.format);
      onSaveBody();
    } catch {
      // A literal or malformed fragment may become valid syntax while being fixed.
      onSaveSource();
    }
  }

  const latestActions = useRef({ changeMode, saveVisualBody });
  latestActions.current = { changeMode, saveVisualBody };
  function changeEditorMode(next: ArticleEditorMode) {
    flushSync(() => vditorRef.current?.flush());
    latestActions.current.changeMode(next);
  }
  function saveDocumentBody() {
    flushSync(() => vditorRef.current?.flush());
    latestActions.current.saveVisualBody();
  }
  function switchEditor(legacy: boolean) {
    flushSync(() => vditorRef.current?.flush());
    setLegacyEditor(legacy);
    setMoreAnchor(null);
    latestActions.current.changeMode("visual");
  }

  function handleSaveShortcut(event: KeyboardEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.target as Node) || articleShortcut(event) !== "save") {
      return;
    }
    event.preventDefault();
    if (temporary || busy || readOnly) {
      return;
    }
    if (mode === "frontmatter" && !article?.error) {
      onSaveFrontmatter();
    } else if (mode === "visual" && article && !article.error && (!legacyEditor || visualValid)) {
      saveDocumentBody();
    } else if (mode === "source" || article?.error) {
      onSaveSource();
    }
  }

  if (!article) {
    return <ArticleLoading />;
  }

  return (
    <Stack spacing={2} onKeyDownCapture={handleSaveShortcut}>
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
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {!temporary && (
              <>
                {previewPath && (
                  <Button startIcon={<OpenInNewOutlined />} onClick={() => onPreview(previewPath)}>
                    真实预览
                  </Button>
                )}
                <Button startIcon={<DriveFileRenameOutline />} onClick={onRename}>
                  重命名
                </Button>
                <Button color="error" startIcon={<DeleteOutline />} onClick={onDelete}>
                  删除
                </Button>
              </>
            )}
            <Button
              startIcon={<MoreHorizOutlined />}
              aria-haspopup="menu"
              onClick={(event) => setMoreAnchor(event.currentTarget)}
              disabled={busy || Boolean(article.error)}
            >
              更多
            </Button>
            <Menu
              anchorEl={moreAnchor}
              open={Boolean(moreAnchor)}
              onClose={() => setMoreAnchor(null)}
            >
              <MenuItem
                onClick={() => switchEditor(false)}
                selected={!legacyEditor && mode === "visual"}
              >
                使用 Vditor 编辑器
              </MenuItem>
              <MenuItem
                onClick={() => switchEditor(true)}
                selected={legacyEditor && mode === "visual"}
              >
                使用备用编辑器
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>

        {article.error && (
          <Alert severity="error">
            Frontmatter 需要修复：{article.error}。请使用源码模式编辑。
          </Alert>
        )}
        {mode !== "source" && (
          <Tabs
            value={mode}
            onChange={(_, value: ArticleEditorMode) => changeEditorMode(value)}
            sx={{ px: 2 }}
          >
            <Tab value="visual" label="文档编辑" disabled={Boolean(article.error)} />
            {!temporary && (
              <Tab value="frontmatter" label="Frontmatter" disabled={Boolean(article.error)} />
            )}
          </Tabs>
        )}

        {mode === "visual" && !article.error ? (
          <Box ref={visualRef}>
            {legacyEditor ? (
              <>
                <Alert
                  severity="info"
                  action={<Button onClick={() => switchEditor(false)}>返回 Vditor</Button>}
                  sx={{ mx: { xs: 2, md: 3 }, mt: 2 }}
                >
                  正在使用备用编辑器。
                </Alert>
                <Suspense fallback={<ArticleLoading title={article.title} />}>
                  <VisualBodyEditor
                    key={`${projectRoot}:${article.id}:${article.version}`}
                    article={article}
                    source={source}
                    busy={busy}
                    readOnly={readOnly}
                    fontMode={fontMode}
                    showSave={!temporary}
                    onChange={onSourceChange}
                    onSave={saveDocumentBody}
                    onSourceMode={() => changeEditorMode("source")}
                    onValidityChange={setVisualValid}
                  />
                </Suspense>
              </>
            ) : (
              <VditorBodyEditor
                key={`${projectRoot}:${article.id}:${article.version}`}
                ref={vditorRef}
                article={article}
                source={source}
                busy={busy}
                readOnly={readOnly}
                fontMode={fontMode}
                showSave={!temporary}
                initialMode={temporary ? "ir" : undefined}
                onChange={onSourceChange}
                onSave={saveDocumentBody}
                onSourceMode={() => changeEditorMode("source")}
              />
            )}
          </Box>
        ) : mode === "frontmatter" && !article.error ? (
          <>
            {sourceDirty && (
              <Alert severity="info">
                完整源码或正文另有未保存草稿。此表单仍显示独立的 Frontmatter 草稿。
              </Alert>
            )}
            <FrontmatterEditor
              rows={frontmatter}
              busy={busy}
              readOnly={readOnly}
              onChange={onFrontmatterChange}
              onSave={onSaveFrontmatter}
            />
          </>
        ) : (
          <ArticleSourceEditor
            key={`${projectRoot}:${article.id}:${article.version}`}
            articleId={article.id}
            source={source}
            busy={busy}
            readOnly={readOnly}
            fontMode={fontMode}
            showSave={!temporary}
            canUseVisual={!article.error}
            contentRef={sourceRef}
            onChange={onSourceChange}
            onVisualMode={() => changeEditorMode("visual")}
            onSave={onSaveSource}
          />
        )}
      </Paper>
    </Stack>
  );
}
