import type { ReactNode } from "react";
import { Alert, Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import type { PersonalGroup } from "../../shared/panel-settings";
import { usePersonalSettings } from "./PersonalSettingsProvider";
import type { usePersonalDrafts } from "./usePersonalDrafts";

export type SettingsController = ReturnType<typeof usePersonalDrafts>;
export function SettingsCard({
  title,
  group,
  controller,
  children,
}: {
  title: string;
  group: PersonalGroup;
  controller: SettingsController;
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
