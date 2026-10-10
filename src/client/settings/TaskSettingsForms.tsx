import { useEffect, useState } from "react";
import {
  Alert,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { useScopedSettings } from "./useScopedSettings";
import type { SettingsController } from "./SettingsCard";
import { SettingsCard } from "./SettingsCard";
import { ScopedCard } from "./WorkspaceSettingsForms";
import { commitTypes } from "../../shared/task-settings";
import type { PreviewStatus } from "../types";
import { api } from "../api";
const stateLabels: Record<PreviewStatus["state"], string> = {
  stopped: "未启动",
  starting: "启动中",
  running: "运行中",
  external: "已连接外部服务",
  failed: "启动失败",
};
export function TaskSettingsForms({
  preview,
  publish,
  retention,
  controller,
  projectRoot,
  active,
}: {
  preview: ReturnType<typeof useScopedSettings>;
  publish: ReturnType<typeof useScopedSettings>;
  retention: ReturnType<typeof useScopedSettings>;
  controller: SettingsController;
  projectRoot: string;
  active: boolean;
}) {
  const [status, setStatus] = useState<PreviewStatus | null>(null);
  useEffect(() => {
    setStatus(null);
    if (!active || !projectRoot) return;
    const abort = new AbortController();
    const refresh = () =>
      void api<PreviewStatus>("/api/preview/status", { signal: abort.signal })
        .then((value) => {
          if (!abort.signal.aborted) setStatus(value);
        })
        .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => {
      abort.abort();
      window.clearInterval(timer);
    };
  }, [active, projectRoot]);
  const logs = controller.drafts.logs.value;
  return (
    <Stack spacing={3}>
      <ScopedCard title="Astro 预览" controller={preview}>
        <Stack spacing={3}>
          <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {projectRoot || "连接项目后可设置预览端口和路径。"}
          </Typography>
          <TextField
            label="Astro 预览端口"
            type="number"
            value={preview.value.port}
            onChange={(event) => preview.change({ port: Number(event.target.value) })}
            slotProps={{ htmlInput: { min: 1024, max: 65535 } }}
            helperText="1024—65535，默认 4321；保存后在下次启动预览时应用，不重启当前进程。"
          />
          <TextField
            label="默认预览路径"
            value={preview.value.path}
            onChange={(event) => preview.change({ path: event.target.value })}
            helperText="以 / 开头，例如 /about/；下次打开预览页填入，文章入口和临时输入优先。"
          />
          {status && (
            <Alert
              severity={
                status.state === "failed"
                  ? "warning"
                  : status.state === "running" && !status.pendingPort
                    ? "success"
                    : "info"
              }
            >
              预览状态：{stateLabels[status.state]}，当前端口 {status.port ?? 4321}
              {status.pendingPort ? `；已保存端口 ${status.configuredPort} 尚未应用。` : "。"}
            </Alert>
          )}
          <Alert severity="info">
            外部 HTTP 服务可查看，但无法确认其项目归属，面板不会停止或重启外部进程。非 HTTP
            服务或不可用端口会提示占用。
          </Alert>
        </Stack>
      </ScopedCard>
      <ScopedCard title="日志保留数量" controller={retention}>
        <Stack spacing={3}>
          <TextField
            label="预览日志条数"
            type="number"
            value={retention.value.preview}
            onChange={(event) => retention.change({ preview: Number(event.target.value) })}
            slotProps={{ htmlInput: { min: 100, max: 5000 } }}
            helperText="100—5000，默认 300；本机后续日志追加时生效。"
          />
          <TextField
            label="发布日志条数"
            type="number"
            value={retention.value.publish}
            onChange={(event) => retention.change({ publish: Number(event.target.value) })}
            slotProps={{ htmlInput: { min: 100, max: 5000 } }}
            helperText="100—5000，默认 500；只保留日志，不改变运行中的发布任务。"
          />
        </Stack>
      </ScopedCard>
      <SettingsCard title="日志显示" group="logs" controller={controller}>
        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={logs.autoScroll}
                onChange={(_, autoScroll) => controller.change("logs", { autoScroll })}
              />
            }
            label="日志自动滚动"
          />
          <TextField
            label="日志字号"
            type="number"
            value={logs.fontSize}
            onChange={(event) =>
              controller.change("logs", { fontSize: Number(event.target.value) })
            }
            slotProps={{ htmlInput: { min: 10, max: 24 } }}
            helperText="10—24px，默认 12px；预览和发布日志同步应用，关闭自动滚动后保持阅读位置。"
          />
        </Stack>
      </SettingsCard>
      <ScopedCard title="发布表单默认值" controller={publish}>
        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={publish.value.remember === true}
                onChange={(_, remember) => publish.change({ remember })}
              />
            }
            label="记住提交类型与作用域"
          />
          <TextField
            label="默认提交类型"
            select
            value={publish.value.type}
            onChange={(event) => publish.change({ type: event.target.value })}
          >
            {commitTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="默认提交作用域"
            value={publish.value.scope}
            onChange={(event) => publish.change({ scope: event.target.value })}
            helperText="可留空；小写字母、数字及 . _ / -，最多 80 字符。"
          />
          <Alert severity="info">
            开启后在下次打开发布页填入默认值，提交成功后记住本次类型与作用域。提交说明保持空白，文件不自动勾选；保存设置不会提交、推送、同步或构建。
          </Alert>
        </Stack>
      </ScopedCard>
    </Stack>
  );
}
