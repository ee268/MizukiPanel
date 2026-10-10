import { useEffect, useRef, type ReactNode } from "react";
import { Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import { previewLogTokens, type PreviewLogTone } from "../preview-log";
import { useOptionalPersonalSettings } from "../settings/PersonalSettingsProvider";
import { defaultPersonalSettings } from "../../shared/panel-settings";
export function TaskLogs({
  logs,
  compact = false,
  badge,
  limit,
}: {
  logs: string[];
  compact?: boolean;
  badge?: ReactNode;
  limit?: number;
}) {
  const settings = useOptionalPersonalSettings()?.effective.logs ?? defaultPersonalSettings.logs;
  const theme = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const tones: Record<PreviewLogTone, string> = {
    default: "#e5e7eb",
    muted: "#94a3b8",
    accent: theme.palette.primary.main,
    success: theme.palette.success.light,
    warning: theme.palette.warning.light,
    error: theme.palette.error.light,
  };
  const last = logs.at(-1);
  useEffect(() => {
    if (settings.autoScroll && container.current)
      container.current.scrollTop = container.current.scrollHeight;
  }, [logs.length, last, settings.autoScroll]);
  return (
    <Paper
      ref={container}
      aria-label="运行日志"
      role="region"
      data-auto-scroll={settings.autoScroll}
      variant="outlined"
      sx={{
        bgcolor: "#0b1020",
        color: "#e5e7eb",
        height: compact ? 360 : { xs: "60vh", md: "calc(100vh - 320px)" },
        minHeight: compact ? 280 : 420,
        overflow: "auto",
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        sx={{
          bgcolor: "#0b1020",
          borderBottom: "1px solid rgba(148, 163, 184, 0.22)",
          p: 2,
          position: "sticky",
          top: 0,
          zIndex: 2,
          flexWrap: "wrap",
          gap: 1,
          justifyContent: "space-between",
        }}
      >
        <Typography sx={{ fontWeight: 650 }}>运行日志</Typography>
        {badge}
        <Typography variant="caption" sx={{ color: tones.muted }}>
          自动滚动{settings.autoScroll ? "开启" : "关闭"}
          {limit ? ` · 最多 ${limit} 条` : ""}
        </Typography>
      </Stack>
      <Box
        component="pre"
        sx={{
          fontFamily: "var(--mizuki-panel-font-mono)",
          fontSize: settings.fontSize,
          lineHeight: 1.65,
          m: 0,
          overflowWrap: "anywhere",
          p: 2,
          whiteSpace: "pre-wrap",
        }}
      >
        {logs.length ? (
          logs.map((line, index) => (
            <Box component="div" key={`${index}-${line}`}>
              {previewLogTokens(line).map((token, i) => (
                <Box component="span" key={i} sx={{ color: tones[token.tone] }}>
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
