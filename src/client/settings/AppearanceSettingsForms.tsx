import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { PersonalGroup } from "../../shared/panel-settings";
import { usePersonalSettings } from "./PersonalSettingsProvider";
import { ThemeControls } from "./ThemeControls";
import type { usePersonalDrafts } from "./usePersonalDrafts";

type Controller = ReturnType<typeof usePersonalDrafts>;
function SettingsCard({
  title,
  group,
  controller,
  children,
}: {
  title: string;
  group: PersonalGroup;
  controller: Controller;
  children: ReactNode;
}) {
  const { snapshot } = usePersonalSettings();
  const conflict = controller.isConflict(group);
  return (
    <Paper variant="outlined" component="section" aria-label={title} sx={{ p: { xs: 2.5, sm: 3 } }}>
      <Stack spacing={3}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
        >
          <Typography variant="h6" component="h3">
            {title}
          </Typography>
          <Chip size="small" label="当前浏览器" />
          {controller.isDirty(group) && <Chip size="small" label="未保存" color="warning" />}
        </Stack>
        {conflict && (
          <Alert
            severity="warning"
            action={<Button onClick={() => controller.reset(group)}>重新载入</Button>}
          >
            本组已在其他位置（其他标签页、快捷入口或导航操作）修改。草稿已保留，请重新载入后保存。
          </Alert>
        )}
        {controller.drafts[group].error && (
          <Alert severity="error">{controller.drafts[group].error}</Alert>
        )}
        <Box
          component="fieldset"
          disabled={snapshot.readOnly || controller.saving}
          sx={{ p: 0, m: 0, border: 0, minWidth: 0 }}
        >
          {children}
        </Box>
        <Divider />
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          <Button
            variant="contained"
            disabled={
              !controller.isDirty(group) || snapshot.readOnly || controller.saving || conflict
            }
            onClick={() => void controller.save([group])}
          >
            保存{title}
          </Button>
          <Button
            disabled={!controller.isDirty(group) || controller.saving}
            onClick={() => controller.reset(group)}
          >
            取消修改
          </Button>
          <Button
            disabled={snapshot.readOnly || controller.saving}
            onClick={() => controller.reset(group, true)}
          >
            恢复本组默认
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
export function AppearanceSettingsForms({ controller }: { controller: Controller }) {
  const { appearance, navigation, notifications } = controller.drafts;
  const preferences = usePersonalSettings();
  const disabled = preferences.snapshot.readOnly || controller.saving;
  const [fontsLoaded, setFontsLoaded] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([
      document.fonts.load('500 14px "MizukiPanelBody"'),
      document.fonts.load('400 14px "MizukiPanelCjk"'),
    ])
      .then((fonts) => {
        if (active) setFontsLoaded(fonts.every((loaded) => loaded.length > 0));
      })
      .catch(() => {
        if (active) setFontsLoaded(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h2">
          外观与导航
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          这些偏好保存在当前浏览器中，可独立保存各组修改。
        </Typography>
      </Box>
      <SettingsCard title="外观" group="appearance" controller={controller}>
        <Stack spacing={3}>
          <ThemeControls
            value={appearance.value}
            onChange={(fields) => controller.change("appearance", fields)}
            disabled={preferences.snapshot.readOnly || controller.saving}
          />
          <TextField
            select
            fullWidth
            label="界面字体"
            disabled={disabled}
            value={appearance.value.font}
            onChange={(event) =>
              controller.change("appearance", { font: event.target.value as "panel" | "system" })
            }
            helperText={
              appearance.value.font === "system"
                ? "使用系统字体，同时应用到文章正文和行内代码；代码块保留等宽字体。"
                : fontsLoaded === false
                  ? "内置字体未能加载，当前已回退系统字体。"
                  : "界面使用面板内置字体；文章正文沿用当前项目字体。"
            }
          >
            <MenuItem value="panel">面板内置字体</MenuItem>
            <MenuItem value="system">系统字体</MenuItem>
          </TextField>
          <TextField
            fullWidth
            type="number"
            label="界面基准字号"
            disabled={disabled}
            value={appearance.value.fontSize}
            onChange={(event) =>
              controller.change("appearance", { fontSize: Number(event.target.value) })
            }
            error={
              appearance.value.fontSize < 12 ||
              appearance.value.fontSize > 20 ||
              !Number.isInteger(appearance.value.fontSize)
            }
            helperText="12—20px；标题与正文按主题比例缩放，按钮触控尺寸保持不变。"
            slotProps={{ htmlInput: { min: 12, max: 20, step: 1 } }}
          />
          <Typography variant="body2" color="text.secondary">
            外观修改可即时预览，保存后保留；取消修改会恢复已保存外观。
          </Typography>
        </Stack>
      </SettingsCard>
      <SettingsCard title="导航" group="navigation" controller={controller}>
        <Stack spacing={3}>
          <TextField
            select
            fullWidth
            label="默认侧栏状态"
            disabled={disabled}
            value={navigation.value.sidebar}
            onChange={(event) =>
              controller.change("navigation", {
                sidebar: event.target.value as typeof navigation.value.sidebar,
              })
            }
            helperText="下次加载面板时应用；移动端始终使用抽屉导航。"
          >
            <MenuItem value="collapsed">折叠</MenuItem>
            <MenuItem value="expanded">展开</MenuItem>
            <MenuItem value="remember">记住上次状态</MenuItem>
          </TextField>
          <FormControlLabel
            control={
              <Switch
                disabled={disabled}
                checked={navigation.value.backToTop}
                onChange={(_, checked) => controller.change("navigation", { backToTop: checked })}
              />
            }
            label="显示返回顶部按钮"
          />
          <TextField
            fullWidth
            type="number"
            label="返回顶部显示阈值"
            value={navigation.value.backToTopThreshold}
            disabled={disabled || !navigation.value.backToTop}
            onChange={(event) =>
              controller.change("navigation", { backToTopThreshold: Number(event.target.value) })
            }
            error={
              navigation.value.backToTopThreshold < 100 ||
              navigation.value.backToTopThreshold > 1000 ||
              !Number.isInteger(navigation.value.backToTopThreshold)
            }
            helperText="向下滚动超过该距离后显示，范围 100—1000px；也适用于全屏编辑器。"
            slotProps={{ htmlInput: { min: 100, max: 1000, step: 10 } }}
          />
        </Stack>
      </SettingsCard>
      <SettingsCard title="操作提示" group="notifications" controller={controller}>
        <TextField
          fullWidth
          type="number"
          label="操作提示显示时长"
          disabled={disabled}
          value={notifications.value.duration}
          onChange={(event) =>
            controller.change("notifications", { duration: Number(event.target.value) })
          }
          error={
            notifications.value.duration < 2000 ||
            notifications.value.duration > 10000 ||
            !Number.isInteger(notifications.value.duration)
          }
          helperText="2000—10000ms，保存后用于新的成功和信息提示；错误提示仍由用户关闭。"
          slotProps={{ htmlInput: { min: 2000, max: 10000, step: 500 } }}
        />
      </SettingsCard>
    </Stack>
  );
}
