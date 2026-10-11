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
import type { PublishCommitDetail } from "../types";
import { ContentLoading } from "../components/ContentLoading";
export function PublishDialogs({
  title,
  detail,
  loading,
  error,
  onClose,
}: {
  title: string;
  detail: PublishCommitDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
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
  );
}
