import { useState } from "react";
import PaletteOutlined from "@mui/icons-material/PaletteOutlined";
import { Alert, Button, IconButton, Popover, Stack, Typography } from "@mui/material";
import { ThemeControls } from "../settings/ThemeControls";
import { defaultPanelTheme } from "../theme";
import { usePersonalSettings } from "../settings/PersonalSettingsProvider";

export default function ThemeSettings() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const settings = usePersonalSettings();
  return (
    <>
      <IconButton
        aria-label="面板主题设置"
        title="面板主题设置"
        aria-haspopup="true"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <PaletteOutlined />
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 340, maxWidth: "calc(100vw - 24px)", p: 2.5, mt: 1 } } }}
      >
        <Stack spacing={3}>
          <Typography variant="h6">面板主题</Typography>
          {(settings.error || settings.snapshot.warnings[0]) && (
            <Alert severity="warning">{settings.error || settings.snapshot.warnings[0]}</Alert>
          )}
          <ThemeControls
            value={settings.saved.appearance}
            onChange={settings.quickAppearance}
            disabled={settings.snapshot.readOnly}
          />
          <Button
            disabled={settings.snapshot.readOnly}
            onClick={() => settings.quickAppearance(defaultPanelTheme)}
            sx={{ alignSelf: "flex-start" }}
          >
            恢复默认主题
          </Button>
        </Stack>
      </Popover>
    </>
  );
}
