import { useEffect, useRef, useState } from "react";
import {
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import RemoveOutlined from "@mui/icons-material/RemoveOutlined";
import StarOutlined from "@mui/icons-material/StarOutlined";
import StarBorderOutlined from "@mui/icons-material/StarBorderOutlined";
import { validAiModelId, type AiWritingSettings } from "../../shared/ai-writing";
import { aiModelInputFields, aiModelInputIds, aiModelLimit } from "./model-settings";

interface ModelRow {
  id: number;
  value: string;
  focus?: boolean;
}

export function AiModelFields({
  settings,
  onChange,
  disabled,
}: {
  settings: AiWritingSettings;
  onChange: (fields: Partial<AiWritingSettings>) => void;
  disabled: boolean;
}) {
  const ids = aiModelInputIds(settings);
  const signature = JSON.stringify(ids);
  const expected = useRef(signature);
  const nextId = useRef(0);
  const [rows, setRows] = useState<ModelRow[]>(() =>
    (ids.length ? ids : [""]).map((value) => ({ id: nextId.current++, value })),
  );
  const selected = settings.provider === "openai" ? settings.openaiModel : settings.anthropicModel;
  useEffect(() => {
    if (signature === expected.current) return;
    expected.current = signature;
    const values: string[] = JSON.parse(signature);
    setRows((values.length ? values : [""]).map((value) => ({ id: nextId.current++, value })));
  }, [signature]);

  function update(next: ModelRow[], preferred?: string) {
    if (disabled) return;
    setRows(next);
    const fields = aiModelInputFields(
      settings,
      next.map((row) => row.value),
      preferred,
    );
    expected.current = JSON.stringify(aiModelInputIds({ ...settings, ...fields }));
    onChange(fields);
  }

  return (
    <Stack spacing={1.5}>
      {rows.map((row, index) => {
        const value = row.value.trim();
        const duplicate =
          value && rows.some((other) => other.id !== row.id && other.value.trim() === value);
        const error =
          value && !validAiModelId(value)
            ? "模型 ID 最多 160 个字符，不能包含控制字符或 API Key。"
            : duplicate
              ? "模型 ID 重复，请修改或删除这一行。"
              : "";
        const isDefault = !!value && value === selected;
        return (
          <Stack key={row.id} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <TextField
              label="模型 ID"
              value={row.value}
              disabled={disabled}
              autoFocus={row.focus}
              error={!!error}
              helperText={error || undefined}
              sx={{ flex: 1, minWidth: 0 }}
              onChange={(event) =>
                update(
                  rows.map((other) =>
                    other.id === row.id ? { ...other, value: event.target.value } : other,
                  ),
                  isDefault ? event.target.value : undefined,
                )
              }
              slotProps={{
                input: {
                  endAdornment: value ? (
                    <InputAdornment position="end">
                      <Tooltip title={isDefault ? "默认模型" : "设为默认模型"}>
                        <span>
                          <IconButton
                            size="small"
                            edge="end"
                            type="button"
                            disabled={disabled || !!error}
                            aria-label={isDefault ? `默认模型：${value}` : `设为默认模型：${value}`}
                            aria-pressed={isDefault}
                            color={isDefault ? "primary" : "default"}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() =>
                              onChange({
                                [settings.provider === "openai" ? "openaiModel" : "anthropicModel"]:
                                  value,
                              })
                            }
                          >
                            {isDefault ? (
                              <StarOutlined fontSize="small" />
                            ) : (
                              <StarBorderOutlined fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </InputAdornment>
                  ) : null,
                },
              }}
            />
            <Tooltip title="删除模型输入框">
              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                <IconButton
                  type="button"
                  aria-label={`删除模型输入框 ${index + 1}`}
                  disabled={disabled || (rows.length === 1 && !row.value)}
                  onClick={() =>
                    update(
                      rows.length === 1
                        ? [{ ...row, value: "" }]
                        : rows.filter((other) => other.id !== row.id),
                    )
                  }
                  sx={{ width: 40, height: 40, border: 1, borderColor: "divider", borderRadius: 1 }}
                >
                  <RemoveOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {index === rows.length - 1 && (
              <Tooltip title="新增模型输入框">
                <span style={{ display: "inline-flex", flexShrink: 0 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    aria-label="新增模型输入框"
                    disabled={disabled || rows.length >= aiModelLimit}
                    onClick={() =>
                      setRows([...rows, { id: nextId.current++, value: "", focus: true }])
                    }
                    sx={{ width: 40, height: 40, minWidth: 40, p: 0 }}
                  >
                    <AddOutlined fontSize="small" />
                  </Button>
                </span>
              </Tooltip>
            )}
          </Stack>
        );
      })}
      <Typography variant="caption" color="text.secondary" sx={{ px: 1.75 }}>
        每个输入框填写一个模型 ID；加号新增输入框，星标设置默认模型，最多 100 个。
      </Typography>
    </Stack>
  );
}
