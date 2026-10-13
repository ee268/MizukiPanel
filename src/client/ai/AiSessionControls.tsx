import { useState } from "react";
import { Box, IconButton, Menu, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import EditOutlined from "@mui/icons-material/EditOutlined";
import Check from "@mui/icons-material/Check";
import Close from "@mui/icons-material/Close";
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
  rename,
}: {
  sessions: WritingSession[];
  activeId: string;
  disabled: boolean;
  create: () => void;
  remove: (id: string) => void;
  select: (id: string) => void;
  rename: (id: string, name: string) => boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState<string | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState(false);
  function finish() {
    if (editing && rename(editing, name)) {
      setEditing(null);
      setError(false);
    } else setError(true);
  }
  function close() {
    setAnchor(null);
    setEditing(null);
    setError(false);
  }
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Tooltip title="新建会话">
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
          disabled={disabled}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <ForumOutlined />
        </IconButton>
      </Tooltip>
      <Tooltip title="删除当前会话">
        <IconButton
          size="small"
          aria-label="删除当前 AI 会话"
          disabled={disabled}
          onClick={() => remove(activeId)}
        >
          <DeleteOutline />
        </IconButton>
      </Tooltip>
      <Menu
        id="ai-session-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
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
              if (editing === session.id) return;
              select(session.id);
              close();
            }}
            sx={{ gap: 1 }}
          >
            {editing === session.id ? (
              <>
                <TextField
                  autoFocus
                  size="small"
                  label="会话名称"
                  value={name}
                  error={error}
                  helperText={error ? "填写 1–40 字，不包含密钥" : ""}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(false);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      finish();
                    }
                    if (e.key === "Escape") setEditing(null);
                  }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <IconButton
                  size="small"
                  aria-label="保存会话名称"
                  onClick={(e) => {
                    e.stopPropagation();
                    finish();
                  }}
                >
                  <Check fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="取消会话改名"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(null);
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </>
            ) : (
              <>
                <Typography
                  variant="body2"
                  sx={{ flex: 1, minWidth: 0 }}
                  noWrap
                  title={session.name}
                >
                  {session.name}
                  {session.loading ? " · 处理中" : ""}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={`编辑${session.name}`}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditing(session.id);
                    setName(session.name);
                    setError(false);
                  }}
                >
                  <EditOutlined fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`删除${session.name}`}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(session.id);
                    close();
                  }}
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </>
            )}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
