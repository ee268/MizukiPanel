import { Alert, Autocomplete, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { configuredAiModels, type AiWritingSettings } from "../../shared/ai-writing";
import { useAiModels } from "./useAiModels";
import { aiCredentials } from "./credentials";
import { useAiCredential } from "./useAiCredential";

export function AiConnectionFields({
  settings,
  onChange,
  disabled = false,
  manageModels = false,
}: {
  settings: AiWritingSettings;
  onChange: (fields: Partial<AiWritingSettings>) => void;
  disabled?: boolean;
  manageModels?: boolean;
}) {
  const key = useAiCredential(settings.provider);
  const openai = settings.provider === "openai";
  const upstream = useAiModels(settings);
  const options = [
    ...new Set([...configuredAiModels(settings), ...upstream.models.map((model) => model.id)]),
  ];
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
      <Autocomplete
        freeSolo
        options={options}
        value={(openai ? settings.openaiModel : settings.anthropicModel) || null}
        disabled={disabled}
        onChange={(_, value) =>
          onChange({ [openai ? "openaiModel" : "anthropicModel"]: value ?? "" })
        }
        onInputChange={(_, value, reason) => {
          if (reason === "input") onChange({ [openai ? "openaiModel" : "anthropicModel"]: value });
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="模型 ID"
            helperText="选择或输入模型；两家服务分别记忆，当前会话可随时切换。"
          />
        )}
      />
      <Button
        loading={upstream.loading}
        disabled={disabled || !key}
        onClick={() => void upstream.fetchModels()}
        sx={{ alignSelf: "flex-start" }}
      >
        从上游获取模型列表
      </Button>
      {upstream.error && <Alert severity="warning">{upstream.error}</Alert>}
      {upstream.models.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          已获取 {upstream.models.length} 个模型，可在模型输入框中搜索选择。
        </Typography>
      )}
      {manageModels && (
        <Autocomplete
          multiple
          freeSolo
          filterSelectedOptions
          options={options}
          value={openai ? settings.openaiModels : settings.anthropicModels}
          disabled={disabled}
          onChange={(_, value) =>
            onChange({
              [openai ? "openaiModels" : "anthropicModels"]: [
                ...new Set(value.map((item) => item.trim()).filter(Boolean)),
              ],
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="可切换模型"
              helperText="输入模型 ID 后按 Enter 添加，或选择上游模型；最多 100 个。保存后在写作面板中切换。"
            />
          )}
        />
      )}
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
