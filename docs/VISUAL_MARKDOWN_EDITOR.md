# 文章正文所见即所得编辑器设计

> 状态：设计稿。本文只确定方案和实施顺序，尚未开始代码实现。

## 目标与已确认范围

文章内容页新增“可视化正文”模式，在同一编辑区域中输入和编辑排版后的 Markdown。输入 `# `、`**加粗**`、列表、围栏代码等语法后，编辑器在合适的输入边界转换为标题、强调、列表和代码块；表格可通过工具栏插入，也应识别完整的 GFM 表格粘贴内容。界面不采用左右分栏预览。

- Frontmatter 继续使用现有的独立键值行编辑区；可视化模式只编辑正文。
- 保留“完整源码”入口，直接编辑原始 Markdown/MDX，包括 Frontmatter。
- 首版仅对安全范围内的 `.md` 标准 Markdown 与 GFM 正文开放可视化编辑；`.mdx`、JSX/Astro 组件以及 Mizuki 扩展语法文章进入源码模式。
- 继续由 Mizuki 的 Astro 预览服务提供最终渲染结果。可视化编辑区域展示接近成文的排版，但不承诺与 Astro/Expressive Code 的最终页面逐像素一致。
- 沿用显式保存及原有的文章版本冲突、备份机制，不在本次增加自动保存。

## 当前基础与技术选型

MizukiPanel 目前使用 React、Material UI、TypeScript、Hono 和本地文件 API。文章页已有 Frontmatter 编辑区、完整源码编辑区和基于 `version` 的保存接口。Mizuki 文章为 `.md` / `.mdx` 文件，Frontmatter 与正文共享同一文件；项目支持普通 Markdown、GFM 和多种 Astro 扩展语法。

| 职责 | 选型 | 原因与边界 |
| --- | --- | --- |
| 可视化编辑内核 | Milkdown `@milkdown/react`、`@milkdown/kit`，使用 core editor、CommonMark 与 GFM preset | Markdown 优先，提供 React 集成、命令、快捷键和 Markdown 序列化；使用 core 方便接入现有 MUI 工具栏与受控语法范围。 |
| 顶部工具栏与模式界面 | 现有 Material UI | 复用主题色、浅深色模式、响应式布局与无障碍控件。 |
| 完整源码编辑 | 保留现有入口，后续改用 CodeMirror Markdown 语言支持 | 源码始终可以原样编辑复杂 Markdown/MDX；可视化内核不负责解释未知语法。 |
| 内容读写 | 现有 Hono API 与 `src/lib/server/articles.ts` 写入机制 | 新增只替换正文的服务能力；继续使用同一文件事实来源、路径校验、版本冲突和备份。 |
| 媒体引用 | 现有媒体管理与文章资源路径解析 | 插入现有资源或 URL，并生成 Mizuki 可识别的 Markdown 图片引用。 |
| 最终预览 | 现有 Astro 真实预览 | Mizuki 自身的 remark/rehype、MDX 与 Expressive Code 渲染结果才是最终依据。 |

