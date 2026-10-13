import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import BackupOutlined from "@mui/icons-material/BackupOutlined";
import { useAiVaultState } from "../ai/useAiCredential";
import { api, json } from "../api";
import type { SettingsController } from "./SettingsCard";
import { SettingsCard } from "./SettingsCard";
import { AiConnectionFields } from "../ai/AiConnectionFields";
import { usePersonalSettings } from "./PersonalSettingsProvider";

export function AiWritingSettingsForm({ controller }: { controller: SettingsController }) {
  const preferences = usePersonalSettings();
  const vault = useAiVaultState();
  const [backingUp, setBackingUp] = useState(false);
  const [backupNotice, setBackupNotice] = useState("");
  const [backupError, setBackupError] = useState("");
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
          配置和密钥加密保存到
          .local/secure，重启或更换浏览器后登录即可恢复。修改保存前自动备份，也可手动创建加密备份，在“备份与维护”的备份管理中恢复。密钥不包含在普通偏好导出中；加密备份需使用保存时的
          Windows 账户恢复。对话仅保留在当前页面内存中。
        </Typography>
        <Button
          startIcon={<BackupOutlined />}
          loading={backingUp}
          disabled={disabled || controller.isDirty("ai") || !vault.status().version}
          sx={{ alignSelf: "flex-start" }}
          onClick={() => {
            setBackingUp(true);
            setBackupNotice("");
            setBackupError("");
            void api<{ message: string }>("/api/ai/credentials/backup", json("POST"))
              .then((result) => setBackupNotice(result.message))
              .catch((cause: Error) => setBackupError(cause.message))
              .finally(() => setBackingUp(false));
          }}
        >
          创建加密备份
        </Button>
        {backupNotice && <Alert severity="success">{backupNotice}</Alert>}
        {backupError && <Alert severity="error">{backupError}</Alert>}
      </Stack>
    </SettingsCard>
  );
}
