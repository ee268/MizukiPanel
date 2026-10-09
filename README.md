# MizukiPanel

Mizuki 博客的本机管理面板。界面使用 React 与 Material UI，采用顶部标题栏、左侧主导航和右侧内容区。当前已完成文章、18 项站点配置、全部特色页、公共图片与文章资源、Mizuki Astro 真实预览及发布工作流。项目的模块边界与扩展约定见 [架构说明](docs/ARCHITECTURE.md)，安全同步与存储见 [阶段 2 说明](docs/STAGE_2.md)，文章操作见 [阶段 3 说明](docs/STAGE_3.md)，媒体与预览见 [阶段 4 说明](docs/STAGE_4.md)，配置管理见 [阶段 5 说明](docs/STAGE_5.md)，特色页管理见 [阶段 6 说明](docs/STAGE_6.md)，发布流程见 [发布工作流](docs/PUBLISHING.md)，界面迁移见 [React + Material UI 迁移说明](docs/REACT_MUI_MIGRATION.md)。

文章默认使用 [Vditor](https://github.com/Vanessa219/vditor) 即时渲染编辑器，支持所见即所得、分屏预览、图片插入和撤销/重做。正文统一使用 Vditor，Frontmatter 使用独立表单；原独立源码模式与 Milkdown 编辑器已移除。资源随面板本地打包，接入与兼容边界见 [Vditor 编辑器说明](docs/VDITOR_EDITOR.md)。

设置页已提供外观导航、编辑器、草稿模板、工作区和媒体偏好。工作区支持启动策略、默认/最近项目、连接后页面、只读偏好与路径重新关联；启动策略在下次启动面板服务时应用。媒体支持上传/引用默认值及可关闭的压缩、缩放和格式转换，上传前可预览，失败可明确选择原图。使用说明见 [设置阶段 4](docs/PANEL_SETTINGS_STAGE_4.md)、[设置阶段 5](docs/PANEL_SETTINGS_STAGE_5.md)，后续安排见 [设置实施规划](docs/PANEL_SETTINGS_STAGES.md)。

## 运行要求

- Node.js 20 或更新版本
- pnpm
- 本机上的 Mizuki 项目目录

## 启动

```bash
pnpm install
pnpm dev
```

启动命令会在终端显示本次会话的访问令牌，面板只监听 `127.0.0.1:4173`。打开终端提示的 `/login` 地址，输入令牌，再填写 Mizuki 项目的**绝对路径**。生产构建可运行 `pnpm build` 后使用 `pnpm start`，仍然只监听本机。

Mizuki 只有在 `.env` 显式设置 `ENABLE_CONTENT_SYNC=true` 时才使用独立内容仓库。面板仅在检测到安全同步协议 v2 且内容目录是 Git 工作树时开放该模式的后续编辑能力；旧版 Mizuki 会保持只读。首次接管已有站点文件时，请在 Mizuki 目录运行 `pnpm sync-content --adopt` 并核对保留的 `.backup-*`。

## 检查

```bash
pnpm check
pnpm format:check
pnpm test
pnpm build
```

连接与最近项目保存在被 Git 忽略的 `.local/workspace-history.json`，旧 `.local/workspace.json` 首次迁移后原样保留；面板设置位于 `.local/settings.json` 与 `.local/project-settings/`。访问令牌只存在于本次启动进程中。文章管理写入前会检查版本冲突，文章与媒体删除会移入本地回收目录。Astro 预览只监听 `127.0.0.1:4321`。提交、推送、独立内容同步与构建仅在“发布管理”页由用户明确触发；提交范围只包含用户勾选的受管理文件。
