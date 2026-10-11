import { Suspense, useState } from "react";
import { Alert, Box, Button, useMediaQuery, useTheme } from "@mui/material";
import { RouteLoading } from "../components/RouteLoading";
import { Outlet } from "react-router-dom";
import { api } from "../api";
import { sessionLifecycle } from "../auth/session-lifecycle";
import { useSiteIdentity } from "../hooks/useSiteIdentity";
import AppHeader from "./AppHeader";
import Sidebar from "./Sidebar";
import { PageEntrance } from "./PageEntrance";
import { usePersonalSettings } from "../settings/PersonalSettingsProvider";
import {
  WorkspaceSessionProvider,
  useWorkspaceSession,
} from "../workspace/WorkspaceSessionProvider";

const drawerWidth = 248;
const collapsedDrawerWidth = 72;

export default function AppShell() {
  return (
    <WorkspaceSessionProvider>
      <Shell />
    </WorkspaceSessionProvider>
  );
}
function Shell() {
  const workspace = useWorkspaceSession();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const preferences = usePersonalSettings();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    const settings = preferences.saved.navigation;
    return settings.sidebar === "remember"
      ? settings.lastCollapsed
      : settings.sidebar !== "expanded";
  });
  const identity = useSiteIdentity();
  const compact = desktop && collapsed;
  const effectiveDrawerWidth = compact ? collapsedDrawerWidth : drawerWidth;

  async function logout() {
    await sessionLifecycle.end("logout", "即将退出登录。", undefined, async () => {
      try {
        await api("/api/auth/logout", { method: "POST" });
      } catch (error) {
        if (!(error instanceof Error && "status" in error && error.status === 401)) throw error;
      }
    });
  }

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        "--mizuki-panel-header-height": { xs: "57px", sm: "65px" },
        "@media (prefers-reduced-motion: reduce)": {
          "& .MuiAppBar-root": { transition: "none" },
        },
        [`@media (max-width: ${theme.breakpoints.values.sm - 0.05}px) and (orientation: landscape)`]:
          {
            "--mizuki-panel-header-height": "49px",
          },
      }}
    >
      <AppHeader
        drawerWidth={effectiveDrawerWidth}
        identity={identity}
        onOpenMenu={() => setOpen(true)}
        onLogout={logout}
      />
      <Sidebar
        desktop={desktop}
        open={open}
        compact={compact}
        width={effectiveDrawerWidth}
        onClose={() => setOpen(false)}
        onToggleCollapsed={() => {
          const next = !collapsed;
          setCollapsed(next);
          if (preferences.saved.navigation.sidebar === "remember")
            preferences.rememberSidebar(next);
        }}
      />
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, pt: 8, ml: { md: 0 } }}>
        {workspace.error && (
          <Alert
            severity="warning"
            sx={{ mx: 3, mt: 2 }}
            action={<Button onClick={() => void workspace.refresh().catch(() => {})}>重试</Button>}
          >
            工作区状态读取失败：{workspace.error}。仍可调整浏览器偏好。
          </Alert>
        )}
        {workspace.stale && (
          <Alert
            severity="warning"
            sx={{ mx: 3, mt: 2 }}
            action={<Button onClick={() => window.location.reload()}>重新载入</Button>}
          >
            工作区已切换，当前页面仅保留原输入；保存操作已暂停。
          </Alert>
        )}
        <PageEntrance>
          <Suspense fallback={<RouteLoading />}>
            <Outlet key={workspace.outletVersion} />
          </Suspense>
        </PageEntrance>
      </Box>
    </Box>
  );
}
