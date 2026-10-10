import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { NavLink } from "react-router-dom";
import { navigationItems } from "../navigation/items";

interface SidebarProps {
  desktop: boolean;
  open: boolean;
  compact: boolean;
  width: number;
  onClose: () => void;
  onToggleCollapsed: () => void;
}

export default function Sidebar({
  desktop,
  open,
  compact,
  width,
  onClose,
  onToggleCollapsed,
}: SidebarProps) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const labelSx = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    flexShrink: 0,
    flexGrow: compact ? 0 : 1,
    flexBasis: compact ? 0 : "auto",
    width: compact ? 0 : "auto",
    opacity: compact ? 0 : 1,
    transition: reducedMotion
      ? "none"
      : theme.transitions.create("opacity", {
          duration: 120,
          delay: compact ? 0 : theme.transitions.duration.standard,
        }),
  };

  return (
    <Drawer
      variant={desktop ? "permanent" : "temporary"}
      open={desktop || open}
      onClose={onClose}
      transitionDuration={reducedMotion ? 0 : undefined}
      sx={{
        width,
        flexShrink: 0,
        transition: reducedMotion ? "none" : theme.transitions.create("width"),
        "& .MuiDrawer-paper": {
          width,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          borderRight: "none",
          transition: reducedMotion ? "none" : theme.transitions.create("width"),
        },
      }}
    >
      <Toolbar sx={{ minHeight: 64 }} />
      <Divider />
      <List sx={{ p: compact ? 1 : 1.5, flex: 1, overflowY: "auto" }}>
        {navigationItems.map((item) => (
          <Tooltip key={item.path} title={compact ? item.label : ""} placement="right">
            <ListItemButton
              component={NavLink}
              to={item.path}
              end={item.path === "/"}
              aria-label={item.label}
              onClick={onClose}
              sx={{
                borderRadius: 2,
                justifyContent: compact ? "center" : "flex-start",
                minHeight: 48,
                mb: 0.5,
                px: compact ? 1 : 2,
                "&.active": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "& .MuiListItemIcon-root": { color: "inherit" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: compact ? 0 : 40, justifyContent: "center" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} sx={labelSx} />
            </ListItemButton>
          </Tooltip>
        ))}
      </List>
      <Box sx={{ mt: "auto", flexShrink: 0 }}>
        <List sx={{ p: compact ? 1 : 1.5 }}>
          <Tooltip title={compact ? "设置" : ""} placement="right">
            <ListItemButton
              component={NavLink}
              to="/settings"
              aria-label="设置"
              onClick={onClose}
              sx={{
                borderRadius: 2,
                justifyContent: compact ? "center" : "flex-start",
                minHeight: 48,
                px: compact ? 1 : 2,
                "&.active": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "& .MuiListItemIcon-root": { color: "inherit" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: compact ? 0 : 40, justifyContent: "center" }}>
                <SettingsOutlined />
              </ListItemIcon>
              <ListItemText primary="设置" sx={labelSx} />
            </ListItemButton>
          </Tooltip>
        </List>
        <Divider />
        <Tooltip title={compact ? "关于" : ""} placement="right">
          <ListItemButton
            component={NavLink}
            to="/about"
            aria-label="关于"
            onClick={onClose}
            sx={{
              justifyContent: compact ? "center" : "flex-start",
              minHeight: 52,
              px: compact ? 1 : 2.5,
              "&.active": {
                color: "primary.main",
                bgcolor: "action.selected",
                "& .MuiListItemIcon-root": { color: "inherit" },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: compact ? 0 : 40, justifyContent: "center" }}>
              <InfoOutlined />
            </ListItemIcon>
            <ListItemText primary="关于" sx={labelSx} />
          </ListItemButton>
        </Tooltip>
        {desktop && (
          <Tooltip title={compact ? "展开导航栏" : ""} placement="right">
            <ListItemButton
              aria-label={compact ? "展开导航栏" : "收起导航栏"}
              onClick={onToggleCollapsed}
              sx={{
                justifyContent: compact ? "center" : "flex-start",
                minHeight: 56,
                px: compact ? 1 : 2.5,
              }}
            >
              <ListItemIcon sx={{ minWidth: compact ? 0 : 40, justifyContent: "center" }}>
                {compact ? <ChevronRightOutlined /> : <ChevronLeftOutlined />}
              </ListItemIcon>
              <ListItemText primary="收起导航栏" sx={labelSx} />
            </ListItemButton>
          </Tooltip>
        )}
      </Box>
    </Drawer>
  );
}
