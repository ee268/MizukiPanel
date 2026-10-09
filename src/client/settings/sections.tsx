import PaletteOutlined from "@mui/icons-material/PaletteOutlined";
import EditNoteOutlined from "@mui/icons-material/EditNoteOutlined";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import PermMediaOutlined from "@mui/icons-material/PermMediaOutlined";
import RocketLaunchOutlined from "@mui/icons-material/RocketLaunchOutlined";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";

export const settingsSections = [
  {
    id: "appearance",
    title: "外观与导航",
    description: "面板显示、主题与导航习惯。",
    icon: <PaletteOutlined />,
  },
  {
    id: "editor",
    title: "文章编辑",
    description: "编辑器显示与文章撰写偏好。",
    icon: <EditNoteOutlined />,
  },
  {
    id: "workspace",
    title: "工作区",
    description: "项目连接与工作区使用偏好。",
    icon: <FolderOutlined />,
  },
  {
    id: "media",
    title: "媒体管理",
    description: "图片上传、存放与引用习惯。",
    icon: <PermMediaOutlined />,
  },
  {
    id: "preview",
    title: "预览与发布",
    description: "本地预览、运行日志与发布偏好。",
    icon: <RocketLaunchOutlined />,
  },
  {
    id: "maintenance",
    title: "备份与维护",
    description: "备份、回收内容与本地数据管理。",
    icon: <RestoreOutlined />,
  },
] as const;
