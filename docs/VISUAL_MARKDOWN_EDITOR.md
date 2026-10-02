# 文章正文混合编辑与单篇 Markdown 渲染设计

> 状态：实施中。第 1 阶段的独立渲染[可行性验证](MARKDOWN_RENDERER_FEASIBILITY.md)、第 2 阶段的[原文片段保护](SOURCE_FRAGMENT_PRESERVATION.md)、第 3 阶段的[正文保存契约](ARTICLE_BODY_SAVE.md)、第 4 阶段的基础混合编辑、第 5 阶段的 GFM 与媒体操作、第 6 阶段的格式工具栏、第 7 阶段的指令块编辑、第 8 阶段的行内扩展编辑及第 9 阶段的数学、图表源码与代码组编辑已完成；MDX 结构和实时预览仍待实现。

第 4 阶段接入 Milkdown，将标准 Markdown 正文显示为可直接编辑的排版内容。受保护的 Mizuki/MDX 片段显示为只读源码卡片，完整源码模式仍可编辑它们。可视化修改只替换发生编辑的正文片段；切换可视化正文、Frontmatter 与完整源码仅修改内存草稿。独立的 Frontmatter 表单草稿和正文草稿可分别保存，保存后会保留另一部分未保存内容；全文源码的 Frontmatter 同时修改时，正文专用保存会提示先保存源码。为避免将已有表格误解析为普通段落，本阶段已加载 GFM 基础语法；表格工具、图片与媒体库引用仍属第 5 阶段。

第 5 阶段增加表格、任务列表、链接和图片的插入入口。任务项有可切换的复选框；图片可从现有媒体库选择或输入 HTTP(S)、`/images/` 与文章相对路径。编辑器通过面板媒体 API 加载本地图片，但 Markdown 中仍保存 Mizuki 使用的原始资源路径。文章资源引用按当前文章所在目录计算，支持本地与独立内容仓库。

第 6 阶段将插入入口扩展为响应式 MUI 格式工具栏：标题级别、粗体、斜体、链接、列表、引用、代码块、表格、图片、撤销/重做和正文保存。工具按钮读取当前光标处格式，编辑器接入历史记录；`Mod+B`、`Mod+I`、`Mod+Shift+K`、`Mod+K` 和 `Mod+S` 按编辑区焦点执行，并在输入法组合期间忽略。完整源码与 Frontmatter 模式的 `Mod+S` 调用各自保存操作。CommonMark/GFM 自带的标题、强调、列表和围栏代码输入规则继续使用。

第 7 阶段为 Mizuki 的 `:::` 提示块、`::github`/`:::github` 仓库卡片和 `:::grid` 图片网格提供独立编辑卡片。提示块标题与正文、仓库地址、网格列数/宽高比/填充方式及图片 Markdown 子内容可以局部修改；图片网格同时显示延迟加载的缩略图。仅对完整识别且属性受支持的指令开放卡片，未知指令或属性继续作为原文片段保护。改动后再次解析验证；无效草稿不替换原文，并暂时禁用可视化模式的保存。

第 8 阶段为 `[[目标#章节|显示文字]]` Wiki Link、`:spoiler[内容]` 及 `> [!TYPE]` GitHub 风格提示块提供专用编辑卡片。可修改目标与文字、遮罩内容、提示类型/标题/Markdown 正文；修改前后的语法都要重新校验。只替换被编辑的源码片段，保留未触及的 Frontmatter、邻近正文与换行。正文保存请求会声明实际变化的受保护片段，供服务端逐项核验；这也使上一阶段的指令块编辑能够正常保存。未知嵌入、附带其他属性的 Spoiler 和无法安全识别的提示块继续作为原文卡片；普通 Markdown 链接标签中的 `[[...]]` 不按 Wiki Link 编辑。

第 9 阶段增加行内与块级公式的 TeX 编辑卡片，并使用与当前 Mizuki 项目相同版本的 KaTeX 显示公式排版。`mermaid`、`plantuml` 围栏可编辑图表源码；带元数据的代码围栏可编辑 Expressive Code 参数与代码内容。`::: code-group labels=[...]` 作为整体源码片段保护，仅对一标签对应一个围栏代码块的结构开放标签页编辑；其他布局保持只读源码卡片。编辑时重新解析围栏、公式与代码组，阻止会破坏边界的草稿；未修改的片段保留原有空行、围栏字符、参数和换行。

