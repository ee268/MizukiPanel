import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import { useSearchParams } from "react-router-dom";
import { api, json } from "../api";
import { TypeScriptEditor } from "../components/TypeScriptEditor";
import type { ConfigDescriptor, ConfigValue, ProjectReport, SiteConfigDocument } from "../types";

const formatted = (value: ConfigValue | null) =>
  value === null ? "（未设置覆盖值）" : JSON.stringify(value, null, 2);

export default function ConfigPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [configs, setConfigs] = useState<ConfigDescriptor[]>([]);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [selected, setSelected] = useState(() => searchParams.get("key") ?? "siteConfig");
  const [document, setDocument] = useState<SiteConfigDocument | null>(null);
  const [initializer, setInitializer] = useState("");
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [backupPath, setBackupPath] = useState<string | null>(null);

  useEffect(() => {
    api<{ report: ProjectReport; configs: ConfigDescriptor[] }>("/api/configs")
      .then((data) => {
        setConfigs(data.configs);
        setReport(data.report);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "配置清单读取失败"));
  }, []);
  useEffect(() => {
    const requested = searchParams.get("key");
    if (requested && configs.some((item) => item.key === requested)) setSelected(requested);
  }, [configs, searchParams]);
  const load = useCallback(async (key: string) => {
    setBusy(true);
    try {
      const data = await api<SiteConfigDocument>(`/api/config?key=${encodeURIComponent(key)}`);
      setDocument(data);
      setInitializer(data.initializer);
      setBackupPath(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "配置读取失败");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (configs.some((item) => item.key === selected)) void load(selected);
  }, [configs, load, selected]);
  const groups = useMemo(
    () =>
      configs.reduce<Record<string, ConfigDescriptor[]>>((result, item) => {
        (result[item.group] ??= []).push(item);
        return result;
      }, {}),
    [configs],
  );

  function selectConfig(key: string) {
    setSelected(key);
    setSearchParams(key === "siteConfig" ? {} : { key }, { replace: true });
  }

  async function save() {
    if (!document) return;
    setBusy(true);
    try {
      const result = await api<{ config: SiteConfigDocument; backupPath: string | null }>(
        "/api/config",
        json("PUT", {
          key: selected,
          initializer,
          version: document.version,
        }),
      );
      setDocument(result.config);
      setInitializer(result.config.initializer);
      setBackupPath(result.backupPath);
      setNotice(
        result.config.mode === "external"
          ? "覆盖配置已保存；预览前请重新启动 Astro。"
          : "站点配置已保存。",
      );
      setError("");
      if (selected === "siteConfig" || selected === "profileConfig")
        window.dispatchEvent(new Event("mizuki-site-identity-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "配置保存失败");
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!document || !backupPath) return;
    setBusy(true);
    try {
      const result = await api<SiteConfigDocument>(
        "/api/config/restore",
        json("POST", {
          key: selected,
          backupPath,
          version: document.version,
        }),
      );
      setDocument(result);
      setInitializer(result.initializer);
      setBackupPath(null);
      setNotice("已恢复保存前的配置。");
      setError("");
      if (selected === "siteConfig" || selected === "profileConfig")
        window.dispatchEvent(new Event("mizuki-site-identity-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "配置恢复失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">站点配置</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            管理 Mizuki 的 18 个可覆盖配置，查看默认值、覆盖值和最终值。
          </Typography>
        </Box>
        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {report?.readOnly && <Alert severity="warning">当前工作区只读，配置只能查看。</Alert>}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3, lg: 2.5 }}>
            <Paper
              variant="outlined"
              sx={{
                position: { md: "sticky" },
                top: { md: 88 },
                maxHeight: { md: "calc(100vh - 112px)" },
                overflow: "auto",
              }}
            >
              {Object.entries(groups).map(([group, items], index) => (
                <Box key={group}>
                  {index > 0 && <Divider />}
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ display: "block", px: 2, pt: 1.5 }}
                  >
                    {group}
                  </Typography>
                  <List dense disablePadding sx={{ pb: 1 }}>
                    {items.map((item) => (
                      <ListItemButton
                        key={item.key}
                        selected={selected === item.key}
                        onClick={() => selectConfig(item.key)}
                      >
                        <ListItemText
                          primary={item.label}
                          secondary={item.key}
                          slotProps={{
                            secondary: { sx: { fontFamily: "monospace", fontSize: 10 } },
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Box>
              ))}
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 9, lg: 9.5 }}>
            {!document || (busy && !document) ? (
              <Paper
                variant="outlined"
                sx={{ minHeight: 420, display: "grid", placeItems: "center" }}
              >
                <CircularProgress />
              </Paper>
            ) : (
              <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 2.5 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{ alignItems: { sm: "center" } }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5">{document.descriptor.label}</Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontFamily: "monospace", mt: 0.5 }}
                      >
                        {document.mode === "external"
                          ? `overrides/${document.descriptor.key}.ts`
                          : `src/config/${document.descriptor.file}`}
                      </Typography>
                    </Box>
                    <Chip
                      color={document.mode === "external" ? "info" : "default"}
                      label={document.mode === "external" ? "独立仓库覆盖" : "本地源配置"}
                    />
                    <Chip
                      color={document.changedPaths.length ? "warning" : "success"}
                      label={`${document.changedPaths.length} 项差异`}
                    />
                  </Stack>
                  {document.warnings.map((warning) => (
                    <Alert key={warning} severity="info" sx={{ mt: 2 }}>
                      {warning}
                    </Alert>
                  ))}
                  <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mt: 2 }}>
                    <Tab label="编辑" />
                    <Tab label="默认 / 覆盖 / 最终" />
                  </Tabs>
                </Paper>
                {tab === 0 ? (
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      编辑导出对象的 TypeScript
                      内容。仅允许对象、数组、标量、枚举和标识符；函数调用及其他可执行表达式会被拒绝。
                    </Typography>
                    <TypeScriptEditor
                      value={initializer}
                      onChange={setInitializer}
                      disabled={document.readOnly || busy}
                    />
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ mt: 2, flexWrap: "wrap" }}
                      useFlexGap
                    >
                      <Button
                        variant="contained"
                        startIcon={<SaveOutlined />}
                        onClick={save}
                        disabled={document.readOnly || busy || initializer === document.initializer}
                      >
                        保存配置
                      </Button>
                      <Button
                        startIcon={<RefreshOutlined />}
                        onClick={() => {
                          setInitializer(document.initializer);
                          setError("");
                        }}
                        disabled={busy}
                      >
                        放弃编辑
                      </Button>
                      {document.mode === "external" && (
                        <Button
                          onClick={() => setInitializer("{}")}
                          disabled={document.readOnly || busy}
                        >
                          清空覆盖
                        </Button>
                      )}
                      {backupPath && (
                        <Button
                          color="warning"
                          startIcon={<RestoreOutlined />}
                          onClick={restore}
                          disabled={busy}
                        >
                          撤销本次保存
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                ) : (
                  <Grid container spacing={2}>
                    <ValueCard title="上游默认值" value={document.defaultValue} />
                    {document.mode === "external" && (
                      <ValueCard title="内容仓库覆盖值" value={document.overrideValue} />
                    )}
                    <ValueCard title="最终生效值" value={document.effectiveValue} />
                    <Grid size={{ xs: 12 }}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="h6">差异路径</Typography>
                        {document.changedPaths.length ? (
                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            sx={{ mt: 1.5, flexWrap: "wrap" }}
                          >
                            {document.changedPaths.map((path) => (
                              <Chip key={path} label={path} size="small" />
                            ))}
                          </Stack>
                        ) : (
                          <Typography color="text.secondary" sx={{ mt: 1 }}>
                            当前配置与默认值一致。
                          </Typography>
                        )}
                      </Paper>
                    </Grid>
                  </Grid>
                )}
              </Stack>
            )}
          </Grid>
        </Grid>
      </Stack>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={5000}
        onClose={() => setNotice("")}
        message={notice}
      />
    </Container>
  );
}

function ValueCard({ title, value }: { title: string; value: ConfigValue | null }) {
  return (
    <Grid size={{ xs: 12, xl: 4 }}>
      <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
        <Typography variant="h6">{title}</Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            mt: 1.5,
            p: 1.5,
            maxHeight: 520,
            overflow: "auto",
            borderRadius: 1,
            bgcolor: "action.hover",
            fontSize: 12,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {formatted(value)}
        </Box>
      </Paper>
    </Grid>
  );
}
