import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import type { FormEvent } from "react";
import type { ArticleRecord } from "../types";

interface ArticleDialogsProps {
  article: ArticleRecord | null;
  busy: boolean;
  createOpen: boolean;
  renameOpen: boolean;
  deleteOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onRenameOpenChange: (open: boolean) => void;
  onDeleteOpenChange: (open: boolean) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onRename: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}

export function ArticleDialogs({
  article,
  busy,
  createOpen,
  renameOpen,
  deleteOpen,
  onCreateOpenChange,
  onRenameOpenChange,
  onDeleteOpenChange,
  onCreate,
  onRename,
  onDelete,
}: ArticleDialogsProps) {
  return (
    <>
      <Dialog open={createOpen} onClose={() => onCreateOpenChange(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={onCreate}>
          <DialogTitle>新建文章</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField name="id" label="文章文件路径" placeholder="notes/my-post.md" required />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField name="title" label="标题" required fullWidth />
                <TextField
                  name="published"
                  label="发布日期"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                  fullWidth
                />
              </Stack>
              <TextField
                name="body"
                label="正文（Markdown 或 MDX）"
                multiline
                minRows={10}
                defaultValue="# 开始写作"
                slotProps={{ input: { sx: { fontFamily: "var(--mizuki-panel-font-mono)" } } }}
              />
              <label>
                <input type="checkbox" name="draft" defaultChecked /> 先保存为草稿
              </label>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => onCreateOpenChange(false)}>取消</Button>
            <Button variant="contained" type="submit" disabled={busy}>
              创建
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={renameOpen} onClose={() => onRenameOpenChange(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={onRename}>
          <DialogTitle>重命名文章</DialogTitle>
          <DialogContent>
            <TextField
              name="nextId"
              label="相对于 posts 的新路径"
              defaultValue={article?.id}
              fullWidth
              required
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => onRenameOpenChange(false)}>取消</Button>
            <Button variant="contained" type="submit" disabled={busy}>
              重命名
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => onDeleteOpenChange(false)}>
        <DialogTitle>删除文章</DialogTitle>
        <DialogContent>
          <DialogContentText>文章将移入面板回收目录：{article?.id}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onDeleteOpenChange(false)}>取消</Button>
          <Button color="error" variant="contained" onClick={onDelete} disabled={busy}>
            确认删除
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
