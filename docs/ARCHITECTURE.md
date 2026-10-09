# MizukiPanel 架构说明

本文说明 MizukiPanel 当前的模块边界、依赖方向和扩展约定，供后续功能开发与维护使用。

## 总体结构

MizukiPanel 是仅监听本机地址的 React 单页应用和 Hono API 服务。面板通过服务端访问用户选择的 Mizuki 项目；浏览器不直接读取文件系统，也不直接执行 Git 或 Astro 命令。

```text
浏览器（React + Material UI）
  └─ /api 请求
      └─ Hono 路由与安全中间件
          └─ 领域服务
              ├─ Mizuki 配置与内容文件
              ├─ Git 仓库
              └─ Astro 预览进程
```

## 客户端

客户端入口位于 `src/client/App.tsx`。入口只负责路由和页面懒加载，登录之外的页面统一经过 `RequireAuth`。

### 目录职责

- `pages/`：组合页面布局和功能组件，不承载文件格式或服务端业务规则。
- `layout/`：顶部栏、侧栏和页面外壳。
- `articles/`、`config/`、`features/`、`media/`、`preview/`、`publish/`、`workspace/`、`settings/`：按业务功能组织视图、状态 Hook、局部类型和常量。
- `components/`：可跨页面复用的展示组件。
- `hooks/`：跨功能使用的 React Hook。
- `shared/`：不属于某个业务功能的客户端工具和事件约定。
- `api.ts`：统一 HTTP 请求、响应解析和鉴权失败处理。
- `types.ts`：客户端与 API 交换的数据结构。

页面通过功能 Hook 读取和修改状态。组件接收明确的属性并负责渲染；网络请求集中在 Hook 或对应的功能模块内。客户端错误统一经 `shared/errors.ts` 转换为可显示文本。站点标题和头像变更通过 `shared/site-identity.ts` 中定义的事件通知界面刷新。

## 服务端

服务端由三层组成：

1. `src/server/index.ts` 创建访问令牌并启动本机 HTTP 服务。
2. `src/server/app.ts` 组合安全中间件、领域路由、错误处理和静态资源。
3. `src/server/routes/` 将 HTTP 输入转换为领域服务调用，并返回 API 响应。

文件读写、格式解析、Git 操作、预览进程和发布流程位于 `src/lib/server/`。路由层不重复实现这些规则。新增 API 时，应先把可独立验证的业务逻辑放入对应领域模块，再由路由完成参数读取和响应映射。

### 安全边界

- 服务只监听 `127.0.0.1`。
- 会话访问令牌由启动进程生成并保存在内存中。
- 修改类请求经过来源校验和身份校验。
- 所有项目路径在服务端完成规范化和目录边界检查。
- 文章和配置写入使用版本值检测并发修改。
- Git 提交仅接收面板允许管理且由用户明确勾选的文件。

## 状态与持久化

- 当前项目连接保存在被 Git 忽略的 `.local/workspace.json`。
- 面板个人偏好保存在浏览器，本机/项目偏好位于 `.local/settings.json` 与 `.local/project-settings/`；共享 schema 位于 `src/shared/panel-settings/`，不依赖 React 或服务端。设置实现与阶段边界见 [阶段 1 说明](PANEL_SETTINGS_STAGE_1.md) 和 [阶段 2 说明](PANEL_SETTINGS_STAGE_2.md)。编辑器显示偏好通过 CSS 和 Vditor 大纲/输入属性更新；默认模式仅在打开时读取。
- Mizuki 内容与配置仍以原项目文件为事实来源，面板不维护第二份业务数据库。
- 删除的文章和媒体先进入本地回收目录。
- 配置恢复使用保存时生成的备份文件。
- Astro 预览状态和发布任务状态由服务端进程管理，客户端定时读取状态和日志。

## 依赖方向

依赖应保持以下方向：

```text
客户端页面 → 客户端功能模块 → API 客户端
服务端入口 → 路由 → 领域服务 → 文件系统 / Git / 子进程
```

领域服务不应导入 React、Material UI 或路由组件。客户端不应导入 `src/lib/server/`。共享模块只放入已经出现跨功能复用的代码，避免形成无边界的工具集合。

## 测试与验证

- `pnpm check`：TypeScript 静态检查。
- `pnpm format:check`：Prettier 格式检查。
- `pnpm test`：领域逻辑、服务组合和客户端纯逻辑测试。
- `pnpm build`：分别构建浏览器资源与服务端产物。

涉及布局、交互或主题的修改，还需在浏览器中检查桌面宽度、窄屏、浅色模式和深色模式。涉及真实项目的功能，应使用 Mizuki 项目完成连接、读取和受影响操作的冒烟验证。

## 扩展约定

新增功能时按以下顺序放置代码：

1. 在 `src/lib/server/` 中实现并测试业务规则。
2. 在 `src/server/routes/` 中注册 API。
3. 在 `src/client/<feature>/` 中实现状态 Hook 和功能组件。
4. 在 `src/client/pages/` 中组合页面，并在 `App.tsx` 注册路由。
5. 只在至少两个功能需要相同逻辑时，将其提取到 `shared/` 或通用组件目录。

每个文件保持单一职责。功能代码按业务领域命名，避免使用无法表达职责的通用文件名；提交信息遵循 Conventional Commits。
