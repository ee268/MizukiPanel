import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import PlayArrowOutlined from "@mui/icons-material/PlayArrowOutlined";
import StopOutlined from "@mui/icons-material/StopOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { PreviewLogs } from "../preview/PreviewLogs";
import { usePreview } from "../preview/usePreview";

const statusLabels = {
  stopped: "未启动",
  starting: "启动中",
  running: "运行中",
  external: "已连接外部服务",
  failed: "启动失败",
};

const statusColors = {
  stopped: "default",
  starting: "warning",
  running: "success",
  external: "info",
  failed: "error",
} as const;

const buttonSx = {
  flexShrink: 0,
  whiteSpace: "nowrap",
  width: { xs: "100%", lg: "auto" },
};

export default function PreviewPage() {
  const controller = usePreview();
  const { preview } = controller;

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, lg: 3 } }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h4">真实预览</Typography>
            <Typography color="text.secondary">
              启动 Mizuki 的 Astro 服务，并在新标签页中查看真实渲染结果。
            </Typography>
          </Box>
          {preview && (
            <Chip color={statusColors[preview.state]} label={statusLabels[preview.state]} />
          )}
        </Stack>

        {(controller.error || preview?.error) && (
          <Alert severity="warning">{controller.error || preview?.error}</Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.5}
            sx={{ alignItems: { lg: "center" } }}
          >
            <Button
              variant="contained"
              startIcon={<PlayArrowOutlined />}
              onClick={controller.start}
              disabled={
                preview?.state === "running" ||
                preview?.state === "starting" ||
                preview?.state === "external"
              }
              sx={{ ...buttonSx, minWidth: 132 }}
            >
              启动astro
            </Button>
            <Button
              color="error"
              variant="outlined"
              startIcon={<StopOutlined />}
              onClick={controller.stop}
              disabled={preview?.state !== "running" && preview?.state !== "starting"}
              sx={{ ...buttonSx, minWidth: 96 }}
            >
              停止
            </Button>
            <TextField
              label="预览路径"
              value={controller.pagePath}
              onChange={(event) => controller.setPagePath(event.target.value)}
              fullWidth
              sx={{ minWidth: { lg: 240 } }}
            />
            <Button
              component="a"
              href={controller.targetUrl}
              target="_blank"
              rel="noreferrer"
              startIcon={<OpenInNewOutlined />}
              disabled={!controller.active}
              sx={{ ...buttonSx, minWidth: 116 }}
            >
              新窗口
            </Button>
          </Stack>
        </Paper>

        <PreviewLogs logs={preview?.logs ?? []} />
      </Stack>
    </Container>
  );
}
