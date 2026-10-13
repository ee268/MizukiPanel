import { Avatar, Box, Typography } from "@mui/material";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import type { WritingMessage } from "./conversations";
import { VditorMarkdownPreview } from "../components/VditorMarkdownPreview";

export function AiMessageBubble({
  message,
  userAvatar,
}: {
  message: WritingMessage;
  userAvatar?: string | null;
}) {
  const user = message.role === "user";
  return (
    <Box
      component="article"
      aria-label={user ? "你的消息" : "AI 回复"}
      sx={{
        display: "flex",
        flexDirection: user ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: 1,
        minWidth: 0,
      }}
    >
      <Avatar
        src={user ? (userAvatar ?? undefined) : undefined}
        alt={user ? "你的头像" : "AI 头像"}
        sx={{
          width: 30,
          height: 30,
          flexShrink: 0,
          mt: 0.25,
          bgcolor: (theme) =>
            `color-mix(in srgb, ${theme.palette.primary.main} 12%, ${theme.palette.background.paper})`,
          color: "primary.main",
          "& .MuiSvgIcon-root": { fontSize: 18 },
        }}
      >
        {user ? <PersonOutlined /> : <AutoAwesomeOutlined />}
      </Avatar>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: user ? "flex-end" : "flex-start",
          gap: 0.5,
          minWidth: 0,
          maxWidth: "calc(100% - 38px)",
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ maxWidth: "100%", overflowWrap: "anywhere", px: 0.5 }}
        >
          {user ? "你" : message.model}
          {message.failed ? " · 未完成" : ""}
        </Typography>
        <Box
          data-ai-bubble={message.role}
          sx={{
            width: "fit-content",
            maxWidth: "100%",
            minWidth: 0,
            px: 1.5,
            py: 1.25,
            fontSize: (theme) => theme.typography.body2.fontSize,
            borderRadius: user ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            bgcolor: (theme) =>
              user
                ? `color-mix(in srgb, ${theme.palette.primary.main} ${theme.palette.mode === "dark" ? 16 : 8}%, transparent)`
                : theme.palette.background.default,
            border: 1,
            borderColor: (theme) =>
              user
                ? `color-mix(in srgb, ${theme.palette.primary.main} 25%, transparent)`
                : theme.palette.divider,
            color: "text.primary",
            overflowWrap: "anywhere",
          }}
        >
          {user ? (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {message.content}
            </Typography>
          ) : (
            <VditorMarkdownPreview
              markdown={
                message.intent === "edit"
                  ? "已生成正文修改，查看下方前后对比后采用。"
                  : message.content
              }
            />
          )}
          {message.truncated && (
            <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 1 }}>
              输出达到上限，内容可能不完整。
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
