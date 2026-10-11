import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { SettingsOverview } from "../../shared/panel-settings";
import type { RecentProject } from "../../shared/workspace";
import { api, json } from "../api";
import { SettingsCard, type SettingsController } from "./SettingsCard";
import type { useScopedSettings } from "./useScopedSettings";
import { useWorkspaceSession } from "../workspace/WorkspaceSessionProvider";
import { useWorkspaceActions } from "../workspace/useWorkspaceActions";
import type { WorkspaceData } from "../workspace/types";
import { RecentProjectList } from "../workspace/RecentProjectList";
import { SettingsModule } from "./SettingsModule";

type ScopedController = ReturnType<typeof useScopedSettings>;
export function ScopedCard({
  title,
  controller,
  children,
}: {
  title: string;
  controller: ScopedController;
  children: ReactNode;
}) {
  return (
    <SettingsModule label={title}>
      <Paper
        variant="outlined"
        component="section"
        aria-label={title}
        sx={{ p: { xs: 2.5, sm: 3 } }}
      >
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="h6" component="h3">
              {title}
            </Typography>
            {controller.dirty && <Chip label="未保存" size="small" color="warning" />}
          </Stack>
          {controller.error && <Alert severity="error">{controller.error}</Alert>}
          {controller.notice && <Alert severity="success">{controller.notice}</Alert>}
          {controller.conflict && (
            <Alert
              severity="warning"
              action={<Button onClick={() => controller.reset()}>重新载入本组</Button>}
            >
              本组设置已变化，当前输入已保留。
            </Alert>
          )}
          <Box
            component="fieldset"
            disabled={!controller.available || controller.readOnly || controller.saving}
            sx={{ p: 0, m: 0, border: 0, minWidth: 0 }}
          >
            {children}
          </Box>
          <Divider />
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="contained"
              disabled={
                !controller.dirty || controller.saving || controller.readOnly || controller.conflict
              }
              onClick={() => void controller.save()}
            >
              保存{title}
            </Button>
            <Button
              disabled={!controller.dirty || controller.saving}
              onClick={() => controller.reset()}
            >
              取消修改
            </Button>
            <Button
              disabled={!controller.available || controller.readOnly || controller.saving}
              onClick={() => controller.reset(true)}
            >
              恢复本组默认
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </SettingsModule>
  );
}
export function WorkspaceSettingsForms({
  controller,
  machine,
  access,
  project,
  dirty,
  onRefresh,
}: {
  controller: SettingsController;
  machine: ScopedController;
  access: ScopedController;
  project: SettingsOverview["project"];
  dirty: boolean;
  onRefresh: () => void;
}) {
  const session = useWorkspaceSession();
  const actions = useWorkspaceActions();
  const data = session.data;
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProject = data?.recentProjects.find((item) => item.id === selectedProjectId);
  useEffect(() => {
    if (selectedProjectId && !data?.recentProjects.some((item) => item.id === selectedProjectId))
      setSelectedProjectId(null);
  }, [data?.recentProjects, selectedProjectId]);
  const [remove, setRemove] = useState<RecentProject | null>(null);
  const [associate, setAssociate] = useState<RecentProject | null>(null);
  const [projectPath, setProjectPath] = useState("");
  const [preview, setPreview] = useState<{
    previous: RecentProject;
    next: RecentProject;
    copySettings: boolean;
    defaultChanges: boolean;
    previewVersion: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocked = dirty || busy || actions.busy;
  const projects = [
    ...(data?.recentProjects ?? []),
    ...(data?.defaultProject &&
    !data.recentProjects.some((item) => item.id === data.defaultProject!.id)
      ? [data.defaultProject]
      : []),
  ];
  async function mutate(kind: "remove" | "preview" | "apply") {
    setBusy(true);
    setError("");
    try {
      const body = {
        id: kind === "remove" ? remove?.id : associate?.id,
        projectPath,
        version: data?.historyVersion,
        previewVersion: preview?.previewVersion,
      };
      if (kind === "preview")
        setPreview(await api("/api/workspace/reassociate/preview", json("POST", body)));
      else {
        const next = await api<WorkspaceData>(
          kind === "remove" ? "/api/workspace/recent/remove" : "/api/workspace/reassociate/apply",
          json("POST", body),
        );
        setRemove(null);
        setAssociate(null);
        setPreview(null);
        session.adopt(next);
        onRefresh();
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack spacing={3}>
      <SettingsCard title="连接后的页面" group="workspace" controller={controller}>
        <TextField
          fullWidth
          select
          label="连接成功后进入"
          value={controller.drafts.workspace.value.afterConnect}
          onChange={(event) =>
            controller.change("workspace", {
              afterConnect: event.target
                .value as typeof controller.drafts.workspace.value.afterConnect,
            })
          }
          helperText="仅使用已保存的偏好，连接和切换项目后生效。"
        >
          {[
            ["/", "项目工作区"],
            ["/articles", "文章管理"],
            ["/config", "站点配置"],
            ["/features", "特色页面"],
            ["/media", "媒体管理"],
            ["/preview", "本地预览"],
            ["/publish", "发布工作流"],
          ].map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
      </SettingsCard>
      <ScopedCard title="启动与最近项目" controller={machine}>
        <Stack spacing={3}>
          <TextField
            fullWidth
            select
            label="启动时连接"
            value={machine.value.startup}
            onChange={(event) => machine.change({ startup: event.target.value })}
            helperText="保存后在下次启动面板服务时生效，不改变当前连接。"
          >
            <MenuItem value="last">恢复上次连接</MenuItem>
            <MenuItem value="default">连接默认项目</MenuItem>
            <MenuItem value="none">不自动连接</MenuItem>
          </TextField>
          <TextField
            fullWidth
            select
            label="默认项目"
            value={String(machine.value.defaultProject)}
            onChange={(event) => machine.change({ defaultProject: event.target.value })}
            helperText="失效路径会提示错误，不会自动连接其他项目。"
          >
            <MenuItem value="">未指定</MenuItem>
            {projects.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name}
                {!item.available ? "（路径不可用）" : ""} · {item.path}
              </MenuItem>
            ))}
            {machine.value.defaultProject &&
            !projects.some((item) => item.id === machine.value.defaultProject) ? (
              <MenuItem value={String(machine.value.defaultProject)}>
                记录不可用，请重新选择
              </MenuItem>
            ) : null}
          </TextField>
          <TextField
            label="最近项目显示数量"
            type="number"
            value={machine.value.recentLimit}
            onChange={(event) => machine.change({ recentLimit: Number(event.target.value) })}
            slotProps={{ htmlInput: { min: 1, max: 50 } }}
            helperText="1–50，默认 10。减少数量会立即收起多余记录，下一次连接时截取最近列表。"
          />
        </Stack>
      </ScopedCard>
      <SettingsModule label="最近项目" estimatedHeight={480}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h3">
              最近项目
            </Typography>
            <Typography color="text.secondary">
              移除仅清理列表记录，不会删除项目文件、项目设置或默认项目关联。路径移动后可预览并重新关联设置。
            </Typography>
            {dirty && (
              <Alert severity="info">请先保存或取消本页修改，再连接、移除或重新关联项目。</Alert>
            )}
            {actions.error && <Alert severity="error">{actions.error}</Alert>}
            {data?.warnings.map((warning) => (
              <Alert severity="warning" key={warning}>
                {warning}
              </Alert>
            ))}
            <RecentProjectList
              projects={data?.recentProjects ?? []}
              selectedId={selectedProject?.id ?? null}
              defaultProjectId={data?.defaultProject?.id}
              disabled={busy || actions.busy}
              onSelect={setSelectedProjectId}
              actions={(item) => (
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Button
                    disabled={blocked || machine.readOnly}
                    onClick={() => machine.change({ defaultProject: item.id })}
                  >
                    设为默认
                  </Button>
                  <Button
                    disabled={blocked || data?.historyReadOnly || data?.report?.root === item.path}
                    onClick={() => {
                      setAssociate(item);
                      setProjectPath(item.path);
                      setPreview(null);
                      setError("");
                    }}
                  >
                    重新关联
                  </Button>
                  <Button
                    disabled={blocked || data?.historyReadOnly}
                    onClick={() => {
                      setRemove(item);
                      setError("");
                    }}
                  >
                    移除记录
                  </Button>
                </Stack>
              )}
            />
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              <Button
                disabled={blocked || !selectedProject?.available}
                onClick={() => selectedProject && void actions.connect(selectedProject.path)}
              >
                连接项目
              </Button>
              <Button
                disabled={blocked}
                onClick={() => {
                  void session.refresh().catch((cause) => actions.setError(cause.message));
                  onRefresh();
                }}
              >
                刷新记录
              </Button>
              {data?.connectedPath && (
                <Button disabled={blocked} onClick={() => void actions.disconnect()}>
                  断开当前项目
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      </SettingsModule>
      <ScopedCard title="项目访问权限" controller={access}>
        {!project ? (
          <Alert severity="info">连接项目后可设置只读偏好。</Alert>
        ) : (
          <Stack spacing={2}>
            <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {project.root}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={access.value.readOnly === true}
                  onChange={(_, readOnly) => access.change({ readOnly })}
                />
              }
              label="将项目设为只读"
            />
            <Typography color="text.secondary">
              只读时禁止文章、配置、媒体、特色页面和发布写入，仍可调整面板偏好和查看内容。
            </Typography>
            <Alert
              severity={
                project.readOnlyInfo?.detected || project.readOnlyInfo?.settings
                  ? "warning"
                  : "info"
              }
            >
              {project.readOnlyInfo?.detected
                ? "项目检测结果要求只读，关闭此偏好也不会解除检测限制。"
                : project.readOnlyInfo?.settings
                  ? "项目设置不可写，已按只读处理。"
                  : "项目检测允许写入，保存的只读偏好决定访问权限。"}
            </Alert>
          </Stack>
        )}
      </ScopedCard>
      {actions.taskDialog}
      <Dialog open={Boolean(remove)} onClose={() => !busy && setRemove(null)}>
        <DialogTitle>移除最近项目记录</DialogTitle>
        <DialogContent sx={{ overflowWrap: "anywhere" }}>
          {remove?.path} 的文件和设置会保留。
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setRemove(null)}>
            取消
          </Button>
          <Button disabled={busy} onClick={() => void mutate("remove")}>
            移除记录
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(associate)}
        onClose={() => !busy && setAssociate(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>重新关联项目路径</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ overflowWrap: "anywhere" }}>原路径：{associate?.path}</Typography>
            <TextField
              label="新的项目绝对路径"
              value={projectPath}
              disabled={busy}
              onChange={(event) => {
                setProjectPath(event.target.value);
                setPreview(null);
              }}
            />
            <Button
              disabled={busy}
              onClick={() =>
                void api<{ path: string | null }>(
                  "/api/workspace/select-directory",
                  json("POST", { initialPath: projectPath }),
                )
                  .then((result) => {
                    if (result.path) {
                      setProjectPath(result.path);
                      setPreview(null);
                    }
                  })
                  .catch((cause) => setError(cause.message))
              }
            >
              选择文件夹
            </Button>
            {preview && (
              <Alert severity="info" sx={{ overflowWrap: "anywhere" }}>
                新路径：{preview.next.path}。
                {preview.copySettings
                  ? "将复制原项目设置，原副本保留。"
                  : "保留目标项目已有设置，不覆盖。"}
                {preview.defaultChanges ? "默认项目关联也会更新。" : ""}项目文件不会移动。
              </Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setAssociate(null)}>
            取消
          </Button>
          <Button disabled={busy || !projectPath.trim()} onClick={() => void mutate("preview")}>
            预览关联
          </Button>
          <Button
            variant="contained"
            disabled={busy || !preview}
            onClick={() => void mutate("apply")}
          >
            应用关联
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
