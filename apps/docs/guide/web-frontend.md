---
title: Web 前端
description: Web 控制台的认证、动态路由、工作台状态、列表页和页面组织方式。
---

## 目录结构

```text
apps/web-frontend/src
├─ api
├─ components
├─ composables
├─ layouts
├─ meta
├─ pages
├─ router
├─ stores
├─ themes
└─ utils
```

## API 客户端与登录态

`src/api/client.ts` 负责 Web 端的请求入口。

它做了几件事：

- 读取本地 access token / refresh token。
- 根据环境变量构造 Web 客户端请求头。
- 401 时自动尝试 `/api/auth/refresh`。
- 刷新失败后跳回 `/login`。
- 基于 `createApiFactory(...)` 生成统一的 `api.*` 方法。

登录态管理在 `src/stores/auth.ts`：

- `bootstrap()`：初始化时请求 `/api/auth/me`，必要时自动 refresh。
- `login()` / `register()`：拿到会话后写入 token，并同步工作台配置。
- `logout()`：清理 token、用户信息和工作台上下文。

## 登录页

登录页在 `src/pages/console/auth/LoginView.vue`。

当前实现不是固定表单，而是服务端驱动：

- 先请求 `/api/auth/strategies`
- 取回登录策略、注册策略和第三方 OAuth Provider
- 按策略动态渲染登录 / 注册表单
- 支持第三方登录回调 ticket 交换本地会话

登录页内部已经拆成多个组件：

- `AuthAccessPanel`
- `AuthStrategySelector`
- `AuthLoginStrategyForm`
- `AuthRegisterStrategyForm`
- `AuthOAuthProviders`

第三方登录入口的数据来自 `/api/auth/strategies` 返回的 `oauthProviders`，不是前端写死。

## 动态路由与菜单

动态路由核心在三个文件：

- `src/router/index.ts`
- `src/stores/menus.ts`
- `src/meta/pages.ts`

工作方式：

1. 登录成功后进入 `/console`。
2. `router.beforeEach` 触发 `menus.bootstrap(router)`。
3. `menus.current()` 拉取当前用户菜单树。
4. `viewKey` 对应到页面注册表。
5. 运行时把页面注入到 `console-root` 下。

这意味着：

- 后端菜单树决定用户能看到哪些页面。
- 前端页面组件只需要注册 `viewKey`，不需要再手写一套固定控制台路由。

## 工作台状态与用户偏好

工作台状态在 `src/stores/workbench.ts`。

它维护：

- 主题 preset
- 侧边栏风格与收起状态
- 布局模式
- 页面切换动画
- 已访问标签页
- 页面级筛选状态

同步方式：

- 本地：`localStorage`
- 远端：`/api/auth/preferences`

`hydrateUserPreferences(...)` 会在用户登录后把服务端配置应用到当前工作台，解决重新登录后配置丢失的问题。

## 页面组织方式

控制台页面现在统一采用这个结构：

```text
pages/console/<module>
├─ components/
├─ <Module>View.vue
└─ <module>-management.ts
```

职责划分：

- `View.vue`：页面编排、数据加载、事件联动。
- `components/`：工具栏、表格、详情抽屉、编辑弹窗。
- `*-management.ts`：表单初始值、校验、格式化、payload 构造。

示例：

- `pages/console/clients`
- `pages/console/attachments`
- `pages/console/oauth-providers`
- `pages/console/oauth-applications`

这和项目的前端约定一致：搜索、列表、编辑、详情尽量拆开，不把所有逻辑堆在一个文件里。

## 当前已落地的控制台页面

- 仪表盘：`dashboard`
- 身份与授权：`users`、`roles`、`permissions`、`explorer`
- 运行态：`audit`、`live`、`attachments`
- 系统配置：`menus`、`clients`、`oauthProviders`、`oauthApplications`

这些页面的入口不是写死在前端，而是由后端菜单树里的 `viewKey` 决定。

## 列表页的通用抽象

当前列表页复用最多的是这几组抽象：

- `usePageState`：把分页和筛选条件放进工作台状态，刷新页面也能恢复。
- `useResourceEditor`：统一处理新增 / 编辑弹窗。
- `useResourceDetail`：统一处理详情抽屉。
- `useResourceRemoval`：统一处理删除确认和错误反馈。
- `ListExportButton`：直接对接导出接口。
- `useDownload`：处理流式下载、文件名解析和进度显示。

典型例子：

- `pages/console/clients/ClientsView.vue`
- `pages/console/attachments/AttachmentsView.vue`
- `pages/console/oauth-providers/OAuthProvidersView.vue`
- `pages/console/oauth-applications/OAuthApplicationsView.vue`

补充约定：

- 如果后端列表接口本身支持分页，前端直接请求 `page` / `pageSize`。
- 如果后端暂时返回完整数组，前端页面会在筛选结果上做本地分页，但仍保持同一套表格、筛选和详情结构。
- OAuth 应用页的权限选择不再复用角色管理接口，而是走 `api.oauth.applications.permissions()`，避免权限边界串到 `role.*`。

## 控制台布局

控制台外壳在 `src/layouts/ConsoleLayout.vue`。

它负责：

- 侧边栏导航
- 顶部面包屑和用户菜单
- 页面标题、描述
- 工作台标签栏
- 主题和布局切换入口

页面本身不用重复实现这些公共结构。

## 新增一个控制台页面

1. 在 `pages/console/<module>` 创建 `View.vue`、`components/`、`*-management.ts`。
2. 为页面定义 `viewKey`，并确保页面注册表能识别它。
3. 在后端补权限码和菜单节点。
4. 页面列表查询走分页接口，导出按钮直接接 `api.<module>.export(...)`。
5. 如果页面需要保存筛选状态，使用 `usePageState(...)`。
6. 如果页面用到了新的共享 API、菜单入口或权限边界，同步更新 docs。
