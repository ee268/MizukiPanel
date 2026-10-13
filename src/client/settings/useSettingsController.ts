import { useEffect, useState } from "react";
import type { SettingsOverview } from "../../shared/panel-settings";
import { defaultValues } from "../../shared/panel-settings";
import { exportPreferenceGroups, type PreferenceGroups } from "../../shared/preferences-transfer";
import { api } from "../api";
import { usePersonalSettings } from "./PersonalSettingsProvider";
import { usePersonalDrafts } from "./usePersonalDrafts";
import { useProjectTemplate } from "./useProjectTemplate";
import { useScopedSettings } from "./useScopedSettings";
import { useWorkspaceSession } from "../workspace/WorkspaceSessionProvider";
import { useSessionRecovery } from "../auth/useSessionRecovery";
import { aiCredentials } from "../ai/credentials";
import type { AiVaultStatus } from "../../shared/ai-vault";

export function useSettingsController() {
  const [serverError, setServerError] = useState("");
  const [reload, setReload] = useState(0);
  const preferences = usePersonalSettings();
  const controller = usePersonalDrafts();
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [loading, setLoading] = useState(true);
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
    saveProjectSnapshot,
  );
  function saveProjectSnapshot(settings: NonNullable<SettingsOverview["project"]>["settings"]) {
    setOverview((current) =>
      current?.project ? { ...current, project: { ...current.project, settings } } : current,
    );
    refreshWorkspace();
  }
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
  const maintenance = useScopedSettings(
    "machine",
    "maintenance",
    overview?.machine ?? null,
    undefined,
    (settings) => setOverview((current) => (current ? { ...current, machine: settings } : current)),
  );
  const sessionSettings = useScopedSettings(
    "machine",
    "session",
    overview?.machine ?? null,
    undefined,
    (settings) => {
      setOverview((current) => (current ? { ...current, machine: settings } : current));
      void api("/api/session").catch(() => {});
    },
  );
  const scoped = [
    machine,
    access,
    media,
    previewSettings,
    publishSettings,
    retention,
    maintenance,
    sessionSettings,
  ];
  const dirty = controller.dirty || template.dirty || scoped.some((item) => item.dirty);
  const saving = controller.saving || template.saving || scoped.some((item) => item.saving);
  useSessionRecovery({
    label: "未保存设置",
    prepare: () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
    save: async () => {
      if (dirty) throw new Error("设置仍有未保存修改，请下载修改副本后登录。");
    },
    snapshot: () => {
      if (!dirty) return null;
      return {
        format: "mizuki-panel-preferences",
        schemaVersion: 1,
        scopes: {
          browser: exportPreferenceGroups(
            "browser",
            Object.fromEntries(
              Object.entries(controller.drafts).map(([group, draft]) => [group, draft.value]),
            ) as unknown as PreferenceGroups,
          ),
          machine: exportPreferenceGroups("machine", {
            ...defaultValues("machine"),
            workspace: machine.value,
            logs: retention.value,
            maintenance: maintenance.value,
            session: sessionSettings.value,
          }),
          ...(overview?.project
            ? {
                project: exportPreferenceGroups("project", {
                  ...defaultValues("project"),
                  access: access.value,
                  media: media.value,
                  preview: previewSettings.value,
                  publish: publishSettings.value,
                  articleTemplate: template.value as unknown as Record<string, unknown>,
                }),
              }
            : {}),
        },
      };
    },
  });
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setServerError("");
    void api<SettingsOverview>("/api/settings", { signal: abort.signal })
      .then((value) => {
        if (!abort.signal.aborted) setOverview(value);
      })
      .catch((cause) => {
        if (!abort.signal.aborted)
          setServerError(cause instanceof Error ? cause.message : "设置状态读取失败。");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [reload, workspace.data?.version]);
  const warnings = [
    ...preferences.snapshot.warnings.map((warning) => `本机偏好：${warning}`),
    ...(overview?.warnings ?? []),
    ...(overview?.machine.warnings ?? []).map((warning) => `本机面板：${warning}`),
    ...(overview?.project?.settings.warnings ?? []).map((warning) => `当前项目：${warning}`),
  ];
  return {
    preferences,
    controller,
    overview,
    loading,
    machine,
    access,
    template,
    media,
    previewSettings,
    publishSettings,
    retention,
    maintenance,
    sessionSettings,
    scoped,
    dirty,
    saving,
    serverError,
    reload,
    warnings,
    refreshWorkspace,
    reloadSettings: () => {
      setReload((value) => value + 1);
      void preferences
        .load()
        .then(() => api<AiVaultStatus>("/api/ai/credentials"))
        .then((status) => aiCredentials.adopt(status))
        .catch((cause: Error) => setServerError(cause.message));
    },
    maintenanceRevision: `${workspace.data?.version}:${workspace.data?.report?.readOnly}:${reload}`,
  };
}
export type SettingsController = ReturnType<typeof useSettingsController>;
