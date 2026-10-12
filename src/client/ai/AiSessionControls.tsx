import { useState } from "react";
import { Box, IconButton, Menu, MenuItem, Tooltip, Typography } from "@mui/material";
import Add from "@mui/icons-material/Add";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import ForumOutlined from "@mui/icons-material/ForumOutlined";
import type { WritingSession } from "./conversations";
export function AiSessionControls({
  sessions,
  activeId,
  disabled,
  create,
  remove,
  select,
}: {
  sessions: WritingSession[];
  activeId: string;
  disabled: boolean;
  create: () => void;
  remove: (id: string) => void;
  select: (id: string) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Tooltip title="新建会话并阅读当前文章">
        <IconButton size="small" aria-label="新建 AI 会话" onClick={create} disabled={disabled}>
          <Add />
        </IconButton>
      </Tooltip>
      <Tooltip title="会话列表">
        <IconButton
          size="small"
          aria-label="AI 会话列表"
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          aria-controls={anchor ? "ai-session-menu" : undefined}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <ForumOutlined />
        </IconButton>
      </Tooltip>
      <Tooltip title="删除当前会话">
        <IconButton size="small" aria-label="删除当前 AI 会话" onClick={() => remove(activeId)}>
          <DeleteOutline />
        </IconButton>
      </Tooltip>
      <Menu
        id="ai-session-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          paper: { sx: { width: 280, maxHeight: 320, maxWidth: "calc(100vw - 32px)" } },
        }}
      >
        {sessions.map((session) => (
          <MenuItem
            key={session.id}
            selected={session.id === activeId}
            onClick={() => {
              select(session.id);
              setAnchor(null);
            }}
            sx={{ gap: 1 }}
          >
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>
              {session.name}
              {session.loading ? " · 处理中" : ""}
            </Typography>
            <IconButton
              size="small"
              aria-label={`删除${session.name}`}
              onClick={(event) => {
                event.stopPropagation();
                remove(session.id);
                setAnchor(null);
              }}
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
