---
title: Web 前端
description: Web 控制台的认证、动态路由、工作台状态、列表页抽象和页面组织方式。
---

## 先从哪些文件读起

1. `apps/web-frontend/src/api/client.ts`
2. `apps/web-frontend/src/stores/auth.ts`
3. `apps/web-frontend/src/stores/menus.ts`
4. `apps/web-frontend/src/stores/workbench.ts`
5. `apps/web-frontend/src/meta/pages.ts`

这五个文件能解释 Web 端最核心的问题：请求怎么发、登录态怎么存、路由怎么生成、工作台配置怎么同步。

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

## 分层关系

<MermaidDiagram
  label="Web frontend layers"
  :code="[
    'flowchart TB',
    '  Views[pages/console/*/View.vue]',
    '  PageComps[page components]',
    '  Reuse[composables + shared ui]',
    '  Stores[Pinia stores]',
    '  Client[api/client.ts]',
    '  Factory[packages/api-common createApiFactory]',
    '  Backend[(Backend API)]',
    '',
    '  Views --> PageComps',
    '  Views --> Reuse',
    '  Views --> Stores',
    '  Reuse --> Stores',
    '  Stores --> Client',
    '  Client --> Factory',
    '  Factory --> Backend',
  ].join('\n')"
/>

## API 客户端与登录态

`src/api/client.ts` 做了四件关键事：

- 读取本地 access token / refresh token
- 根据环境变量拼 Web 客户端请求头
- 401 时自动调用 `/api/auth/refresh`
- 刷新失败后跳回 `/login`

`api` 不是手写对象，而是基于 `createApiFactory(...)` 生成，所以 Web 和 Uni 能共享一套 API 面。

### 登录态时序

<MermaidDiagram
  label="Web bootstrap and login state"
  :code="[
    'sequenceDiagram',
    '  participant Page as Browser',
    '  participant Auth as auth store',
    '  participant API as api/client.ts',
    '  participant Backend as /api/auth/*',
    '  participant WB as workbench store',
    '',
    '  Page->>Auth: bootstrap()',
    '  alt has access token',
    '    Auth->>API: api.auth.me()',
    '    alt me success',
    '      API-->>Auth: current user',
    '      Auth->>WB: hydrateUserPreferences(user.preferences)',
    '    else 401',
    '      Auth->>API: api.auth.refresh(refreshToken)',
    '      API-->>Auth: new session',
    '      Auth->>WB: hydrateUserPreferences(...)',
    '    end',
    '  else no access token',
    '    Auth-->>Page: guest state',
    '  end',
  ].join('\n')"
/>

`src/stores/auth.ts` 负责：

- `bootstrap()`
- `login()`
- `register()`
- `logout()`
- 权限 / 角色判断

## 登录页

登录页在 `src/pages/console/auth/LoginView.vue`。

当前实现不是写死一套固定表单，而是服务端驱动：

- 先请求 `/api/auth/strategies`
- 获取登录策略、注册策略和 OAuth Provider
- 根据策略渲染本地登录 / 注册表单
- 点击第三方登录图标后跳转授权
- 回调后用 ticket 换本地会话

这让登录页文案、启用方式、策略开关、第三方入口都能由后端控制。

## 动态路由与菜单

核心文件：

- `src/router/index.ts`
- `src/stores/menus.ts`
- `src/meta/pages.ts`

### 菜单生成路由的过程

<MermaidDiagram
  label="Menu-driven routing"
  :code="[
    'sequenceDiagram',
    '  participant Router',
    '  participant Menus as menu store',
    '  participant API as api.menus.current()',
    '  participant Registry as pageRegistryMap',
    '',
    '  Router->>Menus: bootstrap(router)',
    '  Menus->>API: fetch current menu tree',
    '  API-->>Menus: MenuNodeRecord[]',
    '  Menus->>Menus: flatten PAGE nodes',
    '  Menus->>Registry: resolve by viewKey',
    '  Menus->>Router: addRoute(console-root, routeRecord)',
  ].join('\n')"
/>

这意味着：

- 后端菜单树决定用户看到什么页面
- 前端只维护 `viewKey -> component` 的注册表
- 页面新增时，不需要再维护一份和后端菜单重复的静态路由表

## 工作台状态与用户偏好

工作台状态在 `src/stores/workbench.ts`。

它维护：

- 主题 preset
- 侧边栏样式与收起状态
- 布局模式
- 页面切换动画
- 已访问标签页
- 页面级筛选状态

### 偏好同步规则

- 本地：`localStorage`
- 远端：`/api/auth/preferences`

