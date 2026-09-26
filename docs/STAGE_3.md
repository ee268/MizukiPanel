# 阶段 3：文章管理

## 已实现

- 文章列表支持搜索、草稿与异常筛选，展示当前原始内容目录中的 Markdown 和 MDX 文件。
- 新建文章、编辑 Frontmatter、编辑完整源码、重命名和删除。支持 posts 下的子目录；删除会将原文件复制到面板的 `.local/trash/articles/` 后再移除原路径。
- Frontmatter 使用左右键值行：左侧字段名和右侧 YAML 内容都可编辑，也可增删字段。已知字段继续执行类型、日期、链接和路由校验；字段改名通过原键关联保留对应 YAML 注释，Markdown/MDX 正文保持不变。源码模式可编辑完整文件。
- 保存时校验 YAML、已知字段类型、日期、链接、文章路径和路由冲突（使用 Astro 相同的 github-slugger 处理文件名，并检查 Frontmatter 的 slug、alias、permalink）。所有写入使用阶段 2 的版本检查与备份，其他进程改过文件时必须重新加载。
- 本地模式写入 `src/content/posts/`；独立仓库模式直接写入内容仓库的 `posts/`。

## 操作说明

在工作区连接 Mizuki 后选择“文章管理”。Frontmatter 内容按 YAML 解析，例如数组填写 `[tag1, tag2]`，布尔值填写 `true` 或 `false`；正文、MDX 组件和完整文件可在源码模式编辑。重命名会改变默认文章 URL，已有外链可能失效。独立仓库中的改动需由用户自行检查和提交。

## 验证

`pnpm test` 包含真实 Mizuki 文章的读写回归及两种模式的 CRUD 测试。面板 `pnpm check` 和 `pnpm build` 验证路由与 UI；Mizuki 的 `pnpm check`、`pnpm type-check` 用临时文章验证兼容性。
