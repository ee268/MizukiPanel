import { Alert, FormControlLabel, MenuItem, Stack, Switch, TextField } from "@mui/material";
import type { ArticleAutosaveSettings } from "../../shared/article-autosave";
import { usePersonalSettings } from "./PersonalSettingsProvider";
import { SettingsCard, type SettingsController } from "./SettingsCard";

export function ArticleAutosaveSettingsForm({ controller }: { controller: SettingsController }) {
  const { snapshot } = usePersonalSettings();
  const settings = controller.drafts.articleAutosave.value;
  const disabled = snapshot.readOnly || controller.saving;
  const change = (fields: Partial<ArticleAutosaveSettings>) =>
    controller.change("articleAutosave", fields);
  return (
    <SettingsCard title="文章自动保存" group="articleAutosave" controller={controller}>
      <Stack spacing={3}>
        <FormControlLabel
          label="启用文章自动保存"
          control={
            <Switch
              disabled={disabled}
              checked={settings.enabled}
              onChange={(_, enabled) => change({ enabled })}
            />
          }
        />
        <TextField
          select
          fullWidth
          label="自动保存内容"
          value={settings.scope}
          disabled={disabled || !settings.enabled}
          onChange={(event) =>
            change({ scope: event.target.value as ArticleAutosaveSettings["scope"] })
          }
        >
          <MenuItem value="body">仅正文</MenuItem>
          <MenuItem value="frontmatter">仅 Frontmatter</MenuItem>
          <MenuItem value="both">正文与 Frontmatter 一并保存</MenuItem>
        </TextField>
        <TextField
          select
          fullWidth
          label="自动保存时机"
          value={settings.trigger}
          disabled={disabled || !settings.enabled}
          onChange={(event) =>
            change({ trigger: event.target.value as ArticleAutosaveSettings["trigger"] })
          }
          helperText="离开包括切换文章、返回列表、切换页面及退出登录。"
        >
          <MenuItem value="exit">离开时保存</MenuItem>
          <MenuItem value="interval">定时保存</MenuItem>
          <MenuItem value="both">离开时与定时保存</MenuItem>
        </TextField>
        {settings.trigger !== "exit" && (
          <TextField
            fullWidth
            type="number"
            label="自动保存间隔（秒）"
            disabled={disabled || !settings.enabled}
            value={settings.intervalSeconds}
            onChange={(event) => change({ intervalSeconds: Number(event.target.value) })}
            error={
              !Number.isInteger(settings.intervalSeconds) ||
              settings.intervalSeconds < 15 ||
              settings.intervalSeconds > 3600
            }
            helperText="15—3600 秒，默认 60 秒；仅保存有修改的内容。"
            slotProps={{ htmlInput: { min: 15, max: 3600, step: 1 } }}
          />
        )}
        <Alert severity="info">
          自动保存直接写入文章文件，保存成功前检查字段、语法和磁盘版本；失败时保留编辑内容。
          本地恢复副本由下方“本地草稿”设置独立控制。浏览器关闭或刷新时会尝试保存，并保留未保存内容的离开确认。
        </Alert>
      </Stack>
    </SettingsCard>
  );
}
