import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../api";
import { errorMessage } from "../shared/errors";
import { useScopedSettings } from "../settings/useScopedSettings";
import { useUnsavedSessionRecovery } from "../auth/useSessionRecovery";
import type { SettingsOverview, SettingsSnapshot } from "../../shared/panel-settings";
import { bangumiNetworkProblem, type BangumiNetworkSettings } from "../../shared/bangumi-settings";

export function BangumiSettingsDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setSnapshot(null);
    setError("");
    void api<SettingsOverview>("/api/settings", { signal: request.signal })
      .then((result) => {
        if (!request.signal.aborted) setSnapshot(result.machine);
      })
      .catch((cause) => {
        if (!request.signal.aborted) setError(errorMessage(cause, "搜索设置读取失败"));
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, [reload]);
  return (
    <Dialog
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>搜索设置</DialogTitle>
      {loading ? (
        <DialogContent>
          <Stack sx={{ py: 4, alignItems: "center", gap: 2 }}>
            <CircularProgress size={28} />
            <Typography>正在读取搜索设置…</Typography>
          </Stack>
        </DialogContent>
      ) : error ? (
        <DialogContent>
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={() => setReload((value) => value + 1)}>
                重试
              </Button>
            }
          >
            {error}
          </Alert>
        </DialogContent>
      ) : (
        snapshot && (
          <SettingsForm
            snapshot={snapshot}
            onClose={onClose}
            onSaved={onSaved}
            onSaving={setSaving}
            onReload={() => setReload((value) => value + 1)}
          />
        )
      )}
      {(loading || error) && (
        <DialogActions>
          <Button onClick={onClose}>关闭</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

function SettingsForm({
  snapshot,
  onClose,
  onSaved,
  onSaving,
  onReload,
}: {
  snapshot: SettingsSnapshot;
  onClose: () => void;
  onSaved: () => void;
  onSaving: (saving: boolean) => void;
  onReload: () => void;
}) {
  const controller = useScopedSettings("machine", "bangumi", snapshot, undefined, () => {});
  const values = controller.value as unknown as BangumiNetworkSettings;
  const problem = bangumiNetworkProblem(values);
  const locked = controller.readOnly || controller.saving;
  useUnsavedSessionRecovery("搜索设置", controller.dirty, {
    kind: "bangumiSettings",
    values,
    baseVersion: snapshot.version,
  });
  async function save() {
    if (problem || locked || !controller.dirty) return;
    onSaving(true);
    try {
      if (await controller.save()) {
        onSaved();
        onClose();
      }
    } finally {
      onSaving(false);
    }
  }
  return (
    <>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            设置保存在面板中，保存后用于下一次动画搜索。
          </Typography>
          {snapshot.warnings.map((warning) => (
            <Alert key={warning} severity="warning">
              {warning}
            </Alert>
          ))}
          {(controller.error || controller.conflict) && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" onClick={onReload} disabled={controller.saving}>
                  重新载入
                </Button>
              }
            >
              {controller.error || "搜索设置已变化，请重新载入后保存。"}
            </Alert>
          )}
          <Box component="fieldset" disabled={locked} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Bangumi BaseURL"
                value={values.baseUrl}
                onChange={(event) => controller.change({ baseUrl: event.target.value })}
                helperText="例如 https://api.bgm.tv，支持镜像路径与 /v0 后缀。"
                fullWidth
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
              <FormControlLabel
                label="启用代理"
                control={
                  <Switch
                    checked={values.proxyEnabled}
                    onChange={(_, proxyEnabled) => controller.change({ proxyEnabled })}
                  />
                }
              />
              <FormControlLabel
                label="跟随系统代理"
                control={
                  <Switch
                    checked={values.followSystemProxy}
                    disabled={!values.proxyEnabled}
                    onChange={(_, followSystemProxy) => controller.change({ followSystemProxy })}
                  />
                }
              />
              {values.proxyEnabled && values.followSystemProxy && (
                <Typography variant="body2" color="text.secondary">
                  使用面板进程的代理环境变量或 Windows
                  系统代理；系统未配置代理、或命中绕过规则时直接连接。
                </Typography>
              )}
              {values.proxyEnabled && !values.followSystemProxy && (
                <TextField
                  label="HTTP/HTTPS 代理地址"
                  value={values.proxyUrl}
                  onChange={(event) => controller.change({ proxyUrl: event.target.value })}
                  placeholder="http://127.0.0.1:7890"
                  helperText="填写代理服务器地址和端口。"
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 2000 } }}
                />
              )}
            </Stack>
          </Box>
          {problem && <Alert severity="warning">{problem}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ gap: 1, flexWrap: "wrap" }}>
        <Button onClick={() => controller.reset(true)} disabled={locked}>
          恢复默认
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={controller.saving}>
          取消
        </Button>
        <Button
          variant="contained"
          disabled={locked || !controller.dirty || controller.conflict || Boolean(problem)}
          onClick={() => void save()}
        >
          {controller.saving ? "正在保存…" : "保存设置"}
        </Button>
      </DialogActions>
    </>
  );
}
