import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  useTheme,
} from "@mui/material";
import PlayArrowOutlined from "@mui/icons-material/PlayArrowOutlined";
import StopOutlined from "@mui/icons-material/StopOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { useSearchParams } from "react-router-dom";
import { api, json } from "../api";
import {
  previewLogTokens,
  previewTargetUrl,
  type PreviewLogTone,
} from "../preview-log";
import type { PreviewStatus } from "../types";

const labels = {
  stopped: "未启动",
  starting: "启动中",
  running: "运行中",
  external: "已连接外部服务",
  failed: "启动失败",
};
const colors = {
  stopped: "default",
  starting: "warning",
  running: "success",
  external: "info",
  failed: "error",
} as const;

function PreviewLogs({ logs }: { logs: string[] }) {
  const theme = useTheme();
  const container = useRef<HTMLDivElement | null>(null);
  const tones: Record<PreviewLogTone, string> = {
    default: "#e5e7eb",
    muted: "#94a3b8",
    accent: theme.palette.primary.main,
    success: theme.palette.success.light,
    warning: theme.palette.warning.light,
    error: theme.palette.error.light,
  };

  useEffect(() => {
    const element = container.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [logs.length]);

  return (
    <Paper
      ref={container}
      variant="outlined"
      sx={{
        bgcolor: "#0b1020",
        color: "#e5e7eb",
        height: { xs: "60vh", md: "calc(100vh - 260px)" },
        minHeight: 420,
        overflow: "auto",
        p: 2,
      }}
    >
      <Typography
        sx={{
          bgcolor: "#0b1020",
          color: "#f8fafc",
          fontWeight: 650,
          pb: 1,
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        运行日志
      </Typography>
      <Box
        component="pre"
        sx={{
          fontFamily: 'Consolas, "Cascadia Code", monospace',
          fontSize: 12,
          lineHeight: 1.65,
          m: 0,
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
        }}
      >
        {logs.length ? (
          logs.map((line, lineIndex) => (
            <Box component="div" key={`${lineIndex}-${line}`}>
              {previewLogTokens(line).map((token, tokenIndex) => (
                <Box
                  component="span"
                  key={`${tokenIndex}-${token.text}`}
                  sx={{ color: tones[token.tone] }}
                >
                  {token.text}
                </Box>
              ))}
            </Box>
          ))
        ) : (
          <Box component="span" sx={{ color: tones.muted }}>
            暂无日志
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default function PreviewPage() {
  const [params] = useSearchParams();
  const [preview, setPreview] = useState<PreviewStatus | null>(null);
  const [pagePath, setPagePath] = useState(
    params.get("path")?.startsWith("/") ? params.get("path")! : "/",
  );
  const [error, setError] = useState("");
  const pendingTab = useRef<Window | null>(null);

  const load = useCallback(async () => {
    try {
      setPreview(await api<PreviewStatus>("/api/preview/status"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "预览状态读取失败");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 1500);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(
    () => () => {
      if (pendingTab.current && !pendingTab.current.closed) pendingTab.current.close();
    },
    [],
  );

  const active = preview?.state === "running" || preview?.state === "external";
  const targetUrl = useMemo(
    () => previewTargetUrl(preview?.url ?? "", pagePath),
    [pagePath, preview?.url],
  );

  useEffect(() => {
    const tab = pendingTab.current;
    if (!active || !targetUrl || !tab || tab.closed) return;
    tab.location.replace(targetUrl);
    pendingTab.current = null;
  }, [active, targetUrl]);

  function createPendingTab(): Window | null {
    if (pendingTab.current && !pendingTab.current.closed) pendingTab.current.close();
    const tab = window.open("about:blank", "_blank");
    if (!tab) return null;
    tab.opener = null;
    tab.document.title = "正在启动 Mizuki";
    tab.document.body.textContent = "Mizuki 正在启动，服务就绪后将自动打开。";
    tab.document.body.style.cssText =
      'margin:0;min-height:100vh;display:grid;place-items:center;font:16px "Segoe UI",sans-serif;background:#111318;color:#e5e7eb';
    return tab;
  }

  async function start() {
    setError("");
    pendingTab.current = createPendingTab();
    try {
      setPreview(await api<PreviewStatus>("/api/preview/start", json("POST")));
    } catch (cause) {
      if (pendingTab.current && !pendingTab.current.closed) pendingTab.current.close();
      pendingTab.current = null;
      setError(cause instanceof Error ? cause.message : "启动失败");
    }
  }

  async function stop() {
    setError("");
    if (pendingTab.current && !pendingTab.current.closed) pendingTab.current.close();
    pendingTab.current = null;
    try {
      setPreview(await api<PreviewStatus>("/api/preview/stop", json("POST")));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "停止失败");
    }
  }

  const buttonSx = {
    flexShrink: 0,
    whiteSpace: "nowrap",
    width: { xs: "100%", lg: "auto" },
  };

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
          {preview && <Chip color={colors[preview.state]} label={labels[preview.state]} />}
        </Stack>

        {(error || preview?.error) && (
          <Alert severity="warning">{error || preview?.error}</Alert>
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
              onClick={start}
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
              onClick={stop}
              disabled={preview?.state !== "running" && preview?.state !== "starting"}
              sx={{ ...buttonSx, minWidth: 96 }}
            >
              停止
            </Button>
            <TextField
              label="预览路径"
              value={pagePath}
              onChange={(event) => setPagePath(event.target.value)}
              fullWidth
              sx={{ minWidth: { lg: 240 } }}
            />
            <Button
              component="a"
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              startIcon={<OpenInNewOutlined />}
              disabled={!active}
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
