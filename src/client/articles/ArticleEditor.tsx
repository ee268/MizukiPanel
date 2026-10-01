import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import DriveFileRenameOutline from "@mui/icons-material/DriveFileRenameOutline";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import type { ArticleRecord } from "../types";
import { FrontmatterEditor } from "./FrontmatterEditor";
import { VisualBodyEditor } from "./VisualBodyEditor";
import type { ArticleEditorMode, FrontmatterRow } from "./types";

interface ArticleEditorProps {
  article: ArticleRecord | null;
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
  if (!article) {
    return (
      <Paper variant="outlined" sx={{ p: 8, textAlign: "center" }}>
        <Typography variant="h5">正在读取文章</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          正在加载 Frontmatter 与 Markdown/MDX 源码。
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
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
        <Tabs
          value={article.error ? "source" : mode}
          onChange={(_, value: ArticleEditorMode) => onModeChange(value)}
          sx={{ px: 2 }}
        >
          <Tab value="visual" label="可视化正文" disabled={Boolean(article.error)} />
          <Tab value="frontmatter" label="Frontmatter" disabled={Boolean(article.error)} />
          <Tab value="source" label="完整源码" />
        </Tabs>
        <Divider />

        {mode === "visual" && !article.error ? (
          <VisualBodyEditor
            key={`${article.id}:${article.version}`}
            article={article}
            source={source}
            busy={busy}
            readOnly={readOnly}
            onChange={onSourceChange}
            onSave={onSaveBody}
            onSourceMode={() => onModeChange("source")}
          />
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
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <TextField
              label="完整文章源码"
              value={source}
              onChange={(event) => onSourceChange(event.target.value)}
              fullWidth
              multiline
              minRows={24}
              disabled={busy || readOnly}
              spellCheck={false}
              slotProps={{
                input: { sx: { fontFamily: "monospace", fontSize: 14, lineHeight: 1.6 } },
              }}
            />
            <Stack direction="row" sx={{ mt: 2, justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                startIcon={<SaveOutlined />}
                onClick={onSaveSource}
                disabled={busy || readOnly}
              >
                保存源码
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
