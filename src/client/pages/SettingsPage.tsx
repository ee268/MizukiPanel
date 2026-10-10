import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useBlocker, useSearchParams } from "react-router-dom";
import type { SettingsOverview } from "../../shared/panel-settings";
import { api } from "../api";
import { settingsSections } from "../settings/sections";
import { usePersonalSettings } from "../settings/PersonalSettingsProvider";
import { usePersonalDrafts } from "../settings/usePersonalDrafts";
import { AppearanceSettingsForms } from "../settings/AppearanceSettingsForms";
import { EditorSettingsForms } from "../settings/EditorSettingsForms";
import { useProjectTemplate } from "../settings/useProjectTemplate";
import { ProjectTemplateForm } from "../settings/ProjectTemplateForm";
import { useScopedSettings } from "../settings/useScopedSettings";
import { WorkspaceSettingsForms } from "../settings/WorkspaceSettingsForms";
import { useWorkspaceSession } from "../workspace/WorkspaceSessionProvider";
import { MediaSettingsForm } from "../settings/MediaSettingsForm";
import { TaskSettingsForms } from "../settings/TaskSettingsForms";

export default function SettingsPage() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [params, setParams] = useSearchParams();
  const selected = params.get("section");
  const sectionId = settingsSections.some((item) => item.id === selected)
    ? selected!
    : "appearance";
  const preferences = usePersonalSettings();
  const controller = usePersonalDrafts();
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const workspace = useWorkspaceSession();
  const refreshWorkspace = () => {
    workspace.notify();
    void workspace.refresh().catch((cause) => setServerError(cause.message));
  };
  const machine = useScopedSettings(
    "machine",
    "workspace",
    overview?.machine ?? null,
    undefined,
    (settings) => {
      setOverview((current) => (current ? { ...current, machine: settings } : current));
      refreshWorkspace();
    },
  );
  const access = useScopedSettings(
    "project",
    "access",
    overview?.project?.settings ?? null,
    overview?.project?.key,
    (settings) => {
      setOverview((current) =>
        current?.project
          ? {
              ...current,
              project: {
                ...current.project,
                settings,
                readOnlyInfo: {
                  detected: current.project.readOnlyInfo?.detected ?? false,
                  settings: settings.readOnly,
                  preference: settings.document.values.access.readOnly === true,
                },
              },
            }
          : current,
      );
      refreshWorkspace();
    },
  );
  const template = useProjectTemplate(overview?.project ?? null, (key, settings) =>
    setOverview((current) =>
      current?.project?.key === key
        ? { ...current, project: { ...current.project, settings } }
        : current,
    ),
  );
  const media = useScopedSettings(
    "project",
    "media",
    overview?.project?.settings ?? null,
    overview?.project?.key,
    (settings) => {
      setOverview((current) =>
        current?.project ? { ...current, project: { ...current.project, settings } } : current,
      );
      refreshWorkspace();
    },
  );
  const saveProjectSnapshot = (settings: NonNullable<SettingsOverview["project"]>["settings"]) => {
    setOverview((current) =>
      current?.project ? { ...current, project: { ...current.project, settings } } : current,
    );
    refreshWorkspace();
  };
  const previewSettings = useScopedSettings(
    "project",
    "preview",
    overview?.project?.settings ?? null,
    overview?.project?.key,
    saveProjectSnapshot,
  );
  const publishSettings = useScopedSettings(
    "project",
    "publish",
    overview?.project?.settings ?? null,
    overview?.project?.key,
    saveProjectSnapshot,
  );
  const retention = useScopedSettings(
    "machine",
    "logs",
    overview?.machine ?? null,
    undefined,
    (settings) => setOverview((current) => (current ? { ...current, machine: settings } : current)),
  );
  const scoped = [machine, access, media, previewSettings, publishSettings, retention];
  const dirty = controller.dirty || template.dirty || scoped.some((item) => item.dirty);
  const saving = controller.saving || template.saving || scoped.some((item) => item.saving);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      currentLocation.pathname + currentLocation.search !==
        nextLocation.pathname + nextLocation.search,
  );
  const [serverError, setServerError] = useState("");
  const [reload, setReload] = useState(0);
  const [leaveError, setLeaveError] = useState("");
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const allowLogout = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    setServerError("");
    void api<SettingsOverview>("/api/settings", { signal: abort.signal })
      .then((value) => {
        if (!abort.signal.aborted) setOverview(value);
      })
      .catch((cause) => {
        if (!abort.signal.aborted)
          setServerError(cause instanceof Error ? cause.message : "设置状态读取失败。");
      });
    return () => abort.abort();
  }, [reload, workspace.data]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const logout = (event: MouseEvent) => {
      if (allowLogout.current) {
        allowLogout.current = false;
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest('button[aria-label="退出登录"]')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setLogoutOpen(true);
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", logout, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", logout, true);
    };
  }, [dirty]);
  function leave() {
    setLeaveError("");
    if (logoutOpen) {
      // Commit the chosen save/discard before logout can trigger a native unload.
      flushSync(() => setLogoutOpen(false));
      allowLogout.current = true;
      document.querySelector<HTMLButtonElement>('button[aria-label="退出登录"]')?.click();
    } else if (blocker.state === "blocked") blocker.proceed();
  }
  async function saveAndLeave() {
    if (
      (controller.dirty && !(await controller.save())) ||
      (template.dirty && !(await template.save())) ||
      !(await saveScoped())
    )
      setLeaveError("部分设置尚未保存。已保存范围保留，失败范围的输入仍保留，请继续编辑处理提示。");
    else leave();
  }
  async function saveScoped() {
    for (const item of scoped) if (item.dirty && !(await item.save())) return false;
    return true;
  }
  const cancelLeave = () => {
    setLeaveError("");
    setLogoutOpen(false);
    if (blocker.state === "blocked") blocker.reset();
  };
  const warnings = [
    ...preferences.snapshot.warnings.map((warning) => `浏览器偏好：${warning}`),
    ...(overview?.warnings ?? []),
    ...(overview?.machine.warnings ?? []).map((warning) => `本机面板：${warning}`),
    ...(overview?.project?.settings.warnings ?? []).map((warning) => `当前项目：${warning}`),
  ];
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" component="h1">
            设置
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            管理 MizukiPanel 的显示、编辑与工作区偏好。
          </Typography>
        </Box>
        {warnings.map((warning) => (
          <Alert key={warning} severity="warning">
            {warning}
          </Alert>
        ))}
        {preferences.error && <Alert severity="error">{preferences.error}</Alert>}
        {preferences.snapshot.readOnly && preferences.snapshot.document.schemaVersion <= 1 && (
          <Alert
            severity="warning"
            action={<Button onClick={() => setRecoverOpen(true)}>恢复默认</Button>}
          >
            浏览器设置已暂停写入。恢复前会保留损坏数据副本。
          </Alert>
        )}
        {serverError && (
          <Alert
            severity="warning"
            action={<Button onClick={() => setReload((value) => value + 1)}>重试</Button>}
          >
            本机/项目设置暂不可读取：{serverError}。仍可调整浏览器外观。
          </Alert>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "220px minmax(0, 1fr)" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              minWidth: 0,
              p: 1,
              position: { md: "sticky" },
              top: { md: "calc(var(--mizuki-panel-header-height, 64px) + 24px)" },
            }}
          >
            <Tabs
              value={sectionId}
              onChange={(_, value: string) => {
                const next = new URLSearchParams(params);
                next.set("section", value);
                setParams(next);
              }}
              orientation={desktop ? "vertical" : "horizontal"}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="设置分类"
              sx={{ "& .MuiTab-root": { minHeight: 52, justifyContent: "flex-start", px: 2 } }}
            >
              {settingsSections.map((item) => (
                <Tab
                  key={item.id}
                  value={item.id}
                  id={`settings-tab-${item.id}`}
                  aria-controls={`settings-panel-${item.id}`}
                  icon={item.icon}
                  iconPosition="start"
                  label={item.title}
                />
              ))}
            </Tabs>
          </Paper>
          <Box sx={{ minWidth: 0 }}>
            {settingsSections.map((item) => (
              <Box
                key={item.id}
                role="tabpanel"
                id={`settings-panel-${item.id}`}
                aria-labelledby={`settings-tab-${item.id}`}
                hidden={sectionId !== item.id}
                tabIndex={0}
              >
                {item.id === "appearance" ? (
                  <AppearanceSettingsForms controller={controller} />
                ) : item.id === "editor" ? (
                  <EditorSettingsForms
                    controller={controller}
                    projectRoot={overview?.project?.root ?? ""}
                    active={sectionId === "editor"}
                    template={
                      <ProjectTemplateForm
                        controller={template}
                        onRefresh={() => setReload((value) => value + 1)}
                      />
                    }
                  />
                ) : item.id === "workspace" ? (
                  <WorkspaceSettingsForms
                    controller={controller}
                    machine={machine}
                    access={access}
                    project={overview?.project ?? null}
                    dirty={dirty || saving}
                    onRefresh={() => setReload((value) => value + 1)}
                  />
                ) : item.id === "media" ? (
                  <MediaSettingsForm
                    controller={media}
                    projectRoot={overview?.project?.root ?? ""}
                  />
                ) : item.id === "preview" ? (
                  <TaskSettingsForms
                    preview={previewSettings}
                    publish={publishSettings}
                    retention={retention}
                    controller={controller}
                    projectRoot={overview?.project?.root ?? ""}
                    active={sectionId === "preview"}
                  />
                ) : (
                  <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                    <Typography variant="h6" component="h2">
                      {item.title}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {item.description}
                    </Typography>
                    <Stack spacing={1.5} sx={{ py: 7, alignItems: "center", textAlign: "center" }}>
                      <SettingsOutlined sx={{ fontSize: 40, color: "text.disabled" }} />
                      <Typography color="text.secondary">此分类暂未提供可调整的选项。</Typography>
                    </Stack>
                  </Paper>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Stack>
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={Boolean(controller.notice)}
        autoHideDuration={preferences.effective.notifications.duration}
        message={controller.notice}
        onClose={controller.clearNotice}
      />
      <Dialog
        open={blocker.state === "blocked" || logoutOpen}
        onClose={cancelLeave}
        aria-labelledby="settings-leave-title"
      >
        <DialogTitle id="settings-leave-title">设置尚未保存</DialogTitle>
        <DialogContent>
          <Typography>保存修改后离开，或放弃本次修改。继续编辑会保留当前输入。</Typography>
          {leaveError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {leaveError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap" }}>
          <Button onClick={cancelLeave} disabled={saving}>
            继续编辑
          </Button>
          <Button
            onClick={() => {
              controller.cancelAll();
              template.reset();
              scoped.forEach((item) => item.reset());
              leave();
            }}
            disabled={saving}
          >
            放弃修改
          </Button>
          <Button
            variant="contained"
            onClick={() => void saveAndLeave()}
            disabled={
              saving ||
              (controller.dirty && preferences.snapshot.readOnly) ||
              (template.dirty && template.base?.settings.readOnly) ||
              scoped.some((item) => item.dirty && item.readOnly)
            }
          >
            保存并离开
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={recoverOpen}
        onClose={() => setRecoverOpen(false)}
        aria-labelledby="settings-recover-title"
      >
        <DialogTitle id="settings-recover-title">恢复浏览器默认设置</DialogTitle>
        <DialogContent>
          将保存原数据副本并重置当前浏览器的外观、导航、操作提示、编辑器与草稿保存偏好。文章、本地恢复副本和项目模板不受影响。
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecoverOpen(false)}>取消</Button>
          <Button
            onClick={() => {
              void preferences
                .recover()
                .then(() => {
                  controller.cancelAll();
                  setRecoverOpen(false);
                })
                .catch(() => {});
            }}
          >
            恢复默认设置
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
