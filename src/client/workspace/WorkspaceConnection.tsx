import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import LinkOffOutlined from "@mui/icons-material/LinkOffOutlined";
import { Button, Paper, Stack, TextField } from "@mui/material";
import type { FormEvent } from "react";

interface WorkspaceConnectionProps {
  projectPath: string;
  connected: boolean;
  busy: boolean;
  onPathChange: (path: string) => void;
  onConnect: (event: FormEvent) => void;
  onSelect: () => void;
  onDisconnect: () => void;
}

export function WorkspaceConnection({
  projectPath,
  connected,
  busy,
  onPathChange,
  onConnect,
  onSelect,
  onDisconnect,
}: WorkspaceConnectionProps) {
  return (
    <Paper data-page-motion="controls" variant="outlined" sx={{ p: 3 }}>
      <Stack
        component="form"
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        onSubmit={onConnect}
        sx={{ alignItems: "center" }}
      >
        <TextField
          label="Mizuki 项目绝对路径"
          value={projectPath}
          onChange={(event) => onPathChange(event.target.value)}
          placeholder="C:\\sites\\Mizuki"
          required
          fullWidth
        />
        <Button
          variant="contained"
          type="button"
          startIcon={<FolderOpenOutlined />}
          onClick={onSelect}
          title="打开文件资源管理器选择 Mizuki 文件夹"
          disabled={busy}
          sx={{ minWidth: 150, height: 40 }}
        >
          {connected ? "重新连接" : "连接项目"}
        </Button>
        {connected && (
          <Button
            color="error"
            variant="outlined"
            onClick={onDisconnect}
            startIcon={<LinkOffOutlined />}
            disabled={busy}
            sx={{ minWidth: 120, height: 40 }}
          >
            断开
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
