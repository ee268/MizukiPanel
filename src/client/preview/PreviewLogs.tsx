import { useEffect, useRef } from "react";
import { Box, Paper, Typography, useTheme } from "@mui/material";
import { previewLogTokens, type PreviewLogTone } from "../preview-log";

export function PreviewLogs({ logs }: { logs: string[] }) {
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
        p: 0,
      }}
    >
      <Typography
        sx={{
          bgcolor: "#0b1020",
          color: "#f8fafc",
          borderBottom: "1px solid",
          borderColor: "rgba(148, 163, 184, 0.22)",
          fontWeight: 650,
          px: 2,
          py: 1.25,
          position: "sticky",
          top: 0,
          zIndex: 2,
        }}
      >
        运行日志
      </Typography>
      <Box
        component="pre"
        sx={{
          fontFamily: "var(--mizuki-panel-font-mono)",
          fontSize: 12,
          lineHeight: 1.65,
          m: 0,
          overflowWrap: "anywhere",
          px: 2,
          py: 1.5,
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
