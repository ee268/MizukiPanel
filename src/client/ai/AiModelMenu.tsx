import { useState } from "react";
import { Button, Menu, MenuItem, Tooltip, Typography } from "@mui/material";
import SwapHoriz from "@mui/icons-material/SwapHoriz";
import { configuredAiModels, type AiWritingSettings } from "../../shared/ai-writing";
export function AiModelMenu({
  settings,
  disabled,
  onChange,
}: {
  settings: AiWritingSettings;
  disabled: boolean;
  onChange: (fields: Partial<AiWritingSettings>) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const models = configuredAiModels(settings);
  const model = settings.provider === "openai" ? settings.openaiModel : settings.anthropicModel;
  return (
    <>
      <Tooltip title={model ? `切换模型 · ${model}` : "请先在设置页配置模型"}>
        <span>
          <Button
            size="small"
            aria-label="切换 AI 模型"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            disabled={disabled || !models.length}
            startIcon={<SwapHoriz />}
            onClick={(event) => setAnchor(event.currentTarget)}
            sx={{ minWidth: 0, maxWidth: 120 }}
          >
            <Typography component="span" variant="caption" noWrap>
              {model || "模型"}
            </Typography>
          </Button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{ paper: { sx: { maxWidth: "calc(100vw - 32px)", maxHeight: 320 } } }}
      >
        {models.map((id) => (
          <MenuItem
            key={id}
            selected={id === model}
            onClick={() => {
              onChange(
                settings.provider === "openai" ? { openaiModel: id } : { anthropicModel: id },
              );
              setAnchor(null);
            }}
          >
            <Typography variant="body2" noWrap title={id}>
              {id}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
