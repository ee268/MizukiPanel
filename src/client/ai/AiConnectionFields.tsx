import { useRef } from "react";
import {
  Alert,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import ClearOutlined from "@mui/icons-material/ClearOutlined";
import {
  configuredAiModels,
  defaultAiBaseUrls,
  type AiWritingSettings,
} from "../../shared/ai-writing";
import { useAiModels } from "./useAiModels";
import { aiCredentials } from "./credentials";
import { useAiCredential, useAiVaultState } from "./useAiCredential";
import { aiModelListFields } from "./model-settings";
import { AiModelFields } from "./AiModelFields";

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
  const vault = useAiVaultState();
  const openai = settings.provider === "openai";
  const upstream = useAiModels(settings);
  const latest = useRef({ settings, onChange, disabled, key });
  latest.current = { settings, onChange, disabled, key };
  async function fetchModels() {
    const source = latest.current;
    const result = await upstream.fetchModels();
    const current = latest.current;
    if (
      !result?.length ||
      current.disabled ||
      current.settings.provider !== source.settings.provider ||
      current.settings.openaiBaseUrl !== source.settings.openaiBaseUrl ||
      current.settings.anthropicBaseUrl !== source.settings.anthropicBaseUrl ||
      current.key !== source.key
    )
      return;
    current.onChange(
      aiModelListFields(current.settings, [
        ...configuredAiModels(current.settings),
        ...result.map((model) => model.id),
      ]),
    );
  }

  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="body2">AI 服务</Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={settings.provider}
          disabled={disabled}
          aria-label="AI 服务"
          onChange={(_, provider: AiWritingSettings["provider"] | null) => {
            if (!provider) return;
            onChange({ provider });
          }}
        >
          <ToggleButton value="openai" sx={{ textTransform: "none" }}>
            OpenAI
          </ToggleButton>
          <ToggleButton value="anthropic" sx={{ textTransform: "none" }}>
            Anthropic
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <TextField
        label={`${openai ? "OpenAI" : "Anthropic"} BaseURL`}
        value={openai ? settings.openaiBaseUrl : settings.anthropicBaseUrl}
        placeholder={defaultAiBaseUrls[settings.provider]}
        slotProps={{ inputLabel: { shrink: true } }}
        disabled={disabled}
        onChange={(event) =>
          onChange({ [openai ? "openaiBaseUrl" : "anthropicBaseUrl"]: event.target.value })
        }
        helperText="留空使用官方默认地址；自定义地址支持 HTTPS 或本机 HTTP，不在地址中填写密钥。"
      />
      <TextField
        label="API Key"
        placeholder={
          vault.saved(settings.provider)
            ? "已加密保存；输入新密钥可替换"
            : "填写 API Key，保存后本机加密存储"
        }
        type="password"
        value={key}
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => aiCredentials.set(settings.provider, event.target.value)}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { spellCheck: false, "data-session-private": "true" },
          input: {
            endAdornment:
              key || vault.saved(settings.provider) ? (
                <InputAdornment position="end">
                  <Tooltip title="清空 API Key">
                    <span>
                      <IconButton
                        type="button"
                        size="small"
                        edge="end"
                        aria-label="清空 API Key"
                        disabled={disabled}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => aiCredentials.set(settings.provider, "")}
                      >
                        <ClearOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </InputAdornment>
              ) : null,
          },
        }}
        helperText={
          vault.dirty()
            ? "密钥修改尚未保存；点击下方保存按钮后加密保存，清空后保存将删除已存密钥。"
            : "密钥使用 Windows 账户加密保存到 .local；备份同样为密文，不包含在普通偏好导出中。"
        }
      />
      <AiModelFields
        key={settings.provider}
        settings={settings}
        onChange={onChange}
        disabled={disabled}
      />
      <Button
        loading={upstream.loading}
        disabled={disabled || !vault.available(settings.provider)}
        onClick={() => void fetchModels()}
        sx={{ alignSelf: "flex-start" }}
      >
        从上游获取模型列表
      </Button>
      {upstream.error && <Alert severity="warning">{upstream.error}</Alert>}
      {upstream.models.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          已获取 {upstream.models.length} 个模型，已自动填入模型 ID 输入框并去重；每家服务最多保留
          100 个。
        </Typography>
      )}
    </Stack>
  );
}