与 Mizuki 的当前效果对照：公式卡片复用 KaTeX 0.16.47，可显示数学排版，但不包含文章主题的完整正文样式。Mermaid 与 PlantUML 卡片当前只显示并编辑源码，不在卡片内生成图；Expressive Code 参数保持原文，不在卡片内重现语法高亮、折叠和行号效果；代码组标签页支持切换和编辑，但不模拟站点的最终样式。上述图形及代码呈现差异留待第 12 阶段单篇 Markdown 预览处理，涉及 PlantUML 远程服务或 Astro 专属资源的效果仍须按实际兼容性标注。Mizuki 的公式、图表和代码组语法以其 `docs/CONTENT_AUTHORING.zh.md`、`astro.config.mjs` 及当前插件配置为准。

## 目标与已确认范围

文章内容页新增“可视化正文”模式，在同一编辑区域中输入和编辑排版后的 Markdown。输入 `# `、`**加粗**`、列表、围栏代码等语法后，编辑器在合适的输入边界转换为标题、强调、列表和代码块；表格可通过工具栏插入，也应识别完整的 GFM 表格粘贴内容。界面不采用左右分栏预览。Mizuki 扩展语法和 MDX 使用可视化节点与源码片段混合编辑。

- Frontmatter 继续使用现有的独立键值行编辑区；可视化模式只编辑正文。
- 保留“完整源码”入口，直接编辑原始 Markdown/MDX，包括 Frontmatter。
- `.md` 和 `.mdx` 均可在同一正文编辑区编辑。已适配的语法显示为可视化节点；任意组件、表达式及未知语法显示为保留原文的源码卡片，允许局部源码编辑。完整源码入口始终可用。
- 编辑区域提供即时排版。仅对 `.md` 的未保存草稿，在暂停输入约 1 秒后单篇渲染，并尽可能复用 Mizuki 的 Markdown 插件与正文样式；`.mdx` 仍可混合编辑，但不进入此实时渲染流程。
- 面板不启动 Mizuki 服务，也不调用 Astro 全站构建。单篇渲染只处理文章正文，不包含站点页眉、侧栏和完整文章页布局；它依赖当前连接项目的 Markdown 配置与插件源码，不能宣称和 Mizuki 最终页面在所有情况下完全相同。
- 沿用显式保存及原有的文章版本冲突、备份机制，不在本次增加自动保存。

## 当前基础与技术选型

MizukiPanel 目前使用 React、Material UI、TypeScript、Hono 和本地文件 API。文章页已有 Frontmatter 编辑区、完整源码编辑区和基于 `version` 的保存接口。Mizuki 文章为 `.md` / `.mdx` 文件，Frontmatter 与正文共享同一文件；项目支持普通 Markdown、GFM 和多种 Astro 扩展语法。

| 职责 | 选型 | 原因与边界 |
| --- | --- | --- |
| 混合编辑内核 | Milkdown `@milkdown/react`、`@milkdown/kit`，使用 core editor、CommonMark、GFM 与自定义节点 | 普通正文保持所见即所得；扩展语法及 MDX 节点通过解析器、编辑节点和序列化器适配，未知片段以原文卡片保留。 |
| 顶部工具栏与模式界面 | 现有 Material UI | 复用主题色、浅深色模式、响应式布局与无障碍控件。 |
| 完整与局部源码编辑 | 保留现有入口，后续改用 CodeMirror Markdown/MDX 语言支持 | 任意复杂语法始终可以原样编辑；不要求所有 JSX 表达式都具备表单式编辑。 |
| 内容读写 | 现有 Hono API 与 `src/lib/server/articles.ts` 写入机制 | 新增只替换正文的服务能力；继续使用同一文件事实来源、路径校验、版本冲突和备份。 |
| 媒体引用 | 现有媒体管理与文章资源路径解析 | 插入现有资源或 URL，并生成 Mizuki 可识别的 Markdown 图片引用。 |
| 单篇 `.md` 渲染 | 优先验证项目已安装的 `@astrojs/markdown-remark` 单篇处理器或等价 unified 管线，按 Mizuki 顺序加载 remark/rehype 插件；代码块另接 Expressive Code 核心能力 | 只处理当前正文草稿，无 Astro 服务和全站构建。结果是接近站点的预览，不能覆盖 `.mdx` 组件运行效果；现有 Astro 真实预览仍可用于最终检查。 |

