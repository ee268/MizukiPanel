import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "../api";
import { sessionLifecycle } from "./session-lifecycle";
import type { PanelSessionStatus } from "../../shared/session";
export function SessionGuard() {
  const { exit, session } = useSyncExternalStore(
    sessionLifecycle.subscribe,
    sessionLifecycle.getState,
  );
  const [downloadError, setDownloadError] = useState("");
  useEffect(() => {
    let stopped = false;
    let checking = false;
    let sending = false;
    let lastSent = 0;
    let lastCheck = 0;
    const check = async () => {
      if (checking || sessionLifecycle.getState().exit || Date.now() - lastCheck < 1000) return;
      checking = true;
      lastCheck = Date.now();
      try {
        await api<PanelSessionStatus>("/api/session");
      } catch {
        /* API handles expiry; transient failures do not discard input. */
      } finally {
        checking = false;
      }
    };
    const activity = (event: Event) => {
      if (
        stopped ||
        !event.isTrusted ||
        document.visibilityState !== "visible" ||
        sessionLifecycle.getState().exit ||
        sending ||
        Date.now() - lastSent < 30000
      )
        return;
      sending = true;
      lastSent = Date.now();
      void api("/api/auth/activity", { method: "POST" })
        .catch(() => {})
        .finally(() => {
          sending = false;
        });
    };
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const timer = window.setInterval(() => void check(), 15000);
    const events = ["pointerdown", "keydown", "input", "wheel", "touchstart"];
    for (const event of events)
      window.addEventListener(event, activity, { passive: true, capture: true });
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    let channel: BroadcastChannel | null = null;
    try {
      channel =
        typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("mizuki-panel-auth") : null;
      if (channel) channel.onmessage = () => void check();
    } catch {
      /* Polling remains available if messaging is disabled. */
    }
    return () => {
      stopped = true;
      clearInterval(timer);
      channel?.close();
      for (const event of events) window.removeEventListener(event, activity, true);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    if (!exit && !session) return;
    let channel: BroadcastChannel | null = null;
    try {
      channel =
        typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("mizuki-panel-auth") : null;
      channel?.postMessage({ type: exit ? "ended" : "changed", key: session?.key });
    } catch {
      /* Polling remains available if messaging is disabled. */
    } finally {
      channel?.close();
    }
  }, [Boolean(exit), session?.key]);
  async function download() {
    setDownloadError("");
    try {
      const files = sessionLifecycle.recovery.capture();
      const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              {
                format: "mizuki-panel-session-recovery",
                schemaVersion: 1,
                createdAt: new Date().toISOString(),
                items: files,
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `mizuki-panel-recovery-${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await sessionLifecycle.finish();
    } catch (error) {
      setDownloadError((error as Error).message);
    }
  }
  return (
    <Dialog open={Boolean(exit)} aria-labelledby="session-exit-title" fullWidth maxWidth="sm">
      <DialogTitle id="session-exit-title">
        {exit?.reason === "logout" ? "退出登录前保留修改" : "会话已结束"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography>{exit?.message}</Typography>
          <Typography>
            {exit?.working
              ? "正在保留本地恢复副本…"
              : "尚有修改未能保留，当前输入仍在页面中。可重试或下载恢复副本后返回登录。"}
          </Typography>
          {exit?.errors.map((error) => (
            <Alert severity="error" key={error}>
              {error}
            </Alert>
          ))}
          {downloadError && <Alert severity="error">{downloadError}</Alert>}
          <Typography variant="body2" color="text.secondary">
            退出不会停止服务端正在运行的预览或发布任务。恢复文件包含未保存内容，请保存在自己的设备上。
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        {exit?.reason === "logout" && (
          <Button disabled={exit.working} onClick={() => sessionLifecycle.cancel()}>
            继续编辑
          </Button>
        )}
        <Button disabled={exit?.working} onClick={() => void sessionLifecycle.retry()}>
          重试保留副本
        </Button>
        <Button disabled={exit?.working} onClick={() => void sessionLifecycle.finish()}>
          放弃未保留修改并登录
        </Button>
        <Button variant="contained" disabled={exit?.working} onClick={() => void download()}>
          下载恢复副本并登录
        </Button>
      </DialogActions>
    </Dialog>
  );
}
