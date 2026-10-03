import { Alert, Box, Chip, Paper, Stack, Typography } from "@mui/material";
import katexCssUrl from "katex/dist/katex.min.css?url";
import { useMemo } from "react";
import { usePanelTheme } from "../theme";
import { markdownPreviewDocument } from "./markdown-preview-document";
import { useMarkdownDraftPreview } from "./useMarkdownDraftPreview";
import type { EditorFontMode } from "../../lib/server/editor-fonts";

interface MarkdownDraftPreviewProps {
  articleId: string;
  format: "md" | "mdx";
  source: string;
  fontMode: EditorFontMode;
}

export function MarkdownDraftPreview({
  articleId,
  format,
  source,
  fontMode,
}: MarkdownDraftPreviewProps) {
  const { resolvedMode } = usePanelTheme();
  const { phase, result, error } = useMarkdownDraftPreview(articleId, format, source);
  const document = useMemo(
    () => (result ? markdownPreviewDocument(result, resolvedMode, katexCssUrl, fontMode) : ""),
    [result, resolvedMode, fontMode],
  );
  const status = {
    waiting: result ? "等待更新 · 上次结果" : "等待输入暂停",
    rendering: result ? "正在渲染 · 上次结果" : "正在渲染",
    ready: `已更新 · ${result?.milliseconds ?? 0} ms`,
    error: result ? "渲染失败 · 上次结果" : "渲染失败",
    unsupported: "不支持 MDX",
  }[phase];

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Stack direction="row" spacing={1} sx={{ p: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h6">单篇正文预览</Typography>
        <Chip size="small" label={status} color={phase === "error" ? "warning" : "default"} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>
          未保存草稿 · 不启动 Astro
        </Typography>
      </Stack>
      {format === "mdx" ? (
        <Alert severity="info">MDX 组件需要 Astro 运行环境，单篇实时预览仅支持 .md。</Alert>
      ) : (
        <>
          {error && <Alert severity="warning">{error}</Alert>}
          {result ? (
            <Box sx={{ borderTop: 1, borderColor: "divider" }}>
              <iframe
                title="未保存 Markdown 正文预览"
                sandbox="allow-same-origin"
                srcDoc={document}
                style={{ display: "block", width: "100%", minHeight: 540, border: 0 }}
              />
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ px: 2, pb: 3 }}>
              输入暂停约一秒后显示当前正文的渲染结果。
            </Typography>
          )}
          {result && result.differences.length > 0 && (
            <Box component="details" sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}>
              <Typography component="summary" variant="body2" sx={{ cursor: "pointer" }}>
                与 Mizuki 最终页面的已知差异（{result.differences.length}）
              </Typography>
              <Box component="ul" sx={{ mb: 0 }}>
                {result.differences.map((difference) => (
                  <li key={difference}>{difference}</li>
                ))}
              </Box>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}
