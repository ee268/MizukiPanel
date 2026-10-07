import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import PaletteOutlined from "@mui/icons-material/PaletteOutlined";
import {
  Box,
  Button,
  IconButton,
  Popover,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { hueColor, usePanelTheme, type PanelColorMode } from "../theme";

const colorModes: Array<{ value: PanelColorMode; label: string }> = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

const previewVariables = [
  "--mui-palette-primary-main",
  "--mui-palette-primary-dark",
  "--mui-palette-secondary-main",
  "--mui-palette-secondary-dark",
] as const;

function applyHuePreview(hue: number) {
  const secondaryHue = (hue + 125) % 360;
  const colors = [
    hueColor(hue, 48),
    hueColor(hue, 40),
    hueColor(secondaryHue, 42),
    hueColor(secondaryHue, 34),
  ];
  previewVariables.forEach((variable, index) => {
    document.documentElement.style.setProperty(variable, colors[index]);
  });
}

function clearHuePreview() {
  previewVariables.forEach((variable) => {
    document.documentElement.style.removeProperty(variable);
  });
}

export default function ThemeSettings() {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const { hue, mode, resolvedMode, setHue, setMode, reset } = usePanelTheme();
  const [dragHue, setDragHue] = useState<number | null>(null);
  const previewFrame = useRef<number | null>(null);
  const pendingHue = useRef(hue);

  useLayoutEffect(() => {
    if (dragHue === null) {
      clearHuePreview();
    }
  }, [hue, resolvedMode, dragHue]);

  useEffect(() => {
    return () => {
      if (previewFrame.current !== null) cancelAnimationFrame(previewFrame.current);
      clearHuePreview();
    };
  }, []);

  function previewHue(value: number) {
    pendingHue.current = value;
    setDragHue(value);
    if (previewFrame.current !== null) return;
    previewFrame.current = requestAnimationFrame(() => {
      previewFrame.current = null;
      applyHuePreview(pendingHue.current);
    });
  }

  function commitHue(value: number) {
    if (previewFrame.current !== null) {
      cancelAnimationFrame(previewFrame.current);
      previewFrame.current = null;
    }
    setHue(value);
    setDragHue(null);
  }

  function openSettings(event: MouseEvent<HTMLElement>) {
    setAnchorElement(event.currentTarget);
  }

  function closeSettings() {
    if (dragHue !== null) commitHue(dragHue);
    setAnchorElement(null);
  }

  return (
    <>
      <IconButton
        aria-label="面板主题设置"
        title="面板主题设置"
        aria-haspopup="true"
        aria-expanded={Boolean(anchorElement)}
        onClick={openSettings}
      >
        <PaletteOutlined />
      </IconButton>
      <Popover
        open={Boolean(anchorElement)}
        anchorEl={anchorElement}
        onClose={closeSettings}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: { width: 340, maxWidth: "calc(100vw - 24px)", p: 2.5, mt: 1 },
          },
        }}
      >
        <Stack spacing={3}>
          <Typography variant="h6">面板主题</Typography>
          <Box>
            <Typography gutterBottom>显示模式</Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={mode}
              onChange={(_, value: PanelColorMode | null) => {
                if (!value) return;
                if (dragHue !== null) commitHue(dragHue);
                setMode(value);
              }}
            >
              {colorModes.map((item) => (
                <ToggleButton key={item.value} value={item.value}>
                  {item.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <Box>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
              <Typography>主题色相</Typography>
              <Typography variant="body2" color="text.secondary">
                {dragHue ?? hue}°
              </Typography>
            </Stack>
            <Slider
              value={dragHue ?? hue}
              min={0}
              max={360}
              step={1}
              onChange={(_, value) => previewHue(value as number)}
              onChangeCommitted={(_, value) => commitHue(value as number)}
              aria-label="主题色相"
            />
            <Box
              sx={{
                height: 36,
                borderRadius: 2,
                background: `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, index) => hueColor(index * 30)).join(", ")})`,
              }}
            />
          </Box>
          <Button
            onClick={() => {
              if (previewFrame.current !== null) {
                cancelAnimationFrame(previewFrame.current);
                previewFrame.current = null;
              }
              setDragHue(null);
              reset();
            }}
            sx={{ alignSelf: "flex-start" }}
          >
            恢复默认
          </Button>
        </Stack>
      </Popover>
    </>
  );
}
