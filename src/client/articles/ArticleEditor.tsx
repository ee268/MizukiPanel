import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import DriveFileRenameOutline from "@mui/icons-material/DriveFileRenameOutline";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { useEffect, useState, type KeyboardEvent } from "react";
import { Alert, Box, Button, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import type { ArticleRecord } from "../types";
import { ArticleSourceEditor } from "./ArticleSourceEditor";
import { FrontmatterEditor } from "./FrontmatterEditor";
import { VisualBodyEditor } from "./VisualBodyEditor";
import { articleShortcut } from "./editor-shortcuts";
import type { ArticleEditorMode, FrontmatterRow } from "./types";
import { useArticleModeScroll } from "./useArticleModeScroll";
import { useEditorFontMode } from "./useEditorFontMode";
import { ArticleLoading } from "./ArticleLoading";
import { collectSourceIslandEdits } from "../../lib/articles/source-island-edits";
import "./editor-fonts.css";

interface ArticleEditorProps {
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
  const fontMode = useEditorFontMode(projectRoot);
  const { visualRef, sourceRef, changeMode } = useArticleModeScroll(mode, onModeChange);

  useEffect(() => {
    setVisualValid(true);
  }, [article?.id, article?.version]);

  function saveVisualBody() {
    if (!article) return;
    try {
      collectSourceIslandEdits(article.source, source, article.format);
      onSaveBody();
    } catch {
      // A literal or malformed fragment may become valid syntax while being fixed.
      onSaveSource();
    }
  }

  function handleSaveShortcut(event: KeyboardEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.target as Node) || articleShortcut(event) !== "save") {
      return;
    }
    event.preventDefault();
    if (busy || readOnly) {
      return;
    }
    if (mode === "frontmatter" && !article?.error) {
      onSaveFrontmatter();
    } else if (mode === "visual" && article && !article.error && visualValid) {
      saveVisualBody();
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
            {dirty && (
              <Typography variant="caption" color="warning.main">
                有未保存修改
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
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
            onChange={(_, value: ArticleEditorMode) => changeMode(value)}
            sx={{ px: 2 }}
          >
            <Tab value="visual" label="文档编辑" disabled={Boolean(article.error)} />
            <Tab value="frontmatter" label="Frontmatter" disabled={Boolean(article.error)} />
          </Tabs>
        )}

        {mode === "visual" && !article.error ? (
          <Box ref={visualRef}>
            <VisualBodyEditor
              key={`${projectRoot}:${article.id}:${article.version}`}
              article={article}
              source={source}
              busy={busy}
              readOnly={readOnly}
              fontMode={fontMode}
              onChange={onSourceChange}
              onSave={saveVisualBody}
              onSourceMode={() => changeMode("source")}
              onValidityChange={setVisualValid}
            />
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
            canUseVisual={!article.error}
            contentRef={sourceRef}
            onChange={onSourceChange}
            onVisualMode={() => changeMode("visual")}
            onSave={onSaveSource}
          />
        )}
      </Paper>
    </Stack>
  );
}
