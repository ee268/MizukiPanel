import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Slider, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { AppearanceSettings } from "../../shared/panel-settings";
import { hueColor } from "../theme";
const variables = [
  "--mui-palette-primary-main",
  "--mui-palette-primary-dark",
  "--mui-palette-secondary-main",
  "--mui-palette-secondary-dark",
];
function clearPreview() {
  variables.forEach((key) => document.documentElement.style.removeProperty(key));
}
export function ThemeControls({
  value,
  onChange,
  disabled = false,
}: {
  value: Pick<AppearanceSettings, "hue" | "mode">;
  onChange: (fields: Partial<Pick<AppearanceSettings, "hue" | "mode">>) => void;
  disabled?: boolean;
}) {
  const [dragHue, setDragHue] = useState<number | null>(null);
  const frame = useRef<number | null>(null);
  const pendingHue = useRef(value.hue);
  useLayoutEffect(() => {
    if (dragHue === null) clearPreview();
  }, [value.hue, value.mode, dragHue]);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      clearPreview();
    },
    [],
  );
  function commit(hue: number) {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setDragHue(null);
    clearPreview();
    onChange({ hue });
  }
  return (
    <Stack spacing={3}>
      <Box>
        <Typography gutterBottom>显示模式</Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={value.mode}
          disabled={disabled}
          aria-label="显示模式"
          onChange={(_, mode: AppearanceSettings["mode"] | null) => {
            if (mode) {
              if (dragHue !== null) commit(dragHue);
              onChange({ mode });
            }
          }}
        >
          <ToggleButton value="light">浅色</ToggleButton>
          <ToggleButton value="dark">深色</ToggleButton>
          <ToggleButton value="system">跟随系统</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box>
        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
          <Typography>主题色相</Typography>
          <Typography color="text.secondary">{dragHue ?? value.hue}°</Typography>
        </Stack>
        <Slider
          aria-label="主题色相"
          disabled={disabled}
          value={dragHue ?? value.hue}
          min={0}
          max={360}
          step={1}
          onChange={(_, next) => {
            pendingHue.current = next as number;
            setDragHue(next as number);
            if (frame.current !== null) return;
            frame.current = requestAnimationFrame(() => {
              frame.current = null;
              const hue = pendingHue.current;
              const colors = [
                hueColor(hue, 48),
                hueColor(hue, 40),
                hueColor((hue + 125) % 360, 42),
                hueColor((hue + 125) % 360, 34),
              ];
              variables.forEach((key, index) =>
                document.documentElement.style.setProperty(key, colors[index]),
              );
            });
          }}
          onChangeCommitted={(_, next) => commit(next as number)}
        />
        <Box
          sx={{
            height: 24,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, index) => hueColor(index * 30)).join(", ")})`,
          }}
        />
      </Box>
    </Stack>
  );
}
