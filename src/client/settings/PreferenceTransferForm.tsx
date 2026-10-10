import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  defaultValues,
  type PersonalGroup,
  type SettingsOverview,
  type SettingsScope,
  type SettingsSnapshot,
} from "../../shared/panel-settings";
import {
  exportPreferenceGroups,
  groupLabels,
  parsePreferenceBundle,
  preferenceDiff,
  preferenceFieldLabel,
  scopeLabels,
  type PreferenceBundle,
  type PreferenceGroups,
} from "../../shared/preferences-transfer";
import { api, json } from "../api";
import { usePersonalSettings } from "./PersonalSettingsProvider";

interface TransferPreview {
  bundle: PreferenceBundle;
  overview: SettingsOverview | null;
  browser: SettingsSnapshot;
  reset: boolean;
}
const scopes: SettingsScope[] = ["browser", "machine", "project"];
export function PreferenceTransferForm({
  overview,
  disabled,
  onApplied,
}: {
  overview: SettingsOverview | null;
  disabled: boolean;
  onApplied: () => void;
}) {
  const personal = usePersonalSettings();
  const [exports, setExports] = useState<SettingsScope[]>(["browser"]);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<
    { scope: SettingsScope; success: boolean; message: string }[]
  >([]);
  const available = (scope: SettingsScope) =>
    scope === "browser"
      ? !personal.snapshot.readOnly && !personal.snapshot.unavailable
      : scope === "machine"
        ? Boolean(overview && !overview.machine.readOnly)
        : Boolean(overview?.project && !overview.project.settings.readOnly);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function download(bundle: PreferenceBundle) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(bundle, null, 2) + "\n"], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `mizuki-panel-preferences-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function openPreview(bundle: PreferenceBundle, reset: boolean) {
    let latest: SettingsOverview | null = null;
    if (bundle.scopes.machine || bundle.scopes.project)
      latest = await api<SettingsOverview>("/api/settings");
    setSelected(Object.keys(bundle.scopes.browser ?? {}).map((group) => `browser:${group}`));
    setResults([]);
    setPreview({ bundle, reset, overview: latest, browser: personal.snapshot });
  }
  async function apply() {
    if (!preview) return;
    const report: { scope: SettingsScope; success: boolean; message: string }[] = [];
    for (const scope of scopes) {
      const groups = Object.fromEntries(
        Object.entries(preview.bundle.scopes[scope] ?? {}).filter(([group]) =>
          selected.includes(`${scope}:${group}`),
        ),
      );
      if (!Object.keys(groups).length) continue;
      try {
        if (scope === "browser")
          await personal.save(
            Object.fromEntries(
              Object.entries(groups).map(([group, fields]) => [
                group,
                { fields, base: preview.browser.document.values[group] },
              ]),
            ) as Partial<
              Record<PersonalGroup, { fields: Record<string, unknown>; base?: unknown }>
            >,
            true,
          );
        else {
          const snapshot =
            scope === "machine" ? preview.overview?.machine : preview.overview?.project?.settings;
          if (!snapshot || snapshot.readOnly) throw new Error("该设置范围不可写。");
          await api(
            "/api/settings/import",
            json("POST", {
              scope,
              groups,
              version: snapshot.version,
              projectKey: preview.overview?.project?.key,
            }),
          );
        }
        report.push({
          scope,
          success: true,
          message: `已${preview.reset ? "恢复默认" : "导入"} ${Object.keys(groups).length} 个分组，原偏好已备份。`,
        });
      } catch (cause) {
        report.push({ scope, success: false, message: (cause as Error).message });
      }
    }
    setResults(report);
    // Never replay successful ranges during a retry of another range.
    setSelected((ids) =>
      ids.filter((id) => !report.some((item) => item.success && id.startsWith(item.scope + ":"))),
    );
    onApplied();
    if (report.every((item) => item.success)) setPreview(null);
  }
  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label="偏好导入导出与恢复默认"
      sx={{ p: { xs: 2, sm: 3 } }}
    >
      <Stack spacing={2}>
        <Typography variant="h6" component="h3">
          偏好导入导出与恢复默认
        </Typography>
        <Typography color="text.secondary">
          文件只包含所选设置；不包含令牌、Cookie、项目路径关联、文章正文或本地草稿。默认项目选择保留在本机；导入不会连接项目或执行发布。
        </Typography>
        {disabled && (
          <Alert severity="info">请先保存或取消设置修改，再迁移偏好或批量恢复默认。</Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {results.map((item) => (
          <Alert key={item.scope} severity={item.success ? "success" : "error"}>
            {scopeLabels[item.scope]}：{item.message}
          </Alert>
        ))}
        <Box>
          <Typography variant="subtitle2">选择导出范围</Typography>
          {scopes.map((scope) => (
            <FormControlLabel
              key={scope}
              label={scopeLabels[scope]}
              control={
                <Checkbox
                  checked={exports.includes(scope)}
                  disabled={busy || !available(scope)}
                  onChange={(_, checked) =>
                    setExports((value) =>
                      checked ? [...value, scope] : value.filter((item) => item !== scope),
                    )
                  }
                />
              }
            />
          ))}
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            variant="outlined"
            disabled={
              busy || disabled || !exports.length || exports.some((scope) => !available(scope))
            }
            onClick={() =>
              void run(async () => {
                const latest = exports.some((scope) => scope !== "browser")
                  ? await api<SettingsOverview>("/api/settings")
                  : null;
                const bundle: PreferenceBundle = {
                  format: "mizuki-panel-preferences",
                  schemaVersion: 1,
                  scopes: {},
                };
                for (const scope of exports) {
                  const snapshot =
                    scope === "browser"
                      ? personal.snapshot
                      : scope === "machine"
                        ? latest?.machine
                        : latest?.project?.settings;
                  if (!snapshot || snapshot.readOnly || snapshot.unavailable)
                    throw new Error("所选范围不可读取。");
                  bundle.scopes[scope] = exportPreferenceGroups(scope, snapshot.document.values);
                }
                parsePreferenceBundle(JSON.stringify(bundle));
                download(bundle);
              })
            }
          >
            导出所选偏好
          </Button>
          <Button variant="outlined" component="label" disabled={busy || disabled}>
            选择偏好文件
            <input
              aria-label="导入偏好文件"
              hidden
              type="file"
              accept=".json,application/json"
              disabled={busy || disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file)
                  void run(async () => {
                    if (file.size > 1024 * 1024) throw new Error("偏好文件不能超过 1 MiB。");
                    await openPreview(parsePreferenceBundle(await file.text()), false);
                  });
              }}
            />
          </Button>
          <Button
            disabled={busy || disabled}
            onClick={() =>
              void run(async () => {
                const bundle: PreferenceBundle = {
                  format: "mizuki-panel-preferences",
                  schemaVersion: 1,
                  scopes: {},
                };
                for (const scope of scopes)
                  if (available(scope))
                    bundle.scopes[scope] = exportPreferenceGroups(scope, defaultValues(scope));
                await openPreview(bundle, true);
              })
            }
          >
            预览批量恢复默认
          </Button>
        </Stack>
        <Dialog
          open={Boolean(preview)}
          onClose={() => {
            if (!busy) setPreview(null);
          }}
          fullWidth
          maxWidth="md"
          aria-labelledby="preferences-preview-title"
        >
          <DialogTitle id="preferences-preview-title">
            {preview?.reset ? "恢复默认预览" : "偏好导入预览"}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Typography>
                明确选择需要应用的范围和分组。每个范围独立保存；失败范围保留输入，成功范围不会重复应用。项目偏好将写入预览时的当前项目
                {preview?.overview?.project ? `“${preview.overview.project.name}”` : ""}。
              </Typography>
              {error && <Alert severity="error">{error}</Alert>}
              {results.map((item) => (
                <Alert key={item.scope} severity={item.success ? "success" : "error"}>
                  {scopeLabels[item.scope]}：{item.message}
                </Alert>
              ))}
              {preview &&
                scopes
                  .filter((scope) => preview.bundle.scopes[scope])
                  .map((scope) => {
                    const snapshot =
                      scope === "browser"
                        ? preview.browser
                        : scope === "machine"
                          ? preview.overview?.machine
                          : preview.overview?.project?.settings;
                    const cannotWrite = !snapshot || snapshot.readOnly || snapshot.unavailable;
                    return (
                      <Box key={scope}>
                        <Typography variant="h6">{scopeLabels[scope]}</Typography>
                        {cannotWrite && (
                          <Alert severity="warning">
                            此范围不可写，连接项目或解决存储问题后重新预览。
                          </Alert>
                        )}
                        {Object.entries(preview.bundle.scopes[scope]!).map(([group, fields]) => {
                          const id = `${scope}:${group}`;
                          const diff = preferenceDiff(snapshot?.document.values ?? {}, {
                            [group]: fields,
                          } as PreferenceGroups);
                          return (
                            <Paper variant="outlined" sx={{ p: 2, my: 1 }} key={group}>
                              <FormControlLabel
                                label={`${groupLabels[group] ?? group}（${diff.length} 项变化）`}
                                control={
                                  <Checkbox
                                    checked={selected.includes(id)}
                                    disabled={
                                      busy ||
                                      cannotWrite ||
                                      results.some((item) => item.scope === scope && item.success)
                                    }
                                    onChange={(_, checked) =>
                                      setSelected((ids) =>
                                        checked ? [...ids, id] : ids.filter((item) => item !== id),
                                      )
                                    }
                                  />
                                }
                              />
                              {diff.map((item) => (
                                <Typography
                                  key={item.field}
                                  variant="body2"
                                  sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                                >
                                  {preferenceFieldLabel(item.group, item.field)}：
                                  {typeof item.before === "string"
                                    ? item.before
                                    : JSON.stringify(item.before)}{" "}
                                  →{" "}
                                  {typeof item.after === "string"
                                    ? item.after
                                    : JSON.stringify(item.after)}
                                </Typography>
                              ))}
                              {!diff.length && (
                                <Typography variant="body2" color="text.secondary">
                                  与现有偏好相同。
                                </Typography>
                              )}
                            </Paper>
                          );
                        })}
                      </Box>
                    );
                  })}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setPreview(null)}>
              取消
            </Button>
            <Button
              variant="contained"
              disabled={busy || disabled || !selected.length}
              onClick={() => void run(apply)}
            >
              {preview?.reset ? "确认恢复所选默认" : "确认导入所选偏好"}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  );
}
