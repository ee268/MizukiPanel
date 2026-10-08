import { useState } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Outlet } from "react-router-dom";
import { api } from "../api";
import { useSiteIdentity } from "../hooks/useSiteIdentity";
import AppHeader from "./AppHeader";
import Sidebar from "./Sidebar";

const drawerWidth = 248;
const collapsedDrawerWidth = 72;

export default function AppShell() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const identity = useSiteIdentity();
  const compact = desktop && collapsed;
  const effectiveDrawerWidth = compact ? collapsedDrawerWidth : drawerWidth;

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        "--mizuki-panel-header-height": { xs: "57px", sm: "65px" },
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
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, pt: 8, ml: { md: 0 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
