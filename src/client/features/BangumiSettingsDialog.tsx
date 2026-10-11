import { useEffect, useState } from "react";
import { ContentLoading } from "../components/ContentLoading";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Add, Remove } from "@mui/icons-material";
import { api } from "../api";
import { errorMessage } from "../shared/errors";
import { useScopedSettings } from "../settings/useScopedSettings";
import { useUnsavedSessionRecovery } from "../auth/useSessionRecovery";
import type { SettingsOverview, SettingsSnapshot } from "../../shared/panel-settings";
import {
  bangumiNetworkProblem,
  bangumiProxyMode,
  bangumiProxyFields,
  bangumiProxyInputProblem,
  composeBangumiProxyUrl,
  splitBangumiProxyUrl,
  validBangumiProxyPort,
  validBangumiProxyAddress,
  defaultBangumiNetworkSettings,
  type BangumiNetworkSettings,
  type BangumiProjectBaseUrl,
} from "../../shared/bangumi-settings";

export function BangumiSettingsDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [projectBaseUrl, setProjectBaseUrl] = useState<BangumiProjectBaseUrl>({
    baseUrl: defaultBangumiNetworkSettings.baseUrl,
    source: "fallback",
  });
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
        if (!request.signal.aborted) {
          setSnapshot(result.machine);
          setProjectBaseUrl(
            result.bangumiDefault ?? {
              baseUrl: defaultBangumiNetworkSettings.baseUrl,
              source: "fallback",
            },
          );
        }
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
          <ContentLoading
            heading="正在展开搜索设置"
            description="正在读取 Bangumi 网络偏好"
            kind="settings"
            size="compact"
          />
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
            projectBaseUrl={projectBaseUrl}
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
  projectBaseUrl,
  onClose,
  onSaved,
  onSaving,
  onReload,
}: {
  snapshot: SettingsSnapshot;
  projectBaseUrl: BangumiProjectBaseUrl;
  onClose: () => void;
  onSaved: () => void;
  onSaving: (saving: boolean) => void;
  onReload: () => void;
}) {
  const controller = useScopedSettings("machine", "bangumi", snapshot, undefined, () => {});
  const values = controller.value as unknown as BangumiNetworkSettings;
  const initialProxy = splitBangumiProxyUrl(snapshot.document.values.bangumi.proxyUrl as string);
  const [proxyInput, setProxyInput] = useState(() => splitBangumiProxyUrl(values.proxyUrl));
  const proxyMode = bangumiProxyMode(values);
  const proxyProblem = bangumiProxyInputProblem(proxyInput.address, proxyInput.port);
  const problem = (proxyMode === "custom" ? proxyProblem : null) ?? bangumiNetworkProblem(values);
  const dirty =
    controller.dirty ||
    (proxyMode === "custom" &&
      (proxyInput.address !== initialProxy.address || proxyInput.port !== initialProxy.port));
  const locked = controller.readOnly || controller.saving;
  useUnsavedSessionRecovery("搜索设置", dirty, {
    kind: "bangumiSettings",
    values,
    baseVersion: snapshot.version,
    proxyInput,
  });
  function changeProxy(fields: Partial<typeof proxyInput>) {
    const next = { ...proxyInput, ...fields };
    setProxyInput(next);
    if (!bangumiProxyInputProblem(next.address, next.port))
      controller.change({ proxyUrl: composeBangumiProxyUrl(next.address, next.port) });
  }
  async function save() {
    if (problem || locked || !dirty) return;
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
                value={values.followProjectBaseUrl ? projectBaseUrl.baseUrl : values.baseUrl}
                onChange={(event) =>
                  controller.change({ baseUrl: event.target.value, followProjectBaseUrl: false })
                }
                helperText="默认使用当前 Mizuki 季度追番的地址，可直接修改；恢复默认可重新填入项目地址。"
                fullWidth
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
              {values.followProjectBaseUrl && projectBaseUrl.warning && (
                <Alert severity="info">{projectBaseUrl.warning}</Alert>
              )}
              <FormControlLabel
                label="自定义代理"
                control={
                  <Switch
                    checked={proxyMode === "custom"}
                    onChange={(_, enabled) =>
                      controller.change(bangumiProxyFields(enabled ? "custom" : "off"))
                    }
                  />
                }
              />
              <FormControlLabel
                label="跟随系统代理"
                control={
                  <Switch
                    checked={proxyMode === "system"}
                    onChange={(_, enabled) =>
                      controller.change(bangumiProxyFields(enabled ? "system" : "off"))
                    }
                  />
                }
              />
              {proxyMode === "system" && (
                <Typography variant="body2" color="text.secondary">
                  使用面板进程的代理环境变量或 Windows
                  系统代理；系统未配置代理、或命中绕过规则时直接连接。
                </Typography>
              )}
              {proxyMode === "off" && (
                <Typography variant="body2" color="text.secondary">
                  自定义代理与跟随系统代理互斥，均关闭时直接连接。
                </Typography>
              )}
              {proxyMode === "custom" && (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="代理地址"
                    value={proxyInput.address}
                    onChange={(event) => changeProxy({ address: event.target.value })}
                    placeholder="http://127.0.0.1"
                    error={!validBangumiProxyAddress(proxyInput.address)}
                    helperText="填写域名或 IP，不含端口；省略协议时使用 HTTP。"
                    fullWidth
                    sx={{ flex: 1 }}
                    slotProps={{ htmlInput: { maxLength: 1900 } }}
                  />
                  <TextField
                    label="代理端口"
                    type="number"
                    value={proxyInput.port}
                    onChange={(event) => changeProxy({ port: event.target.value })}
                    error={!validBangumiProxyPort(proxyInput.port)}
                    helperText="1–65535 的整数"
                    sx={{
                      width: { xs: "100%", sm: 200 },
                      "& input[type=number]": { MozAppearance: "textfield" },
                      "& input::-webkit-inner-spin-button, & input::-webkit-outer-spin-button": {
                        WebkitAppearance: "none",
                        margin: 0,
                      },
                    }}
                    slotProps={{
                      htmlInput: { min: 1, max: 65535, step: 1, inputMode: "numeric" },
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              aria-label="减少代理端口"
                              disabled={
                                locked ||
                                !validBangumiProxyPort(proxyInput.port) ||
                                Number(proxyInput.port) <= 1
                              }
                              onClick={() =>
                                changeProxy({ port: String(Number(proxyInput.port) - 1) })
                              }
                            >
                              <Remove fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label="增加代理端口"
                              disabled={
                                locked ||
                                !validBangumiProxyPort(proxyInput.port) ||
                                Number(proxyInput.port) >= 65535
                              }
                              onClick={() =>
                                changeProxy({ port: String(Number(proxyInput.port) + 1) })
                              }
                            >
                              <Add fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Stack>
              )}
            </Stack>
          </Box>
          {problem && <Alert severity="warning">{problem}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ gap: 1, flexWrap: "wrap" }}>
        <Button
          onClick={() => {
            controller.reset(true);
            setProxyInput(splitBangumiProxyUrl(""));
          }}
          disabled={locked}
        >
          恢复默认
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={controller.saving}>
          取消
        </Button>
        <Button
          variant="contained"
          disabled={locked || !dirty || controller.conflict || Boolean(problem)}
          onClick={() => void save()}
        >
          {controller.saving ? "正在保存…" : "保存设置"}
        </Button>
      </DialogActions>
    </>
  );
}