同步过程：

- 登录或刷新成功后，`auth store` 调 `hydrateUserPreferences(...)`
- 用户修改工作台配置时，本地立即更新
- 远端更新通过 debounce 同步，避免频繁请求

这样做的结果是：重新登录后，控制台配置不会丢失。

## 页面组织方式

控制台页面统一采用这个结构：

```text
pages/console/<module>
├─ components/
├─ <Module>View.vue
└─ <module>-management.ts
```

职责划分：

- `View.vue`：页面编排、数据加载、事件联动
- `components/`：工具栏、表格、详情抽屉、编辑弹窗
- `*-management.ts`：表单初始值、校验、格式化、payload 构造

典型目录：

- `pages/console/clients`
- `pages/console/attachments`
- `pages/console/oauth-providers`
- `pages/console/oauth-applications`

## 列表页的通用抽象

当前列表页复用最多的是这几组抽象：

- `usePageState`：把分页和筛选条件放进工作台状态
- `useResourceEditor`：统一处理新增 / 编辑弹窗
- `useResourceDetail`：统一处理详情抽屉
- `useResourceRemoval`：统一处理删除确认和错误反馈
- `RelationSelectFormItem`：统一处理表单里的外键 / 关联选择
- `PermissionEditorDialog`：统一处理权限新增 / 编辑弹窗
- `ListExportButton`：统一处理导出按钮
- `useDownload`：处理流式下载、文件名解析和错误处理

### `RelationSelectFormItem` 的约定

- 传入分页接口，例如 `api.users.roles`、`api.roles.permissions`
- 同一个接口对象还必须提供 `resolve(ids)`，组件会在编辑态自动补齐已选项回显
- 搜索区不在组件内部写死，而是通过 `#search` 插槽自定义
- `params.xxx` 直接映射后端 body 字段
- 行渲染通过 `#row` 插槽自定义，并拿到 `selected / disabled / multiple / toggle`
- 只要使用 `#row`，业务侧就完全接管整行视觉，默认卡片和状态胶囊不会再自动渲染
- 组件支持单选和多选，并通过 `update:modelValue` 回填 id 或 ids
- 编辑弹窗打开前即使已经有 `id / ids`，组件也会先走 `resolve(ids)` 拿到展示字段，不需要用户先点开选择器

当前已经替换：

- 用户编辑里的角色分配
- 角色编辑里的权限分配
- OAuth 应用里的权限 scope 分配
- 菜单编辑里的权限绑定

### 菜单结构管理的行为编辑

菜单结构管理不是把目录、页面、行为三种类型强行渲染成同一张表单。

当前实现对行为节点单独做了裁剪：

- 不再暴露图标和副标题字段
- 标题字段改成“行为名称”
- 不再让用户直接填写“节点”类文案，目录 / 页面用“标识”，行为节点的标识默认按关联权限码推导
- 行为节点的权限选择直接复用 `RelationSelectFormItem`
- `RelationSelectFormItem` 的 `#trigger` 插槽里可以额外挂“新增权限”按钮
- 快捷新增权限复用共享的 `src/components/permissions/PermissionEditorDialog.vue`
- 左侧树里的行为节点不再显示图标和第二行说明，只保留名称和权限信息

这样做的目标是把“行为 = 一个带权限约束的操作”直接表达出来，而不是让用户再理解一层“节点字段”。

## 下载与导出

`src/composables/use-download.ts` 负责：

- 构造下载请求
- 透传客户端请求头和 token
- 处理流式下载进度
- 从 `Content-Disposition` 解析文件名
- 如果接口错误返回 JSON，则转成可读错误消息

后端的导出接口只需要返回 `DownloadRequestConfig`，前端不用每个页面再重复实现 `fetch -> blob -> a.click()`。

## 控制台布局

控制台外壳在 `src/layouts/ConsoleLayout.vue`，统一提供：

- 侧边栏导航
- 顶部面包屑和用户菜单
- 页面标题、描述
- 工作台标签栏
- 主题和布局切换入口

页面本身不需要重复实现这些公共结构。

## 新增一个控制台页面

1. 在 `pages/console/<module>` 创建 `View.vue`、`components/`、`*-management.ts`
2. 为页面定义 `viewKey`，并在页面注册表里注册
3. 在后端补权限码和菜单节点
4. 列表查询走分页接口，导出按钮直接接 `api.<module>.export(...)`
5. 如果页面有筛选状态，使用 `usePageState(...)`
6. 如果页面有外键 / 多对多选择，优先复用 `RelationSelectFormItem`
7. 页面能力变化后同步更新 docs
