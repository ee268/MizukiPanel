import InfoOutlined from "@mui/icons-material/InfoOutlined";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import SmartDisplayOutlined from "@mui/icons-material/SmartDisplayOutlined";
import PhotoLibraryOutlined from "@mui/icons-material/PhotoLibraryOutlined";
import WorkOutline from "@mui/icons-material/WorkOutlined";
import PsychologyOutlined from "@mui/icons-material/PsychologyOutlined";
import DevicesOutlined from "@mui/icons-material/DevicesOutlined";
import TimelineOutlined from "@mui/icons-material/TimelineOutlined";
import SmartToyOutlined from "@mui/icons-material/SmartToyOutlined";
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import type { FeatureModule } from "../types";
import { Link, useLocation } from "react-router-dom";

const icons = {
  about: InfoOutlined,
  friends: LinkOutlined,
  diary: MenuBookOutlined,
  anime: SmartDisplayOutlined,
  albums: PhotoLibraryOutlined,
  projects: WorkOutline,
  skills: PsychologyOutlined,
  devices: DevicesOutlined,
  timeline: TimelineOutlined,
  aiTools: SmartToyOutlined,
};

export default function FeatureCard({
  module,
  readOnly,
  busy,
  saving,
  onSelect,
  onToggle,
}: {
  module: FeatureModule;
  readOnly: boolean;
  busy: boolean;
  saving: boolean;
  onSelect: (key: string) => void;
  onToggle: (module: FeatureModule, enabled: boolean) => void;
}) {
  const location = useLocation();
  const Icon = icons[module.key as keyof typeof icons] ?? InfoOutlined;
  const switchTitle = !module.switchKey
    ? "关于页没有页面开关，始终开启"
    : readOnly
      ? "当前工作区只读"
      : busy
        ? "正在保存页面开关…"
        : `${module.enabled ? "关闭" : "开启"}${module.label}页面`;
  return (
    <Card
      data-feature-card={module.key}
      variant="outlined"
      sx={(theme) => ({
        height: "100%",
        position: "relative",
        borderRadius: "16px",
        transition: theme.transitions.create(["transform", "box-shadow", "border-color"], {
          duration: 220,
        }),
        "@media (hover: hover) and (pointer: fine)": {
          "&:hover": {
            transform: "translateY(-5px)",
            borderColor: "color-mix(in srgb, var(--mui-palette-primary-main) 60%, transparent)",
            boxShadow: `0 12px 30px color-mix(in srgb, var(--mui-palette-primary-${theme.palette.mode === "dark" ? "light" : "main"}) ${theme.palette.mode === "dark" ? "9%" : "12%"}, transparent)`,
            "& .feature-card-icon": { transform: "rotate(-8deg) scale(1.08)" },
          },
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover": { transform: "none" },
          "& .feature-card-icon": { transition: "none", transform: "none !important" },
        },
      })}
    >
      <CardActionArea
        component={Link}
        to={`/features/${encodeURIComponent(module.key)}${location.search}`}
        aria-label={`编辑${module.label}页面`}
        onClick={(event) => {
          if (
            event.button === 0 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey
          ) {
            event.preventDefault();
            onSelect(module.key);
          }
        }}
        sx={{ height: "100%", p: 1.75 }}
      >
        <Stack spacing={1.25}>
          <Avatar
            className="feature-card-icon"
            variant="rounded"
            sx={(theme) => ({
              width: 40,
              height: 40,
              borderRadius: "12px",
              color: "primary.main",
              bgcolor: "color-mix(in srgb, var(--mui-palette-primary-main) 10%, transparent)",
              transition: theme.transitions.create("transform", { duration: 220 }),
            })}
          >
            <Icon sx={{ fontSize: 24 }} />
          </Avatar>
          <Stack spacing={0.25}>
            <Typography
              variant="h6"
              component="h2"
              sx={{ fontSize: (theme) => theme.typography.pxToRem(16) }}
            >
              {module.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {module.key} ·{" "}
              {saving
                ? "正在保存…"
                : !module.switchKey
                  ? "始终开启"
                  : module.enabled
                    ? "已开启"
                    : "已关闭"}
            </Typography>
          </Stack>
        </Stack>
      </CardActionArea>
      <Box sx={{ position: "absolute", top: 12, right: 10 }}>
        <Tooltip title={switchTitle}>
          <span>
            <Switch
              size="small"
              checked={module.enabled}
              disabled={!module.switchKey || readOnly || busy}
              onChange={(_, checked) => onToggle(module, checked)}
              slotProps={{
                input: { "aria-label": `${module.label}页面开关`, "aria-busy": saving },
              }}
            />
          </span>
        </Tooltip>
      </Box>
    </Card>
  );
}
