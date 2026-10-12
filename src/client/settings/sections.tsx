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
    description: "管理启动与最近项目、连接后的页面及项目只读偏好，可独立保存各组修改。",
    icon: <FolderOutlined />,
  },
  {
    id: "media",
    title: "媒体管理",
    description: "设置当前项目的图片上传、存放、引用与处理默认值，可在上传时临时调整。",
    icon: <PermMediaOutlined />,
  },
  {
    id: "preview",
    title: "预览与发布",
    description: "管理本地预览、日志显示与保留及发布默认值，可独立保存各组修改。",
    icon: <RocketLaunchOutlined />,
  },
  {
    id: "maintenance",
    title: "备份与维护",
    description: "管理会话策略、备份、独立回收站、手动清理规则及偏好导入导出。",
    icon: <RestoreOutlined />,
  },
] as const;
