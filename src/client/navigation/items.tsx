import type { ReactNode } from "react";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import PermMediaOutlined from "@mui/icons-material/PermMediaOutlined";
import PreviewOutlined from "@mui/icons-material/PreviewOutlined";
import RocketLaunchOutlined from "@mui/icons-material/RocketLaunchOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";

export interface NavigationItem {
  path: string;
  label: string;
  icon: ReactNode;
}

export const navigationItems: NavigationItem[] = [
  { path: "/", label: "工作区", icon: <DashboardOutlined /> },
  { path: "/articles", label: "文章管理", icon: <ArticleOutlined /> },
  { path: "/config", label: "站点配置", icon: <TuneOutlined /> },
  { path: "/features", label: "特色页面", icon: <AutoAwesomeOutlined /> },
  { path: "/media", label: "媒体管理", icon: <PermMediaOutlined /> },
  { path: "/preview", label: "真实预览", icon: <PreviewOutlined /> },
  { path: "/publish", label: "发布管理", icon: <RocketLaunchOutlined /> },
];
