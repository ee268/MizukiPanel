import { FormControl, MenuItem, Select } from "@mui/material";

export type ArticleBodyMode = "visual" | "source";

interface ArticleModeSelectProps {
  mode: ArticleBodyMode;
  canUseVisual?: boolean;
  onChange: (mode: ArticleBodyMode) => void;
}

export function ArticleModeSelect({ mode, canUseVisual = true, onChange }: ArticleModeSelectProps) {
  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <Select
        value={mode}
        aria-label="编辑模式"
        onChange={(event) => onChange(event.target.value as ArticleBodyMode)}
      >
        <MenuItem value="visual" disabled={!canUseVisual}>
          可视化模式
        </MenuItem>
        <MenuItem value="source">源码模式</MenuItem>
      </Select>
    </FormControl>
  );
}
