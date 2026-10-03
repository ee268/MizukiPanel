# 单篇 Markdown 渲染可行性验证

> 后续进展：单篇草稿渲染现已接入文章编辑页；当前实现范围与已知差异见[正文混合编辑设计](VISUAL_MARKDOWN_EDITOR.md)。本页保留最初探针的测量结果。

## 结论

当前 Mizuki 项目安装的 `@astrojs/markdown-remark@7.2.1` 可以在不启动 Astro 服务、也不构建站点的情况下处理单篇 `.md` 正文。面板中的只读探针按 `astro.config.mjs` 的顺序装载了 12 个 remark 和 10 个 rehype 插件，并在内存里渲染未保存草稿。已验证的扩展包括提示块、Wiki Link、数学公式、Mermaid、PlantUML、表格和图片的 HTML 结构。

运行方式：在 MizukiPanel 根目录执行 `pnpm probe:markdown C:\1code\Mizuki`。参数是 Mizuki 项目根目录；省略时使用相邻的 `../Mizuki`。命令只读取项目配置、插件和示例文章，输出 JSON 指标，不写回文章或构建产物。它是可行性探针，尚未接入文章编辑页或浏览器 DOM。

## 本机验证结果

2026-10-01，Windows、Node 22.23.2、Mizuki 的 Markdown 处理器 7.2.1，执行一次冷启动。时间仅代表本机样本，不是用户交互时延保证。

| 操作 | 输入大小 | 耗时 |
| --- | ---: | ---: |
| 首次导入配置与插件 | — | 约 1.17 秒 |
| 创建处理器 | — | 约 0.7 毫秒 |
| 扩展语法草稿 | 275 字节 | 约 126 毫秒 |
| `Qt框架功能概述.md` 正文 | 52,018 字节 | 约 208 毫秒 |
| `vs2022配置protobuf.md` 正文 | 3,941 字节 | 约 33 毫秒 |
| 修改后再次渲染草稿 | 287 字节 | 约 17 毫秒 |

草稿断言检查了标题、表格、提示块、Wiki Link、KaTeX、Mermaid、PlantUML 和图片标记。真实文章从 Frontmatter 后提取正文；探针不会保存渲染结果，也不会运行 `astro dev`、`astro build` 或 `astro preview`。

## 已确认的边界与后续工作

- 此探针设置 `syntaxHighlight: false`，因此代码块尚未接入 Mizuki 使用的 Expressive Code。其主题、语言标记、代码组和折叠效果需在后续富文本及预览工作中单独适配。
- Mermaid 当前输出的是需要浏览器脚本接管的容器；PlantUML 输出指向配置服务器的图片 URL。HTML 结构成功生成不等于离线图表已经绘制完成。
- 提示块、图片、表格等生成了同源类名，但探针没有装载 Mizuki 的正文 CSS、Tailwind/Stylus 产物及主题变量。后续预览应按文章容器范围加载样式并做截图对照。
- 相对图片和附件还没有映射到面板的安全媒体 URL。Wiki Link 插件目前从 Mizuki 的 `src/content/posts` 索引文章；独立内容仓库模式需要适配数据来源。不能仅凭本阶段结果宣称该模式可用。
- GitHub 卡片等组件可能输出浏览器脚本。正式预览必须限定可信项目、隔离生成的 HTML，并处理资源与脚本权限；不能把本探针输出直接注入面板页面。
- `createMarkdownProcessor()` 在当前依赖版本中可调用，但并非稳定的 Astro 集成契约。升级依赖后必须重跑探针；若接口改变，改用等价的 unified 管线。
- 当前只验证 `.md` 正文。`.mdx` 不进入单篇实时渲染，组件运行仍由现有 Astro 真实预览或发布检查确认。

第 1 阶段的插件兼容性门槛已通过。下一阶段按[编辑器设计](VISUAL_MARKDOWN_EDITOR.md)处理原文片段保护；真正的浏览器实时预览、资源映射和视觉对照仍在后续阶段实现。
