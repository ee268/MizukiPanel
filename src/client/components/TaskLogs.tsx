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
  const dark = theme.palette.mode === "dark";
  const background = dark ? "#0b1020" : theme.palette.background.paper;
  const container = useRef<HTMLDivElement>(null);
  const tones: Record<PreviewLogTone, string> = {
    default: theme.palette.text.primary,
    muted: theme.palette.text.secondary,
    accent: dark ? theme.palette.primary.main : theme.palette.primary.dark,
    success: dark ? theme.palette.success.light : theme.palette.success.dark,
    warning: dark ? theme.palette.warning.light : theme.palette.warning.dark,
    error: dark ? theme.palette.error.light : theme.palette.error.dark,
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
        bgcolor: background,
        color: tones.default,
        height: compact ? 360 : { xs: "60vh", md: "calc(100vh - 320px)" },
        minHeight: compact ? 280 : 420,
        overflow: "auto",
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        sx={{
          bgcolor: background,
          borderBottom: 1,
          borderColor: "divider",
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
