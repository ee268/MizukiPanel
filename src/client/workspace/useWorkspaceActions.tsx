import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { ApiError, api, json } from "../api";
import { usePersonalSettings } from "../settings/PersonalSettingsProvider";
import { notifySiteIdentityChanged } from "../shared/site-identity";
import { useWorkspaceSession } from "./WorkspaceSessionProvider";
import type { WorkspaceData } from "./types";
import type { WorkspaceTask } from "../../shared/workspace";

export function useWorkspaceActions() {
  const session = useWorkspaceSession();
  const preferences = usePersonalSettings();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    path: string | null;
    version: string;
    task: WorkspaceTask;
  } | null>(null);
  async function change(
    path: string | null,
    version = session.data?.version,
    stopOwnedPreview = false,
  ) {
    if (!version) {
      setError("请先读取工作区状态。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await api<WorkspaceData>(
        path === null ? "/api/workspace/disconnect" : "/api/workspace/connect",
        json("POST", { projectPath: path, version, stopOwnedPreview }),
      );
      session.adopt(next);
      notifySiteIdentityChanged();
      setConfirmation(null);
      navigate(path === null ? "/" : preferences.saved.workspace.afterConnect);
    } catch (cause) {
      const task =
        cause instanceof ApiError ? (cause.payload.task as WorkspaceTask | undefined) : undefined;
      if (task?.kind === "preview" && task.canStop) setConfirmation({ path, version, task });
      else setError(cause instanceof Error ? cause.message : "工作区操作失败。");
    } finally {
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    setError,
    connect: (path: string) => change(path),
    disconnect: () => change(null),
    taskDialog: (
      <Dialog open={Boolean(confirmation)} onClose={() => !busy && setConfirmation(null)}>
        <DialogTitle>停止当前预览后切换</DialogTitle>
        <DialogContent>
          面板正在运行 {confirmation?.task.projectRoot}{" "}
          的预览。停止预览后再切换工作区，外部启动的进程不会被关闭。
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirmation(null)}>
            取消
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() =>
              confirmation && void change(confirmation.path, confirmation.version, true)
            }
          >
            停止预览并继续
          </Button>
        </DialogActions>
      </Dialog>
    ),
  };
}
