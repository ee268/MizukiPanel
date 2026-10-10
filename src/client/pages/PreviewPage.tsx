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
          data-page-motion="heading"
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h4">Mizuki预览</Typography>
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
        {preview?.warnings?.map((warning) => (
          <Alert severity="warning" key={warning}>
            {warning}
          </Alert>
        ))}
        {preview && (
          <Typography variant="body2" color="text.secondary">
            当前端口：{preview.port ?? 4321} · 日志最多保留 {preview.logLimit ?? 300} 条
          </Typography>
        )}
        {preview?.pendingPort && (
          <Alert severity="info">
            当前预览继续使用 {preview.port} 端口；已保存的 {preview.configuredPort}{" "}
            端口将在停止后再次启动时应用。
          </Alert>
        )}

        <Paper data-page-motion="controls" variant="outlined" sx={{ p: 2 }}>
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
              error={Boolean(controller.pagePath && !controller.targetUrl)}
              helperText={
                !controller.targetUrl
                  ? "请输入以 / 开头的项目路径"
                  : "本次查看的临时路径；文章入口优先使用文章路径"
              }
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
              disabled={!controller.active || !controller.targetUrl}
              sx={{ ...buttonSx, minWidth: 116 }}
            >
              新窗口
            </Button>
          </Stack>
        </Paper>

        <Box data-page-motion="logs">
          <PreviewLogs logs={preview?.logs ?? []} limit={preview?.logLimit} />
        </Box>
      </Stack>
    </Container>
  );
}
