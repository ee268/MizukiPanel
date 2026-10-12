import { Stack, TextField, Typography } from "@mui/material";
import type { SettingsController } from "./SettingsCard";
import { SettingsCard } from "./SettingsCard";
import { AiConnectionFields } from "../ai/AiConnectionFields";
import { usePersonalSettings } from "./PersonalSettingsProvider";

export function AiWritingSettingsForm({ controller }: { controller: SettingsController }) {
  const preferences = usePersonalSettings();
  const settings = controller.drafts.ai.value;
  const disabled = preferences.snapshot.readOnly || controller.saving;
  return (
    <SettingsCard title="AI 辅助写作" group="ai" controller={controller}>
      <Stack spacing={3}>
        <AiConnectionFields
          settings={settings}
          onChange={(fields) => controller.change("ai", fields)}
          disabled={disabled}
        />
        <TextField
          label="自定义系统提示词"
          multiline
          minRows={5}
          maxRows={12}
          value={settings.systemPrompt}
          disabled={disabled}
          onChange={(event) => controller.change("ai", { systemPrompt: event.target.value })}
          helperText="每次写作请求都会使用此提示词；不在提示词中填写 API Key。最多 8000 字符。"
        />
        <TextField
          label="最大输出 Token 数"
          type="number"
          value={settings.maxTokens}
          disabled={disabled}
          onChange={(event) => controller.change("ai", { maxTokens: Number(event.target.value) })}
          slotProps={{ htmlInput: { min: 256, max: 16384, step: 256 } }}
          helperText="256—16384；实际支持的额度取决于模型。"
        />
        <Typography variant="body2" color="text.secondary">
          保存只记忆服务、BaseURL、模型和写作偏好。正文仅在点击生成时发送给所选服务；采用建议后仍需保存文章。
        </Typography>
      </Stack>
    </SettingsCard>
  );
}
