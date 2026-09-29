import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { NavLink } from "react-router-dom";
import type { SiteIdentity } from "../types";
import ThemeSettings from "../components/ThemeSettings";

interface AppHeaderProps {
  drawerWidth: number;
  identity: SiteIdentity;
  onOpenMenu: () => void;
  onLogout: () => void;
}

export default function AppHeader({ drawerWidth, identity, onOpenMenu, onLogout }: AppHeaderProps) {
  const theme = useTheme();

  return (
    <>
      <Box
        component="img"
        src="/mizuki-panel-logo.svg"
        alt="MizukiPanel"
        sx={{
          position: "fixed",
          top: 8,
          left: { xs: 56, md: 16 },
          width: { xs: 150, sm: 190 },
          height: 48,
          display: "block",
          objectFit: "contain",
          bgcolor: "transparent",
          zIndex: theme.zIndex.drawer + 2,
          pointerEvents: "none",
        }}
      />
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          zIndex: theme.zIndex.drawer + 1,
          ml: { md: drawerWidth + "px" },
          width: { md: "calc(100% - " + drawerWidth + "px)" },
          transition: theme.transitions.create(["margin", "width"]),
        }}
      >
        <Toolbar>
          <IconButton onClick={onOpenMenu} sx={{ display: { md: "none" }, mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="编辑个人资料配置">
            <IconButton
              component={NavLink}
              to="/config?key=profileConfig"
              aria-label="编辑个人资料配置"
              sx={{ p: 0, mr: 1 }}
            >
              <Avatar
                src={identity.avatarUrl ?? undefined}
                alt={identity.title}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                M
              </Avatar>
            </IconButton>
          </Tooltip>
          <Typography
            variant="body2"
            color="text.secondary"
            title={identity.title}
            sx={{
              display: { xs: "none", sm: "block" },
              mr: 1,
              maxWidth: { sm: 220, lg: 360 },
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {identity.title}
          </Typography>
          <ThemeSettings />
          <IconButton aria-label="退出登录" title="退出登录" onClick={onLogout}>
            <LogoutOutlined />
          </IconButton>
        </Toolbar>
      </AppBar>
    </>
  );
}
