import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import type { PublishOverview } from "../types";
import type { PublishDialog } from "./usePublish";

interface PublishDialogsProps {
  overview: PublishOverview | null;
  diffPath: string;
  diff: string;
  dialog: PublishDialog;
  busy: boolean;
  onCloseDiff: () => void;
  onCloseDialog: () => void;
  onPush: () => void;
  onRevert: () => void;
}

export function PublishDialogs({
  overview,
  diffPath,
  diff,
  dialog,
  busy,
  onCloseDiff,
  onCloseDialog,
  onPush,
  onRevert,
}: PublishDialogsProps) {
  return (
    <>
      <Dialog open={Boolean(diffPath)} onClose={onCloseDiff} fullWidth maxWidth="lg">
        <DialogTitle>文件差异 · {diffPath}</DialogTitle>
        <DialogContent>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              bgcolor: "#111827",
              color: "#e5e7eb",
              borderRadius: 1,
              overflow: "auto",
              maxHeight: "65vh",
              whiteSpace: "pre-wrap",
              fontSize: 12,
            }}
          >
            {diff || "正在加载…"}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseDiff}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "push"} onClose={onCloseDialog}>
        <DialogTitle>推送当前分支</DialogTitle>
        <DialogContent>
          <DialogContentText>
            将把当前分支已有提交推送到 {overview?.upstream}。未提交文件不会被包含。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseDialog}>取消</Button>
          <Button variant="contained" onClick={onPush} disabled={busy}>
            推送
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "revert"} onClose={onCloseDialog}>
        <DialogTitle>还原最近的面板提交</DialogTitle>
        <DialogContent>
          <DialogContentText>
            面板会创建一个新的 Git revert 提交。只有本次面板会话创建且仍位于 HEAD
            的提交可以自动还原。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseDialog}>取消</Button>
          <Button color="warning" variant="contained" onClick={onRevert} disabled={busy}>
            创建还原提交
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
