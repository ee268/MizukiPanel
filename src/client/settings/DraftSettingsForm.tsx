import { FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import { SettingsCard, type SettingsController } from "./SettingsCard";
import { usePersonalSettings } from "./PersonalSettingsProvider";
export function DraftSettingsForm({ controller }: { controller: SettingsController }) {
  const { snapshot } = usePersonalSettings();
  const disabled = snapshot.readOnly || controller.saving;
  const value = controller.drafts.drafts.value;
  return (
    <SettingsCard title="本地草稿" group="drafts" controller={controller}>
      <Stack spacing={3}>
        <FormControlLabel
          label="自动保存本地恢复副本"
          control={
            <Switch
              disabled={disabled}
              checked={value.enabled}
              onChange={(_, enabled) => controller.change("drafts", { enabled })}
            />
          }
        />
        <TextField
          label="草稿保存延迟（秒）"
          type="number"
          disabled={disabled || !value.enabled}
          value={value.delay / 1000}
          onChange={(event) =>
            controller.change("drafts", { delay: Number(event.target.value) * 1000 })
          }
          error={value.delay < 1000 || value.delay > 10000 || !Number.isInteger(value.delay)}
          helperText="停止输入 1—10 秒后保存，默认 2 秒；保存设置后生效。"
          slotProps={{ htmlInput: { min: 1, max: 10, step: 1 } }}
        />
        <Typography variant="body2" color="text.secondary">
          恢复副本保存在当前浏览器，不写入文章。关闭后停止新增，已有草稿仍保留；临时教程和只读查看不生成草稿。手动保存与未保存提醒继续有效。
        </Typography>
      </Stack>
    </SettingsCard>
  );
}
