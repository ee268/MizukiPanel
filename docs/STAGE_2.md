# 阶段 2：安全同步与存储

## 已实现

- Mizuki 只有在 `ENABLE_CONTENT_SYNC=true` 时启用独立内容模式。自动 dev/build 同步仅使用独立仓库当前工作树，不执行 stash、reset、fetch 或自动提交。手动 `pnpm sync-content --pull` 要求干净工作树并只接受快进更新。
- 同步覆盖 `posts/`、`spec/`、`animes/`、`images/`、`overrides/`。其中 `data/` 按文件复制，内容仓库不存在的本地数据文件会保留。Windows 优先用 junction，失败时复制目录。
- 同步先检查所有目标。首次遇到原有文件会拒绝覆盖；核对后执行 `pnpm sync-content --adopt`，原文件会留下唯一命名的 `.backup-*`。受管理副本有改动时拒绝覆盖。复制中途失败会恢复本次已处理的目标。
- 面板存储层使用 SHA-256 版本检查、独占锁、临时文件替换和独立备份。恢复也要求当前版本匹配。Git 适配器只读取分支、未提交变更和上下游差异。
- 面板检测 Mizuki 安全同步协议 v2 才开放独立仓库的后续编辑能力。

## 首次接入

1. 在 Mizuki 的 `.env` 配置 `ENABLE_CONTENT_SYNC=true`、`CONTENT_DIR` 和需要时的 `CONTENT_REPO_URL`。
2. 核对独立仓库中的文章、特色页数据与图片。
3. 在 Mizuki 根目录运行 `pnpm sync-content --adopt`，检查输出的备份路径及站点页面。
4. 后续正常运行 `pnpm dev` 或 `pnpm build`。远程更新由用户明确执行 `pnpm sync-content --pull`。

## 边界

阶段 2 提供写入 API，但页面还没有文章编辑操作；文章管理在阶段 3。面板不会自动提交或推送 Git 变更。手工编辑受管理的复制目标会造成下一次同步冲突，应编辑独立仓库中的源文件。
