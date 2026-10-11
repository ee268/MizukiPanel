import { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { settingsSections } from "../settings/sections";
import { useSettingsController } from "../settings/useSettingsController";
import { useSettingsLeave } from "../settings/useSettingsLeave";
import { SettingsSections } from "../settings/SettingsSections";
import { ContentLoading } from "../components/ContentLoading";

export default function SettingsPage() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [params, setParams] = useSearchParams();
  const selected = params.get("section");
  const sectionId = settingsSections.some((item) => item.id === selected)
    ? selected!
    : "appearance";
  const [visited, setVisited] = useState(() => new Set([sectionId]));
  useEffect(() => {
    setVisited((current) => (current.has(sectionId) ? current : new Set([...current, sectionId])));
  }, [sectionId]);
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    // Browser history may restore the previous offset after the navigation event.
    const frame = window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "instant" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [sectionId]);
  const state = useSettingsController();
  const leave = useSettingsLeave(state);
  const { warnings, preferences, serverError, loading, overview, controller, reloadSettings } =
    state;
  const [recoverOpen, setRecoverOpen] = useState(false);
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box data-page-motion="heading">
          <Typography variant="h4" component="h1">
            设置
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            管理 MizukiPanel 的显示、编辑与工作区偏好。
          </Typography>
        </Box>
        {warnings.map((warning) => (
          <Alert key={warning} severity="warning">
            {warning}
          </Alert>
        ))}
        {preferences.error && <Alert severity="error">{preferences.error}</Alert>}
        {preferences.snapshot.readOnly && preferences.snapshot.document.schemaVersion <= 1 && (
          <Alert
            severity="warning"
            action={<Button onClick={() => setRecoverOpen(true)}>恢复默认</Button>}
          >
            浏览器设置已暂停写入。恢复前会保留损坏数据副本。
          </Alert>
        )}
        {serverError && (
          <Alert severity="warning" action={<Button onClick={() => reloadSettings()}>重试</Button>}>
            本机/项目设置暂不可读取：{serverError}。仍可调整浏览器外观。
          </Alert>
        )}
        {loading && !overview ? (
          <ContentLoading
            heading="正在展开设置"
            description="正在读取偏好并准备设置分类"
            kind="settings"
          />
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "220px minmax(0, 1fr)" },
              gap: 3,
              alignItems: "start",
            }}
          >
            <Paper
              data-page-motion="navigation"
              variant="outlined"
              sx={{
                minWidth: 0,
                p: 1,
                position: { md: "sticky" },
                top: { md: "calc(var(--mizuki-panel-header-height, 64px) + 24px)" },
              }}
            >
              <Tabs
                value={sectionId}
                onChange={(_, value: string) => {
                  const next = new URLSearchParams(params);
                  next.set("section", value);
                  setParams(next);
                }}
                orientation={desktop ? "vertical" : "horizontal"}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                aria-label="设置分类"
                sx={{ "& .MuiTab-root": { minHeight: 52, justifyContent: "flex-start", px: 2 } }}
              >
                {settingsSections.map((item) => (
                  <Tab
                    key={item.id}
                    value={item.id}
                    id={`settings-tab-${item.id}`}
                    aria-controls={`settings-panel-${item.id}`}
                    icon={item.icon}
                    iconPosition="start"
                    label={item.title}
                  />
                ))}
              </Tabs>
            </Paper>
            <SettingsSections sectionId={sectionId} visited={visited} state={state} />
          </Box>
        )}
      </Stack>
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={Boolean(controller.notice)}
        autoHideDuration={preferences.effective.notifications.duration}
        message={controller.notice}
        onClose={controller.clearNotice}
      />
      <Dialog open={leave.open} onClose={leave.cancelLeave} aria-labelledby="settings-leave-title">
        <DialogTitle id="settings-leave-title">设置尚未保存</DialogTitle>
        <DialogContent>
          <Typography>保存修改后离开，或放弃本次修改。继续编辑会保留当前输入。</Typography>
          {leave.leaveError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {leave.leaveError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap" }}>
          <Button onClick={leave.cancelLeave} disabled={leave.saving}>
            继续编辑
          </Button>
          <Button onClick={leave.discardAndLeave} disabled={leave.saving}>
            放弃修改
          </Button>
          <Button
            variant="contained"
            onClick={() => void leave.saveAndLeave()}
            disabled={leave.saveDisabled}
          >
            保存并离开
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={recoverOpen}
        onClose={() => setRecoverOpen(false)}
        aria-labelledby="settings-recover-title"
      >
        <DialogTitle id="settings-recover-title">恢复浏览器默认设置</DialogTitle>
        <DialogContent>
          将保存原数据副本并重置当前浏览器的外观、导航、操作提示、编辑器与草稿保存偏好。文章、本地恢复副本和项目模板不受影响。
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecoverOpen(false)}>取消</Button>
          <Button
            onClick={() => {
              void preferences
                .recover()
                .then(() => {
                  controller.cancelAll();
                  setRecoverOpen(false);
                })
                .catch(() => {});
            }}
          >
            恢复默认设置
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
