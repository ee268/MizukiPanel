# MizukiPanel

Mizuki 博客的本机管理面板。当前完成阶段 1：项目连接、内容模式识别、原始路径展示和只读保护。文章编辑、特色页管理和发布工作流会按 [设计文档](docs/DESIGN.md) 的后续阶段实现。

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

若 Mizuki 的 `.env` 没有显式设置 `ENABLE_CONTENT_SYNC=false`，当前同步脚本会默认尝试内容同步。此时面板会根据目录与 URL 显示独立仓库或配置待确认状态，不擅自把它当作本地模式。阶段 1 中独立仓库模式保持只读，直到阶段 2 完成安全同步改造。

## 检查

```bash
pnpm check
pnpm test
pnpm build
```

连接路径仅保存在被 Git 忽略的 `.local/workspace.json`；访问令牌只存在于本次启动进程中。面板不会在阶段 1 写入 Mizuki 文件。
