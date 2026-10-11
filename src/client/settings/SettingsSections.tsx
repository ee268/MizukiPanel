import { lazy, Suspense } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { settingsSections } from "./sections";
import { SettingsModule } from "./SettingsModule";
import { ContentLoading } from "../components/ContentLoading";
import type { SettingsController } from "./useSettingsController";
const AppearanceSettingsForms = lazy(() =>
  import("./AppearanceSettingsForms").then((m) => ({
    default: m.AppearanceSettingsForms,
  })),
);
const EditorSettingsForms = lazy(() =>
  import("./EditorSettingsForms").then((m) => ({ default: m.EditorSettingsForms })),
);
const ProjectTemplateForm = lazy(() =>
  import("./ProjectTemplateForm").then((m) => ({ default: m.ProjectTemplateForm })),
);
const WorkspaceSettingsForms = lazy(() =>
  import("./WorkspaceSettingsForms").then((m) => ({ default: m.WorkspaceSettingsForms })),
);
const MediaSettingsForm = lazy(() =>
  import("./MediaSettingsForm").then((m) => ({ default: m.MediaSettingsForm })),
);
const TaskSettingsForms = lazy(() =>
  import("./TaskSettingsForms").then((m) => ({ default: m.TaskSettingsForms })),
);
const MaintenanceSettingsForms = lazy(() =>
  import("./MaintenanceSettingsForms").then((m) => ({
    default: m.MaintenanceSettingsForms,
  })),
);
const PreferenceTransferForm = lazy(() =>
  import("./PreferenceTransferForm").then((m) => ({ default: m.PreferenceTransferForm })),
);
const SessionSettingsForm = lazy(() =>
  import("./SessionSettingsForm").then((m) => ({ default: m.SessionSettingsForm })),
);

export function SettingsSections({
  sectionId,
  visited,
  state,
}: {
  sectionId: string;
  visited: Set<string>;
  state: SettingsController;
}) {
  const {
    controller,
    overview,
    template,
    machine,
    access,
    media,
    previewSettings,
    publishSettings,
    retention,
    sessionSettings,
    maintenance,
    dirty,
    saving,
    maintenanceRevision,
    reloadSettings,
    refreshWorkspace,
  } = state;
  return (
    <Box data-page-motion="content" sx={{ minWidth: 0 }}>
      {settingsSections.map((item) => (
        <Box
          key={item.id}
          role="tabpanel"
          id={`settings-panel-${item.id}`}
          aria-labelledby={`settings-tab-${item.id}`}
          hidden={sectionId !== item.id}
          tabIndex={0}
        >
          {(sectionId === item.id || visited.has(item.id)) && (
            <Suspense
              fallback={
                <ContentLoading
                  heading={`正在展开${item.title}`}
                  description="正在准备设置模块"
                  kind="settings"
                />
              }
            >
              {item.id !== "appearance" && item.id !== "editor" && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h5" component="h2">
                    {item.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {item.description}
                  </Typography>
                </Box>
              )}
              {item.id === "appearance" ? (
                <AppearanceSettingsForms controller={controller} />
              ) : item.id === "editor" ? (
                <EditorSettingsForms
                  controller={controller}
                  projectRoot={overview?.project?.root ?? ""}
                  template={
                    <SettingsModule label="新建文章模板" estimatedHeight={820}>
                      <Suspense
                        fallback={
                          <ContentLoading
                            heading="正在展开新建文章模板"
                            description="正在读取模板与预览区域"
                            kind="settings"
                            size="compact"
                          />
                        }
                      >
                        <ProjectTemplateForm
                          controller={template}
                          onRefresh={() => reloadSettings()}
                        />
                      </Suspense>
                    </SettingsModule>
                  }
                />
              ) : item.id === "workspace" ? (
                <WorkspaceSettingsForms
                  controller={controller}
                  machine={machine}
                  access={access}
                  project={overview?.project ?? null}
                  dirty={dirty || saving}
                  onRefresh={() => reloadSettings()}
                />
              ) : item.id === "media" ? (
                <MediaSettingsForm controller={media} projectRoot={overview?.project?.root ?? ""} />
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
                <Stack spacing={3}>
                  <SessionSettingsForm controller={sessionSettings} />
                  <MaintenanceSettingsForms
                    controller={maintenance}
                    active={sectionId === "maintenance"}
                    revision={maintenanceRevision}
                    disabled={dirty || saving}
                    onRestored={() => {
                      reloadSettings();
                      refreshWorkspace();
                    }}
                  />
                  <SettingsModule label="偏好导入导出" estimatedHeight={520}>
                    <Suspense
                      fallback={
                        <ContentLoading
                          heading="正在展开偏好导入导出"
                          description="正在准备迁移工具"
                          kind="settings"
                          size="compact"
                        />
                      }
                    >
                      <PreferenceTransferForm
                        overview={overview}
                        disabled={dirty || saving}
                        onApplied={() => {
                          reloadSettings();
                          refreshWorkspace();
                        }}
                      />
                    </Suspense>
                  </SettingsModule>
                </Stack>
              )}
            </Suspense>
          )}
        </Box>
      ))}
    </Box>
  );
}
