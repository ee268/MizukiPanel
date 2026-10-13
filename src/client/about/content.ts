import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import CollectionsOutlined from "@mui/icons-material/CollectionsOutlined";
import PreviewOutlined from "@mui/icons-material/PreviewOutlined";
import CommitOutlined from "@mui/icons-material/CommitOutlined";

export const repositoryUrl = "https://github.com/ee268/MizukiPanel";
export const capabilities = [
  {
    id: "articles",
    title: "让内容落笔",
    label: "文章管理",
    description:
      "从 Frontmatter 到 Markdown 正文，在同一个编辑空间整理文章。AI 协作写作支持对话与修改对比。",
    detail: "可视化编辑 · AI 协作 · 本地草稿",
    path: "/articles",
    Icon: ArticleOutlined,
  },
  {
    id: "config",
    title: "让站点有自己的样子",
    label: "站点配置",
    description: "按分类发现配置，在分区标签中调整站点外观与行为，编辑前留存独立备份。",
    detail: "配置搜索 · 分区编辑 · 独立备份",
    path: "/config",
    Icon: TuneOutlined,
  },
  {
    id: "features",
    title: "把喜欢的事放进博客",
    label: "特色页面",
    description: "整理友链、日记、相册与追番内容，按项目支持的功能开启属于自己的页面。",
    detail: "页面开关 · 季度追番 · 内容管理",
    path: "/features",
    Icon: AutoAwesomeOutlined,
  },
  {
    id: "media",
    title: "让每一张图各就其位",
    label: "媒体管理",
    description: "按文件夹浏览项目图片，放大查看、上传与管理资源，删除前检查已有引用。",
    detail: "文件夹图库 · 图片查看 · 引用检查",
    path: "/media",
    Icon: CollectionsOutlined,
  },
  {
    id: "preview",
    title: "在发布前，看见结果",
    label: "Mizuki预览",
    description: "启动本地 Mizuki，查看文章的实际呈现，通过运行日志了解预览任务的状态。",
    detail: "本地预览 · 文章定位 · 运行日志",
    path: "/preview",
    Icon: PreviewOutlined,
  },
  {
    id: "publish",
    title: "把每次变化留下记录",
    label: "发布管理",
    description: "查看 Git 历史，选择文件提交，推送当前分支，或独立运行 Mizuki 构建。",
    detail: "提交历史 · Git 推送 · 项目构建",
    path: "/publish",
    Icon: CommitOutlined,
  },
] as const;

export const workflow = [
  {
    title: "连接",
    detail: "从工作区选择本地 Mizuki 项目，进入你的博客工作空间。",
    path: "/",
    action: "打开工作区",
  },
  {
    title: "创作",
    detail: "编辑文章、整理图片与特色页面，让内容逐渐成形。",
    path: "/articles",
    action: "打开文章管理",
  },
  {
    title: "预览",
    detail: "启动 Mizuki预览，在实际页面中检查内容与布局。",
    path: "/preview",
    action: "打开Mizuki预览",
  },
  {
    title: "记录",
    detail: "检查工作区修改，提交到 Git，按需推送或构建项目。",
    path: "/publish",
    action: "打开发布管理",
  },
] as const;

export const questions = [
  {
    title: "面板与 Mizuki 是什么关系？",
    body: "MizukiPanel 是面向 Mizuki Astro 博客的本地管理面板。它保留项目原有目录结构，通过可视化界面管理内容、配置与 Git 操作。",
  },
  {
    title: "编辑后的内容保存在哪里？",
    body: "文章、配置和图片写入当前连接的项目或独立内容目录；面板设置、备份和回收站保存在面板状态目录，浏览器草稿用于恢复未保存输入。",
  },
  {
    title: "提交与推送会自动执行吗？",
    body: "Git 提交、推送和构建均由你在发布管理中明确触发。预览与运行日志帮助你在操作前了解当前状态。",
  },
] as const;
