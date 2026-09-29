import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import type { MediaItem } from "../types";

interface DeleteMediaDialogProps {
  item: MediaItem | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteMediaDialog({ item, busy, onClose, onConfirm }: DeleteMediaDialogProps) {
  return (
    <Dialog open={Boolean(item)} onClose={onClose}>
      <DialogTitle>删除媒体</DialogTitle>
      <DialogContent>
        <DialogContentText>文件会先移入面板回收目录：{item?.path}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={busy}>
          确认删除
        </Button>
      </DialogActions>
    </Dialog>
  );
}
