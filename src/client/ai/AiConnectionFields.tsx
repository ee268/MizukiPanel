import { Button, MenuItem, Stack, TextField } from "@mui/material";
import type { AiWritingSettings } from "../../shared/ai-writing";
import { aiCredentials } from "./credentials";
import { useAiCredential } from "./useAiCredential";

export function AiConnectionFields({
  settings,
  onChange,
  disabled = false,
}: {
  settings: AiWritingSettings;
  onChange: (fields: Partial<AiWritingSettings>) => void;
  disabled?: boolean;
}) {
  const key = useAiCredential(settings.provider);
  const openai = settings.provider === "openai";
  return (
    <Stack spacing={2}>
      <TextField
        select
        label="AI 服务"
        value={settings.provider}
        disabled={disabled}
        onChange={(event) =>
          onChange({ provider: event.target.value as AiWritingSettings["provider"] })
        }
      >
        <MenuItem value="openai">OpenAI 兼容接口</MenuItem>
        <MenuItem value="anthropic">Anthropic</MenuItem>
      </TextField>
      <TextField
        label={`${openai ? "OpenAI" : "Anthropic"} BaseURL`}
        value={openai ? settings.openaiBaseUrl : settings.anthropicBaseUrl}
        disabled={disabled}
        onChange={(event) =>
          onChange({ [openai ? "openaiBaseUrl" : "anthropicBaseUrl"]: event.target.value })
        }
        helperText="支持服务根地址或 /v1 地址；使用 HTTPS 或本机 HTTP，不在地址中填写密钥。"
      />
      <TextField
        label="模型 ID"
        value={openai ? settings.openaiModel : settings.anthropicModel}
        disabled={disabled}
        onChange={(event) =>
          onChange({ [openai ? "openaiModel" : "anthropicModel"]: event.target.value })
        }
        helperText="填写所选服务支持的模型名称；不同服务的模型分别记忆。"
      />
      <TextField
        label="API Key（本次会话）"
        type="password"
        value={key}
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => aiCredentials.set(settings.provider, event.target.value)}
        slotProps={{ htmlInput: { spellCheck: false, "data-session-private": "true" } }}
        helperText="仅存当前页面内存；刷新、退出或登录失效后清空，不参与保存、备份或导出。"
      />
      <Button
        onClick={() => aiCredentials.set(settings.provider, "")}
        disabled={disabled || !key}
        sx={{ alignSelf: "flex-start" }}
      >
        清除本次密钥
      </Button>
    </Stack>
  );
}
