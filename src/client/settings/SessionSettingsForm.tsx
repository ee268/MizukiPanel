import { Alert, FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import { useSyncExternalStore } from "react";
import type { useScopedSettings } from "./useScopedSettings";
import { ScopedCard } from "./ScopedCard";
import { sessionLifecycle } from "../auth/session-lifecycle";
export function SessionSettingsForm({
  controller,
}: {
  controller: ReturnType<typeof useScopedSettings>;
}) {
  const { session } = useSyncExternalStore(sessionLifecycle.subscribe, sessionLifecycle.getState);
  return (
    <ScopedCard title="会话策略" controller={controller}>
      <Stack spacing={2}>
        <Alert severity="info">
          默认关闭超时限制。保存后在所有现有会话的下一次请求生效，缩短期限可能立即要求重新登录。后台状态和日志轮询不会延长闲置时间。
        </Alert>
        <FormControlLabel
          label="闲置自动退出"
          control={
            <Switch
              checked={controller.value.idleEnabled === true}
              onChange={(_, idleEnabled) => controller.change({ idleEnabled })}
            />
          }
        />
        <TextField
          label="闲置退出时间（分钟）"
          type="number"
          value={controller.value.idleMinutes}
          onChange={(event) => controller.change({ idleMinutes: Number(event.target.value) })}
          helperText="5—240 分钟。键入、点击、触摸和滚动会报告活动。"
        />
        <FormControlLabel
          label="限制会话最大有效期"
          control={
            <Switch
              checked={controller.value.maximumEnabled === true}
              onChange={(_, maximumEnabled) => controller.change({ maximumEnabled })}
            />
          }
        />
        <TextField
          label="最大有效期（小时）"
          type="number"
          value={controller.value.maximumHours}
          onChange={(event) => controller.change({ maximumHours: Number(event.target.value) })}
          helperText="1—168 小时，从登录时起算；持续操作也不会延长。"
        />
        <Typography variant="body2" color="text.secondary">
          会话结束时先尝试保留本地文章草稿。保存失败或草稿保存已关闭时，页面保留输入并提供下载；预览和发布任务继续运行。
        </Typography>
        {session && (
          <Typography variant="body2" color="text.secondary">
            本次登录：{new Date(session.createdAt).toLocaleString()} · 当前期限：
            {session.expiresAt
              ? new Date(session.expiresAt).toLocaleString()
              : "浏览器会话（无超时限制）"}
            。此处显示服务端已经生效的策略。
          </Typography>
        )}
      </Stack>
    </ScopedCard>
  );
}
