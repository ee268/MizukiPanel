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
import { CreateArticleDialog } from "./CreateArticleDialog";
import type { CreationFields, CreationPreview } from "./creation-types";

interface ArticleDialogsProps {
  article: ArticleRecord | null;
  busy: boolean;
  createOpen: boolean;
  renameOpen: boolean;
  deleteOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onRenameOpenChange: (open: boolean) => void;
  onDeleteOpenChange: (open: boolean) => void;
  onCreate: (fields: CreationFields, preview: CreationPreview) => Promise<void>;
  readOnly: boolean;
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
  readOnly,
  onRename,
  onDelete,
}: ArticleDialogsProps) {
  return (
    <>
      <CreateArticleDialog
        open={createOpen}
        busy={busy}
        readOnly={readOnly}
        onClose={() => onCreateOpenChange(false)}
        onCreate={onCreate}
      />

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
