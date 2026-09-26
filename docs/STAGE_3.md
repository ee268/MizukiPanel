# 阶段 3：文章管理

## 已实现

- 文章列表支持搜索、草稿与异常筛选，展示当前原始内容目录中的 Markdown 和 MDX 文件。
- 新建文章、编辑 Frontmatter、编辑完整源码、重命名和删除。支持 posts 下的子目录；删除会将原文件复制到面板的 `.local/trash/articles/` 后再移除原路径。
- 表单覆盖标题、日期、描述、标签、分类、封面、作者、路由、评论、置顶、加密等字段。未在表单中的 Frontmatter 字段及 Markdown/MDX 正文会保留；源码模式可编辑完整文件。
- 保存时校验 YAML、已知字段类型、日期、链接、文章路径和路由冲突（使用 Astro 相同的 github-slugger 处理文件名，并检查 Frontmatter 的 slug、alias、permalink）。所有写入使用阶段 2 的版本检查与备份，其他进程改过文件时必须重新加载。
- 本地模式写入 `src/content/posts/`；独立仓库模式直接写入内容仓库的 `posts/`。

## 操作说明

在工作区连接 Mizuki 后选择“管理文章”。表单只修改文章元数据；要编辑正文、MDX 组件或特殊 YAML 字段，请切换到源码模式。重命名会改变默认文章 URL，已有外链可能失效。独立仓库中的改动需由用户自行检查和提交。

## 验证

`pnpm test` 包含真实 Mizuki 文章的读写回归及两种模式的 CRUD 测试。面板 `pnpm check` 和 `pnpm build` 验证路由与 UI；Mizuki 的 `pnpm check`、`pnpm type-check` 用临时文章验证兼容性。
