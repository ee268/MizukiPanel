# MizukiPanel

Mizuki 博客的本机管理面板。当前完成阶段 4：在文章管理基础上增加公共图片与文章资源管理，并可启动或连接 Mizuki 的 Astro 真实预览。安全同步与存储见 [阶段 2 说明](docs/STAGE_2.md)，文章操作见 [阶段 3 说明](docs/STAGE_3.md)，媒体与预览见 [阶段 4 说明](docs/STAGE_4.md)。站点配置、特色页管理和发布工作流按 [设计文档](docs/DESIGN.md) 的后续阶段实现。

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
pnpm test
pnpm build
```

连接路径仅保存在被 Git 忽略的 `.local/workspace.json`；访问令牌只存在于本次启动进程中。文章管理写入前会检查版本冲突，文章与媒体删除会移入本地回收目录。Astro 预览只监听 `127.0.0.1:4321`，面板不会自动提交、推送或同步 Git 变更。
