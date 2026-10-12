import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  onCreateOpenChange: (open: boolean) => void;
  onRenameOpenChange: (open: boolean) => void;
  onCreate: (fields: CreationFields, preview: CreationPreview) => Promise<void>;
  readOnly: boolean;
  onRename: (event: FormEvent<HTMLFormElement>) => void;
}

export function ArticleDialogs({
  article,
  busy,
  createOpen,
  renameOpen,
  onCreateOpenChange,
  onRenameOpenChange,
  onCreate,
  readOnly,
  onRename,
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
    </>
  );
}
