# 文章正文保存契约

第 3 阶段提供 `PUT /api/article/body`，请求为 `{ id, version, body, sourceEdits? }`。`body` 是不含 Frontmatter 的完整正文；`sourceEdits` 可选，元素为 `{ id, source }`，其中 `id` 是读取基线经 `segmentArticleSource()` 得到的源码片段编号。成功后返回更新后的 `article` 与 `previewPath`，与现有源码保存接口一致。

保存前从当前文件重新读取正文并校验版本。服务端只拼接原文件的 Frontmatter 前缀和候选正文，不重建 YAML；BOM、注释、字段顺序和 `tags` 写法保持原样。普通文章使用统一的 Markdown/GFM/数学/指令解析与 HTML 渲染管线校验；MDX 用 MDX 解析器检查语法。当前阶段的 Markdown 校验是独立管线，不等同于 Mizuki 最终页面的全部插件和样式；后续单篇预览阶段会继续适配并对照。

未声明的 MDX 或 Mizuki 源码片段修改会被拒绝。明确编辑源码卡片时，调用方需在 `sourceEdits` 中提供对应编号和新原文；当前契约要求保护片段的数量与语法类型不变。增删片段、无法安全分段或原文混合换行的文章，应使用现有完整源码模式。对于换行约定一致的文章，候选正文及片段编辑会沿用原文件的 LF 或 CRLF。没有内容变化时不写文件，也不创建备份。

最终写入仍调用现有 `writeManagedFile()`：它在锁内复查版本，先备份原文件，再通过临时文件原子替换。路径校验、只读限制及本地/独立内容仓库的路径映射与其他文章操作相同。版本冲突返回 HTTP 409；参数或内容校验错误返回 400；失败不改原文件。

验证覆盖 BOM/CRLF 和 Frontmatter 原样保留、备份、外部修改导致的版本冲突、无效 MDX、未声明片段修改、明确的源码卡片编辑、本地/独立仓库路径、HTTP 路由及无变化保存；还会在临时副本上验证一篇真实 Mizuki 文章。可运行 `pnpm exec vitest run tests/article-body.test.ts tests/article-body-route.test.ts tests/server-app.test.ts`。前端正文编辑入口属于下一阶段，本阶段不会改变现有编辑页面。
