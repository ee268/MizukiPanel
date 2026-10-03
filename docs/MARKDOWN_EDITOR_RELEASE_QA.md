# 文章混合编辑与单篇预览发布回归

验证日期：2026-10-03。面板使用本次 `pnpm build` 产物；Mizuki 对照来自仓库已有的 `dist/posts/qt框架功能概述/index.html`（文件时间 2026-09-27），仅作为视觉基线，未启动 Astro 或重建 Mizuki。浏览器为 Windows Edge 154，截图视口宽度为 1440 和 600 像素。

## 验证结果

| 范围 | 结果 |
| --- | --- |
| 本地真实文章 | `Qt框架功能概述.md` 用未保存正文完成单篇渲染；表格、提示块、KaTeX、Mermaid/PlantUML 容器、Wiki Link 和图片地址按预期输出；原文件内容未变。 |
| 独立内容仓库 | 临时 `posts/nested/regression.md` 与文章相对图片、公共图片均从独立内容根目录读取；草稿渲染未写回临时文章，也未触碰 Mizuki 仓库。图片网格的缩略图和放大链接均走受限媒体接口。 |
| 编辑与原文安全 | 全套测试覆盖正文保存、BOM/CRLF/Frontmatter 保留、版本冲突、MDX 原文卡片及声明式局部修改；当前 Mizuki 没有真实 `.mdx` 文章，MDX 验证使用结构化样本，组件运行仍须用真实预览检查。 |
| 失败恢复 | 浏览器阻断草稿渲染请求后，界面显示失败并保留上次结果；解除阻断并继续输入后，预览更新为最新草稿。未点击保存。 |
| 响应式与主题 | 浅色/深色、1440/600 像素下正文可见；页面和 iframe 均无横向溢出。预览背景随面板明暗模式变化，强调色读取 Mizuki 的站点配置。 |
| 工程检查 | `pnpm check`、`pnpm test`（29 个文件、103 项测试）、`pnpm build` 通过。 |

## 截图对照

| 面板单篇预览 | Mizuki 已有静态页面 |
| --- | --- |
| [浅色桌面](qa/markdown-preview-light-1440.png) | [Mizuki 桌面正文](qa/mizuki-article-1440.png) |
| [浅色窄屏](qa/markdown-preview-light-600.png) | [Mizuki 窄屏正文](qa/mizuki-article-600.png) |
| [深色桌面](qa/markdown-preview-dark-1440.png) | — |
| [深色窄屏](qa/markdown-preview-dark-600.png) | — |

截图检查后，将预览正文最大宽度收至 760 像素，标题锚点改为悬停或键盘聚焦时显示，并补齐图片网格布局和窄屏列数。Mizuki 静态页面在 1440 像素视口的正文宽度约为 727 像素；预览保留独立 iframe 的留白，因此两者仍非逐像素一致。字体、引用块、完整 Tailwind 排版与站点交互脚本仍有可见差异。代码高亮、Mermaid 绘图、PlantUML 远程服务和独立仓库 Wiki Link 的边界继续由预览界面明确提示。

本次截图仅验证页面当前显示区域；长文其余位置依赖自动化测试中的 HTML、资源路径与保存安全检查。Mizuki 的已有静态产物可能落后于当前源码，最终发布效果仍需按项目实际构建或真实预览确认。
