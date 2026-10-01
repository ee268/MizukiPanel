# 文章原文片段保护

第 2 阶段提供正文分段的纯逻辑能力，尚未接入可视化编辑器或保存接口。入口位于 `src/lib/articles/source-islands.ts`：

- `segmentArticleSource(source, "md" | "mdx")` 返回 Frontmatter 后的正文、带原始偏移的片段，以及 `hybrid` 或 `source` 模式。
- `editable` 片段可供后续可视化编辑器处理；`source` 片段保留源码卡片。片段的 `start`/`end` 相对于正文，`sourceStart`/`sourceEnd` 相对于完整文件。
- `replaceArticleSegments(article, replacements)` 只对指定片段做字符串替换。没有替换的片段直接取原始切片，Frontmatter、BOM、CRLF、注释、空白和其他正文内容都不经 AST 序列化。

解析器使用 CommonMark、GFM、数学、指令和 MDX 扩展识别语法树与来源范围。MDX 的 `import`/`export`、JSX、表达式，Mizuki 指令、Wiki Link、公式、Mermaid/PlantUML、带元数据的代码块、GitHub 风格提示块和原始 HTML 都进入源码片段。未知节点也保留源码。无法安全解析、范围重叠或缺少文件起始 Frontmatter 时，整篇正文退回源码模式。

本阶段的测试覆盖 CRLF/BOM 与 Frontmatter 原样保持、混合 MDX、未知指令、未闭合 Wiki Link、源码卡片局部替换、解析失败回退和真实 Mizuki `.md` 的只读往返。执行 `pnpm exec vitest run tests/source-islands.test.ts` 可单独复验。

此模块不验证替换文本能否被 Mizuki 成功渲染，也不写入磁盘；这些属于下一阶段的保存契约。可视化编辑器在接入时只能序列化明确可编辑的片段，不得用 Markdown/MDX AST 重建整个文件。
