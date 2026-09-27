# 阶段 6：全部特色页

阶段 6 已完成关于、友链、日记、追番、相册、项目、技能、设备、时间线和 AI 工具的统一管理。

## 管理范围

- 关于与友链正文：编辑 `spec/about.md` 和 `spec/friends.md`，支持首次创建、版本冲突检查、备份和恢复。
- 结构化数据：管理 `friends.ts`、`diary.ts`、`anime.ts`、`projects.ts`、`skills.ts`、`devices.ts`、`timeline.ts` 和 `ai-tools.ts`。
- 数组数据以独立条目显示，支持新增、修改、删除和上下排序；设备分组以结构化 JSON 编辑。
- 使用 TypeScript AST 只替换目标数据初始化器，保留接口、导入、辅助函数和未触及代码。
- 季度追番：管理 `animes/<年>/<季度>月.md`，支持创建、编辑和移入回收目录。
- 相册：管理 `images/albums/<id>/info.json`，支持本地/外链模式、隐藏、布局、封面、照片、密码字段、图片上传和可恢复删除。
- 页面状态：读取 `siteConfig.featurePages` 和 `navBarConfig`，提示页面关闭或缺少导航入口。
- 外部数据源：Memos、Bangumi 和 Bilibili 模式只显示来源状态并引导到站点配置，不修改未生效的本地数据。

## 安全与校验

- 本地模式写入 Mizuki 仓库；独立模式写入内容仓库的 `spec/`、`data/`、`animes/` 和 `images/albums/`。
- 所有写入复用路径守卫、版本哈希、原子替换和备份。
- 校验重复 ID、日期、HTTP(S) URL、站点相对路径、季度文件名和相册字段。
- TypeScript 数据出现代码表达式时切换为只读，避免把表达式错误转换为字符串。
- 季度文件、相册目录和相册图片删除前复制到面板回收目录。

## 验证

- 真实 Mizuki：10 个模块、8 个结构化数据源、2 个正文、11 个季度文件和 4 个相册全部完成只读解析。
- 测试夹具：本地与独立模式的数据保存/恢复、正文创建、页面开关、导航状态、远程数据源、季度创建/删除、相册创建/修改/删除。
- 面板通过 `pnpm check`、`pnpm test` 和 `pnpm build`。
- Mizuki 通过 `pnpm check`、`pnpm type-check` 和 `pnpm build`。