Milkdown 官方资料：[React 集成](https://milkdown.dev/docs/recipes/react)、[自定义节点与 remark 扩展](https://milkdown.dev/docs/api/utils)、[GFM preset](https://milkdown.dev/docs/api/preset-gfm)、[命令](https://milkdown.dev/docs/guide/commands)、[快捷键](https://milkdown.dev/docs/guide/keyboard-shortcuts)。MDX 解析须处理 [JSX、表达式和 ESM 节点](https://mdxjs.com/packages/mdx/)。单篇 `.md` 渲染可使用 [remark/rehype 管线](https://github.com/remarkjs/remark/blob/main/packages/remark-parse/readme.md)；Mizuki 当前安装的 `@astrojs/markdown-remark` 导出了 `createMarkdownProcessor()`，但该工厂尚非稳定的公开集成契约，应在首阶段做兼容原型并固定版本。代码块可使用 [Expressive Code 核心引擎](https://expressive-code.com/reference/core-api/)单独渲染。

## 页面交互

文章内容页提供三个明确入口：“可视化正文”“Frontmatter”“完整源码”。普通 Markdown 直接编辑；已适配的提示块、Wiki Link、图表、代码组和 MDX 组件以专用节点显示。组件卡片可展示组件名、已识别的静态属性及一个“编辑该片段源码”入口；动态表达式、导入导出和未知结构显示为源码卡片。任何卡片都不能静默丢弃原始属性或子内容。

“单篇 Markdown 预览”是 `.md` 文章的只读视图，不与可写的编辑 DOM 混用，也不采用固定的左右分栏。它在输入暂停后渲染当前未保存正文，展示结果时标明草稿修订号与时间。新修订产生后，旧任务应取消或让其结果失效；失败时展示错误与上次成功结果的过期状态。`.mdx` 文章显示“此预览仅支持 .md”，仍保留现有 Astro 真实预览入口供用户按需启动和检查。

可视化编辑器上方的固定工具栏包括标题级别、粗体、斜体、链接、无序/有序/任务列表、引用、代码块、表格、图片、撤销/重做和保存。按钮根据光标处的格式呈现选中状态；禁用状态、提示文字和快捷键在窄屏下仍可访问。图片支持选择当前媒体库中的资源，或填写 HTTP(S) / 项目内路径；生成引用时遵循 Mizuki 的相对路径与 `/images/` 规则。代码块编辑区保留语言标识与等宽排版；代码高亮仅作为编辑辅助。

键盘行为按编辑器焦点生效，跨平台采用 `Mod`：Windows/Linux 为 Ctrl，macOS 为 Command。输入法组合输入期间不执行 Markdown 转换或工具快捷键。

| 操作 | 快捷键 / 输入 | 预期行为 |
| --- | --- | --- |
| 粗体 | `Mod+B` 或成对 `**` | 将选区设为粗体，或把完成输入的 Markdown 标记转换为粗体。 |
| 斜体 | `Mod+I` | 切换斜体。 |
| 代码块 | `Mod+Shift+K` 或完成的围栏代码块 | 插入或切换代码块；显式覆盖内核默认映射，避免与产品约定冲突。 |
| 链接 | `Mod+K` | 编辑选区链接地址与标题。 |
| 标题 | `# ` 至 `###### `、工具栏级别选择 | 当前段落转换为对应标题。 |
| 列表 | `- `、`1. `、`- [ ] ` 或工具栏 | 转换为对应列表，支持缩进和退格退出。 |
| 表格 | 工具栏插入，或粘贴完整 GFM 表格 | 生成可编辑表格；管道输入规则须在原型验收中验证，不能将尚未完成的文本误判为表格。 |
| 保存 | `Mod+S` 或保存按钮 | 阻止浏览器默认另存为，调用当前模式对应的保存操作。 |

## 安全编辑边界

基础可视化节点支持段落、标题、强调、链接、图片、引用、分隔线、常规围栏代码、列表、GFM 表格、任务列表和删除线。Mizuki 专用节点逐项覆盖 `:::` 提示块/图片网格、`::github`、Wiki Link、`:spoiler[]`、数学公式、GitHub 风格提示块、Mermaid、PlantUML、代码组和 Expressive Code 参数。项目自定义 MDX 组件、原始 HTML/JSX、`import`/`export` 和表达式可以与这些节点共存；只有经过显式适配的属性允许表单编辑，其余部分保留为源码卡片。

解析以源码语法树及节点位置为准，不能从 Astro 渲染后的 HTML 反推 Markdown/MDX。对不支持的节点保存原始文本片段与来源位置；编辑周围的普通正文时，这些片段必须逐字节保持。已修改的标准 Markdown 区域可规范化空白或围栏形式，但内容与结构必须保持；不能承诺改动区域字节级一致。MDX 卡片内编辑源码时，应只替换该片段，不重排邻近代码。未修改的文章不得因为打开页面、切换模式或生成预览而写回文件。

可写前先用 `.md`/`.mdx` 解析器及 Mizuki 扩展规则做节点识别和往返检查。未知语法、重叠的源码范围、无法确定边界的 JSX/表达式或检查失败时，局部卡片保持源码模式；如果整篇文档无法安全分段，则退回完整源码模式。不能只靠全局正则扫描，也不能让 Milkdown 对未知节点执行默认序列化。`.md` 保存前执行单篇 Markdown 管线校验；`.mdx` 只做 MDX 语法与原文保护检查，组件导入、运行和 Astro 集成的最终正确性须由现有真实预览或发布检查确认，不能在本功能中保证。

预览有明确边界：`.md` 处理器尽量沿用相同插件顺序、配置、正文 CSS、主题变量和资源路径；对代码块、图片、Mermaid、PlantUML 等按真实文章逐项比对。Astro 集成在构建时追加的处理、资源打包、运行脚本和外部服务可能产生差异，因此界面将其称为“单篇 Markdown 预览”，不标称与 Mizuki 页面逐像素完全一致。差异清单和不支持语法须可见，不能静默显示错误效果。

## 数据与保存流程

```text
读取文章原始 source + version
  ├─ Frontmatter 编辑：沿用现有键值行与保存接口
  ├─ 完整源码编辑：沿用原始全文与保存接口
  └─ 混合正文：提取 body → 解析为可视化节点/原文卡片 → 编辑草稿
                      ├─ 若为 .md：暂停输入约 1 秒 → 单篇 Markdown 管线
                      │            → HTML + 正文样式与资源解析 → 只读预览
                      └─ 显式保存 → 局部序列化与原文片段复检
                                    → .md 单篇渲染校验 / .mdx 语法校验
                                    → version 检查
                                    → 原 Frontmatter 字节 + 新 body
                                    → 备份/原子写入 → 新 version
```

新增正文专用保存接口，例如 `PUT /api/article/body`，请求携带文章 ID、读取时的 `version` 和新正文。服务端须从当前原文分割 Frontmatter 与正文，确认版本未变化后只替换正文，保留 BOM、Frontmatter、换行约定和未修改字段；继续走现有的项目路径校验、备份和原子写入。源码保存仍使用当前全文接口。独立内容仓库模式复用同一内容路径解析规则，不能只针对 Mizuki 内置 `src/content/posts/` 实现。`.md` 候选正文经单篇渲染器校验、`.mdx` 经语法解析后，再做最终版本复检与写入；失败时保留草稿和原文件。

前端分别保存 Frontmatter、正文和源码的草稿与脏状态。模式切换只改变视图，不隐式保存或丢弃草稿；混合编辑与源码切换应局部序列化到内存全文草稿并重新解析。保存成功后用服务端返回的全文、`version` 和文章记录刷新基线；遇到版本冲突时保留用户草稿，给出重新加载或复制内容的选择，不自动覆盖外部改动。离开文章或关闭页面时提示未保存变更。

`.md` 预览为每次输入生成递增修订号；只渲染最新的稳定正文，取消或忽略过期任务。结果由面板现有服务只读提供，或在受限 iframe 中展示；相对图片、Wiki Link 等需要通过当前文章路径及本地/独立内容仓库映射解析。未保存内容仅在内存中传给单篇渲染器，不改 Mizuki 的 `dist` 和任何真实文章。处理器缓存要按项目、配置与依赖指纹失效，避免展示旧主题或旧插件效果。

此流程不调用 Astro `build()`、`dev()` 或 `preview()`。单篇渲染器复用或适配 Mizuki 的 Markdown 插件、配置和样式，不执行 MDX 项目组件。首阶段要证明当前版本的插件能在独立的 `.md` 管线中加载，并测量实际输入到预览更新的延迟；遇到只能在 Astro 环境中工作的插件，应记录差异并提供受控降级，不声称完全一致。

## 模块边界

按现有[架构说明](ARCHITECTURE.md)拆分职责，不把解析、媒体路径、安全判断、工具栏和 API 调用集中到 `ArticleEditor.tsx`：

- `src/client/articles/`：编辑器容器、Milkdown 适配、扩展语法节点、MDX 源码卡片、MUI 工具栏、快捷键、草稿 Hook 与媒体选择 UI。每个文件负责一个具体模块。
- 文章格式纯逻辑：Frontmatter/正文分割与合并、语法树分段、原始片段保持和结构往返检查；可独立测试，不依赖 React 或文件系统。
- `src/server/routes/articles.ts`：正文接口的参数与错误映射。
- `src/lib/server/articles.ts`：按版本替换正文并复用备份/写入流程。
- 单篇 Markdown 渲染服务模块：插件适配、处理器缓存、修订调度、资源路径解析和受限预览输出；不把任务管理写进 React 页面或文章保存服务。
- 现有 `FrontmatterEditor`、完整源码入口和可选的 Astro 真实预览保留；单篇 `.md` 预览尽量复用 Mizuki 的处理链，并明确其与最终站点之间的差异。

## 难点与工程约束

1. **单篇插件兼容，难度高。** Mizuki 的 Markdown 配置包含自定义 remark/rehype 插件及站点参数，部分插件读取项目文件或期待特定上下文。需要在不运行 Astro 的条件下加载相同顺序与配置，并对不兼容项明确降级。`createMarkdownProcessor()` 虽存在于当前安装包，仍需验证版本稳定性。
2. **原文安全，难度很高。** MDX 表达式与 JSX 可嵌套 Markdown，Mizuki 指令与代码元数据也有专用语义。节点位置、局部修改范围和原文保留必须通过真实样本与往返测试，否则保存可能改写未触及的组件或属性。
3. **正文视觉一致，难度高。** 正文 CSS、Tailwind/Stylus 产物、主题变量、字体、相对图片、Expressive Code、图表和交互脚本可能不属于纯 remark/rehype 输出。单篇预览需要逐项适配与对照，接受已知差异。
4. **路径和更新，难度中高。** Wiki Link、图片与附件依赖文章路径和本地/独立仓库模式；处理器缓存和任务取消要避免旧配置或旧草稿结果误显示。
5. **MDX 最终运行不在此范围。** MDX 混合编辑只保证原文片段安全及语法检查；组件导入、JSX 表达式和客户端行为仍须通过 Mizuki 的真实预览或发布检查验证。

## 实施计划：暂估 13 个阶段

此前只覆盖标准 Markdown 的方案为 5 个阶段；加入 Mizuki 扩展语法和 MDX 混合编辑后约为 10 个阶段，再加入“仅 `.md` 单篇实时渲染”约需 3 个阶段，故暂估 13 个阶段。无需 Astro 全站构建及隔离项目快照。插件兼容性和时延须在第 1 阶段实测，阶段数可能随原型结果调整。每个阶段以可验证的功能边界结束，并按 Conventional Commits 单独提交；提交标题不写 `stage-1` 等工程周期字眼。

| 阶段 | 重点实现 | 验收条件 | 提交示例 |
| --- | --- | --- | --- |
| 1. 单篇渲染可行性 | 以真实 `.md` 样本验证 Markdown 处理器、Mizuki 插件顺序与草稿耗时。 | 不启动 Astro、不构建全站；记录可复用插件、差异及更新延迟。 | `chore(preview): validate single article rendering` |
| 2. 原文保护 | Frontmatter/正文分割、MDX 与扩展语法树分段、原文卡片和来源范围。 | 未修改片段逐字节一致；未知节点不能被默认序列化吞掉。 | `feat(articles): preserve custom source fragments` |
| 3. 保存契约 | 正文专用 API、版本冲突、`.md` 渲染校验、`.mdx` 语法校验与备份。 | Frontmatter/BOM/换行保留；校验失败或版本冲突不写入原文件。 | `feat(articles): validate body before saving` |
| 4. 基础混合编辑 | Milkdown、标准 Markdown、模式切换和草稿状态。 | 输入后即时排版；源码来回切换不丢内容。 | `feat(articles): add visual Markdown editing` |
| 5. GFM 与媒体 | 表格、任务列表、链接、图片和媒体库引用。 | 保存重开后结构、资源路径与内容一致。 | `feat(articles): support tables and media` |
| 6. 工具与快捷键 | MUI 工具栏、格式状态、输入规则、撤销/重做和快捷键。 | `Ctrl+B`、`Ctrl+Shift+K`、中文输入法及窄屏交互正常。 | `feat(articles): add formatting shortcuts` |
| 7. 指令块 | Mizuki 提示块、GitHub 卡片和图片网格节点。 | 属性与子内容可编辑；未触及源码片段原样保留。 | `feat(articles): edit directive blocks visually` |
| 8. 行内扩展 | Wiki Link、Spoiler 与 GitHub 风格提示块。 | 文本和目标可编辑，保存后由 Mizuki 正常解析。 | `feat(articles): edit custom inline syntax` |
| 9. 数学、图表与代码 | 行内/块级公式、Mermaid、PlantUML、Expressive Code 参数和代码组节点。 | 源码与元数据保持；已支持效果和 Mizuki 对照，差异明确。 | `feat(articles): edit rich Markdown blocks` |
| 10. MDX 结构 | 解析 `import`/`export`、JSX、表达式与 HTML，接入原文卡片。 | 任意未知组件与表达式可与普通段落同页编辑，原文保持。 | `feat(articles): support MDX source islands` |
| 11. MDX 组件卡片 | 对已识别组件提供可视化卡片与静态属性编辑。 | 动态属性仍用局部源码；改动不能重排其他 MDX 代码。 | `feat(articles): add MDX component cards` |
| 12. `.md` 即时预览 | 单篇 Markdown 管线、正文样式与资源解析、输入防抖、过期结果取消。 | 暂停输入后数秒显示当前 `.md` 草稿；不启动 Astro；`.mdx` 明示不可用。 | `feat(preview): render Markdown drafts individually` |
| 13. 发布回归 | 真实文章、本地/独立仓库、主题、MDX 原文、失败恢复与截图对照。 | `pnpm check`、`pnpm test`、`pnpm build` 通过；未触及原文不变；`.md` 已知差异有记录。 | `test(articles): verify mixed editor safety` |

第 1 阶段是单篇插件兼容性门槛。若部分 Mizuki 插件无法脱离 Astro 运行，应报告具体差异并明确预览范围；不得把不一致结果标称为最终站点效果。第 13 阶段验收通过后才把本功能视作可发布。开发实现主要位于 MizukiPanel；测试不会修改真实 Mizuki 文章。

## 主要验收样本

1. 一篇只含标准 Markdown/GFM 的 `.md`：标题、粗体、链接、图片、列表、表格、代码块可编辑；保存后重新打开结构与内容一致。
2. 一篇含未知 Frontmatter 字段、注释、`tags: [a, b]` 与正文图片的 `.md`：只改正文后 Frontmatter 原样保留。
3. 一篇含 `:::warning`、Wiki Link、数学公式、Mermaid 的文章，以及一篇有 `import`、组件和动态表达式的 `.mdx`：已适配节点可视化，未知片段保留局部源码；切换或查看不会改写原文件。
4. 编辑期间由外部修改同一文章：保存报版本冲突，原文件与用户草稿都不丢失。
5. 本地内容和独立内容仓库各验证读取、正文保存、资源引用与单篇 `.md` 预览；桌面/窄屏和浅色/深色主题截图检查编辑区与预览差异。
6. 连续输入、渲染中再次修改、失败后修正、切换项目与断网：显示草稿修订与过期状态，不覆盖新草稿；`.mdx` 不显示错误的 Markdown 预览。
