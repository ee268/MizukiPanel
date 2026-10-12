import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import type { ArticleDeleteTarget } from "./useArticleDeleteTarget";
import { ContentLoading } from "../components/ContentLoading";
export function ArticleDeleteDialog({
  target,
  loading,
  error,
  busy,
  readOnly,
  dirty,
  onClose,
  onDelete,
}: {
  target: ArticleDeleteTarget;
  loading: boolean;
  error: string;
  busy: boolean;
  readOnly: boolean;
  dirty: boolean;
  onClose: () => void;
  onDelete: (recycle: boolean) => void;
}) {
  const [recycle, setRecycle] = useState(true);
  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="delete-article-title"
    >
      <DialogTitle id="delete-article-title">删除文章</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>确定删除“{target.title}”吗？</DialogContentText>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {target.id}
          </Typography>
          {loading && (
            <ContentLoading
              heading="正在读取文章版本"
              description="读取完成后可确认删除"
              size="compact"
            />
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {dirty && (
            <Alert severity="warning">
              当前文章有未保存的修改，删除后将离开编辑器并放弃这些修改。回收站仅保留磁盘上的文章。
            </Alert>
          )}
          <FormControlLabel
            control={
              <Checkbox
                checked={recycle}
                disabled={busy}
                onChange={(event) => setRecycle(event.target.checked)}
              />
            }
            label="移入回收站"
          />
          <DialogContentText>
            {recycle
              ? "文章可在“设置 → 备份与维护 → 回收站”中恢复。"
              : "文章文件将永久删除，不会进入回收站。"}
          </DialogContentText>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          取消
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy || loading || readOnly || !target.version || Boolean(error)}
          onClick={() => onDelete(recycle)}
        >
          {busy ? "正在删除…" : recycle ? "确认移入回收站" : "确认永久删除"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
