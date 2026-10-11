import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import type { PublishCommitDetail, PublishOverview } from "../types";
import { ContentLoading } from "../components/ContentLoading";
export function PublishDialogs({
  title,
  detail,
  loading,
  error,
  onClose,
  pushOpen,
  pushBusy,
  overview,
  onPush,
  onClosePush,
  pushError,
}: {
  title: string;
  detail: PublishCommitDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  pushOpen: boolean;
  pushBusy: boolean;
  overview: PublishOverview | null;
  onPush: () => void;
  onClosePush: () => void;
  pushError: string;
}) {
  return (
    <>
      <Dialog
        open={pushOpen}
        onClose={onClosePush}
        fullWidth
        maxWidth="sm"
        aria-labelledby="publish-push-title"
      >
        <DialogTitle id="publish-push-title">推送当前分支</DialogTitle>
        <DialogContent>
          {pushError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {pushError}
            </Alert>
          )}
          <Typography sx={{ overflowWrap: "anywhere" }}>
            将 {overview?.branch} 的已有提交推送到 {overview?.upstream}。
          </Typography>
          {overview?.remotes
            .find((remote) => remote.name === overview.pushRemote)
            ?.pushUrls.map((url, index) => (
              <Typography
                key={index}
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, overflowWrap: "anywhere" }}
              >
                {url}
              </Typography>
            ))}
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            未提交的工作区修改不包含在本次推送中。执行日志会显示在运行日志区域。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClosePush} disabled={pushBusy}>
            取消
          </Button>
          <Button variant="contained" onClick={onPush} disabled={pushBusy || !overview?.canPush}>
            {pushBusy ? "正在推送…" : "确认推送"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(title)}
        onClose={onClose}
        fullWidth
        maxWidth="lg"
        aria-labelledby="publish-detail-title"
      >
        <DialogTitle id="publish-detail-title" sx={{ overflowWrap: "anywhere" }}>
          {title}
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <ContentLoading
              heading="正在展开差异"
              description="正在读取文件修改与提交说明"
              size="compact"
            />
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            detail && (
              <>
                {detail.message && (
                  <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", mb: 2 }}>
                    {detail.message}
                  </Typography>
                )}
                {detail.truncated && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    差异超过 256 KiB，仅显示部分内容。
                  </Alert>
                )}
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    overflow: "auto",
                    maxHeight: "65vh",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    fontFamily: "var(--mizuki-panel-font-mono)",
                    fontSize: 13,
                  }}
                >
                  {detail.diff || "没有可显示的差异。"}
                </Box>
              </>
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>关闭</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
