import type { ReactNode } from "react";
import { Alert, Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import type { useScopedSettings } from "./useScopedSettings";
import { SettingsModule } from "./SettingsModule";

type ScopedController = ReturnType<typeof useScopedSettings>;
export function ScopedCard({
  title,
  controller,
  children,
}: {
  title: string;
  controller: ScopedController;
  children: ReactNode;
}) {
  return (
    <SettingsModule label={title}>
      <Paper
        variant="outlined"
        component="section"
        aria-label={title}
        sx={{ p: { xs: 2.5, sm: 3 } }}
      >
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="h6" component="h3">
              {title}
            </Typography>
            {controller.dirty && <Chip label="未保存" size="small" color="warning" />}
          </Stack>
          {controller.error && <Alert severity="error">{controller.error}</Alert>}
          {controller.notice && <Alert severity="success">{controller.notice}</Alert>}
          {controller.conflict && (
            <Alert
              severity="warning"
              action={<Button onClick={() => controller.reset()}>重新载入本组</Button>}
            >
              本组设置已变化，当前输入已保留。
            </Alert>
          )}
          <Box
            component="fieldset"
            disabled={!controller.available || controller.readOnly || controller.saving}
            sx={{ p: 0, m: 0, border: 0, minWidth: 0 }}
          >
            {children}
          </Box>
          <Divider />
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="contained"
              disabled={
                !controller.dirty || controller.saving || controller.readOnly || controller.conflict
              }
              onClick={() => void controller.save()}
            >
              保存{title}
            </Button>
            <Button
              disabled={!controller.dirty || controller.saving}
              onClick={() => controller.reset()}
            >
              取消修改
            </Button>
            <Button
              disabled={!controller.available || controller.readOnly || controller.saving}
              onClick={() => controller.reset(true)}
            >
              恢复本组默认
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </SettingsModule>
  );
}
