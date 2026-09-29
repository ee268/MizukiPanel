import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
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

  return (
    <Drawer
      variant={desktop ? "permanent" : "temporary"}
      open={desktop || open}
      onClose={onClose}
      sx={{
        width,
        flexShrink: 0,
        transition: theme.transitions.create("width"),
        "& .MuiDrawer-paper": {
          width,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          borderRight: "none",
          transition: theme.transitions.create("width"),
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
              {!compact && <ListItemText primary={item.label} />}
            </ListItemButton>
          </Tooltip>
        ))}
      </List>
      <Box sx={{ mt: "auto" }}>
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
            {!compact && <ListItemText primary="关于" />}
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
              {!compact && <ListItemText primary="收起导航栏" />}
            </ListItemButton>
          </Tooltip>
        )}
      </Box>
    </Drawer>
  );
}