Milkdown 官方资料：[React 集成](https://milkdown.dev/docs/recipes/react)、[GFM preset](https://milkdown.dev/docs/api/preset-gfm)、[命令](https://milkdown.dev/docs/guide/commands)、[快捷键](https://milkdown.dev/docs/guide/keyboard-shortcuts)。具体版本在开始实现时以锁文件固定并验证与当前 React 版本兼容。

## 页面交互

文章内容页提供三个明确入口：“可视化正文”“Frontmatter”“完整源码”。可视化正文是安全文章的默认入口；不符合条件时默认进入完整源码，并显示原因，例如“本文包含 MDX 组件，需在源码模式编辑”。用户可以继续编辑，不能通过忽略提示强制把复杂正文交给可视化序列化器。

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

可视化模式支持段落、标题、强调、链接、图片、引用、分隔线、常规围栏代码、列表、GFM 表格、任务列表和删除线。本文中的“支持”指可编辑结构与 Markdown 语义；原文空格、围栏字符、表格对齐空白等源码排版可能被序列化器规范化。未修改的文章不得因为打开页面或切换模式而写回文件。

以下内容首版只在完整源码模式编辑：`.mdx`；原始 HTML/JSX、`import`/`export` 和 Astro/Svelte 组件；Mizuki 的 `:::` 指令提示块/图片网格、`::github`、Wiki Link、`:spoiler[]`、数学公式；GitHub 风格提示块；Mermaid、PlantUML、代码组或 Expressive Code 元数据等具有特殊渲染语义的围栏块；任何尚未识别、解析失败或往返检查失败的语法。受控策略宁可让文章进入源码模式，也不能静默丢弃节点。

打开 `.md` 时先对正文做保守的语法扫描，再使用与 Milkdown 配置一致的解析/序列化流程检查支持节点与结构往返。规则按 AST 和语法上下文判断，不能只用一个全局正则扫描代码块中的普通文本。无法证明安全时保持原始源码，不做转换。可视化模式保存前再次检查输出；若检查失败，保留当前草稿并提示进入源码修复，不写文件。该检查保证受支持结构与内容不被吞掉，不宣称字节级无损。

## 数据与保存流程

```text
读取文章原始 source + version
  ├─ Frontmatter 编辑：沿用现有键值行与保存接口
  ├─ 完整源码编辑：沿用原始全文与保存接口
  └─ 可视化正文：提取 body → 安全性检查 → Milkdown 编辑
                         ↓ 显式保存
                    Markdown 序列化与复检
                         ↓
                    服务端按 version 检查并仅替换 body
                         ↓
                    原 Frontmatter 字节 + 新 body → 备份/原子写入 → 新 version
```

新增正文专用保存接口，例如 `PUT /api/article/body`，请求携带文章 ID、读取时的 `version` 和新正文。服务端须从当前原文分割 Frontmatter 与正文，确认版本未变化后只替换正文，保留 BOM、Frontmatter、换行约定和未修改字段；继续走现有的项目路径校验、备份和原子写入。源码保存仍使用当前全文接口。独立内容仓库模式复用同一内容路径解析规则，不能只针对 Mizuki 内置 `src/content/posts/` 实现。

前端分别保存 Frontmatter、正文和源码的草稿与脏状态。模式切换只改变视图，不隐式保存或丢弃草稿；可视化与源码切换需要先将当前正文序列化到内存中的全文草稿，并重新运行资格判断。如果源码草稿加入复杂语法，则可视化入口立即禁用。保存成功后用服务端返回的全文、`version` 和文章记录刷新基线；遇到版本冲突时保留用户草稿，给出重新加载或复制内容的选择，不自动覆盖外部改动。离开文章或关闭页面时提示未保存变更。

## 模块边界

按现有[架构说明](ARCHITECTURE.md)拆分职责，不把解析、媒体路径、安全判断、工具栏和 API 调用集中到 `ArticleEditor.tsx`：

- `src/client/articles/`：编辑器容器、Milkdown 适配、MUI 工具栏、快捷键配置、模式与草稿 Hook、媒体选择 UI。每个文件负责一个具体模块。
- 文章格式纯逻辑：Frontmatter/正文分割与合并、可视化资格判断、结构往返检查；可独立测试，不依赖 React 或文件系统。
- `src/server/routes/articles.ts`：正文接口的参数与错误映射。
- `src/lib/server/articles.ts`：按版本替换正文并复用备份/写入流程。
- 现有 `FrontmatterEditor` 和完整源码入口保留。真实预览调用 Astro，不嵌入第二套 Mizuki 渲染器。

## 实施计划：预计 5 个阶段

每个阶段以可验证的功能边界结束，并按 Conventional Commits 单独提交；提交标题不写 `stage-1` 等工程周期字眼。

| 阶段 | 重点实现 | 验收条件 | 提交示例 |
| --- | --- | --- | --- |
| 1. 数据保护 | 正文提取与合并、安全资格判断、正文专用保存 API；建立标准与复杂语法样本。 | Frontmatter/未知字段/BOM/换行保持；版本冲突和备份有效；`.mdx` 与扩展语法不能进入可视化模式。 | `feat(articles): add safe body editing contract` |
| 2. 核心编辑 | 接入 Milkdown React，支持段落、标题、强调、引用、普通列表与围栏代码；模式切换和脏状态。 | 在同一编辑区输入并即时排版；源码与可视化来回切换不丢草稿；原文未改时不写文件。 | `feat(articles): add visual Markdown editing` |
| 3. 结构与媒体 | GFM 表格、任务列表、删除线、链接与图片；媒体库选择和资源路径处理。 | 常见文章内容可插入、修改、保存、重新打开；Astro 真实预览中的图片和链接有效。 | `feat(articles): support tables and media in visual editor` |
| 4. 编写效率 | MUI 工具栏、格式状态、快捷键、输入规则、撤销/重做、主题与窄屏交互。 | `Ctrl+B`、`Ctrl+Shift+K`、`Ctrl+S` 等可用；中文输入法、键盘导航和浅深色模式正常。 | `feat(articles): add formatting toolbar and shortcuts` |
| 5. 兼容与发布验证 | 使用 Mizuki 真实文章回归、本地与独立仓库验证、错误/冲突处理、文档补充与浏览器截图。 | `pnpm check`、`pnpm test`、`pnpm build` 通过；标准 Markdown 往返语义保持；复杂文章只能源码编辑且原文未损坏。 | `test(articles): verify visual editor content safety` |

阶段 1 完成前不接入可写的可视化编辑器；阶段 5 验收通过后才把此功能视作首个可发布版本的一部分。所有阶段都只修改 MizukiPanel，真实 Mizuki 仓库仅用于读取与受控冒烟验证。

## 主要验收样本

1. 一篇只含标准 Markdown/GFM 的 `.md`：标题、粗体、链接、图片、列表、表格、代码块可编辑；保存后重新打开结构与内容一致。
2. 一篇含未知 Frontmatter 字段、注释、`tags: [a, b]` 与正文图片的 `.md`：只改正文后 Frontmatter 原样保留。
3. 一篇含 `:::warning`、Wiki Link、数学公式、Mermaid 或组件的文章，以及一篇 `.mdx`：只提供源码编辑；切换或查看不会改写文件。
4. 编辑期间由外部修改同一文章：保存报版本冲突，原文件与用户草稿都不丢失。
5. 本地内容和独立内容仓库各验证读取、正文保存、资源引用与 Astro 真实预览；桌面/窄屏和浅色/深色主题截图检查工具栏与编辑区域。
