---
title: Uni 前端
description: uni-app 端的认证、页面结构、自定义布局和跨端适配方式。
---

## 先从哪些文件读起

1. `apps/app-frontend/src/api/client.ts`
2. `apps/app-frontend/src/store/token.ts`
3. `apps/app-frontend/src/composables/useAppLayout.ts`
4. `apps/app-frontend/src/tabbar/config.ts`
5. `apps/app-frontend/src/components/app-page-shell/app-page-shell.vue`

这几处分别对应请求协议、登录态、Safe Area 计算、Tabbar 策略和页面壳。

## 目录结构

```text
apps/app-frontend/src
├─ api
├─ components
├─ composables
├─ hooks
├─ http
├─ pages
├─ store
├─ tabbar
├─ types
└─ utils
```

## 当前页面

当前移动端已经实现：

- `pages/auth/login.vue`
- `pages/auth/register.vue`
- `pages/index/index.vue`
- `pages/me/me.vue`
- `pages/me/profile.vue`
- `pages/settings/index.vue`

## 平台适配层级

<MermaidDiagram
  label="Uni frontend layers"
  :code="[
    'flowchart TB',
    '  Pages[pages/*]',
    '  Shell[AppPageShell + app components]',
    '  Layout[useAppLayout + tabbar config]',
    '  Store[token store / user store]',
    '  Api[api/client.ts]',
    '  Shared[packages/api-common]',
    '  Backend[(Backend API)]',
    '',
    '  Pages --> Shell',
    '  Pages --> Store',
    '  Shell --> Layout',
    '  Store --> Api',
    '  Api --> Shared',
    '  Shared --> Backend',
  ].join('\n')"
/>

## 认证与请求

Uni 端请求入口在 `src/api/client.ts`。

这里做了几件事：

- 根据条件编译推断默认客户端类型
- H5 调试固定按 `WEB` 处理，默认使用 `web-uni-h5`
- 小程序请求头自动带 `appId`
- App 请求头自动带 `packageName` / `platform`
- 通过 `createUniAdaptor()` 生成统一请求客户端
- 通过 `createUniWsAdaptor()` 生成统一 realtime 客户端
- 401 时自动 refresh，失败后清理本地状态

### 实时客户端

Uni 端 realtime 预配置同样在 `src/api/client.ts`：

- `wsClient`
- `realtimeWsUrl`

页面级消费入口在：

```text
apps/app-frontend/src/hooks/useWsTopic.ts
```

这层已经封装：

- H5 下基于 query token 的握手
- App / 小程序下基于 header 的握手
- 自动订阅与自动解绑
- 无 topic 时自动断开
- 有 topic 时自动连接
- 指数退避重连
- 心跳应答

完整说明和 API 清单见 [实时通信](/guide/realtime)。

### 客户端类型选择规则

| 运行环境 | 默认客户端类型 | 关键 config |
| --- | --- | --- |
| 微信小程序 | `UNI_WECHAT_MINIAPP` | `appId` |
| App | `APP` | `packageName`、`platform` |
| H5 / 浏览器 | `WEB` | `protocol`、`host`、`port` |

H5 调试之所以固定走 `WEB`，是因为浏览器环境不应该拿小程序 client 去请求认证接口。

### 启动与刷新时序

<MermaidDiagram
  label="Uni bootstrap and refresh"
  :code="[
    'sequenceDiagram',
    '  participant App as Uni App',
    '  participant Token as token store',
    '  participant API as appApi',
    '  participant Backend as /api/auth/*',
    '',
    '  App->>Token: bootstrap()',
    '  alt has access token and not expired',
    '    Token->>API: getUserInfo()',
    '    API-->>Token: current user',
    '  else access expired but refresh valid',
    '    Token->>API: refreshToken()',
    '    API-->>Token: new session',
    '    Token->>API: getUserInfo()',
    '  else no valid session',
    '    Token-->>App: guest state',
    '  end',
  ].join('\n')"
/>

登录态主要在 `src/store/token.ts`：

- `bootstrap()`
- `login()`
- `register()`
- `logout()`
- `refreshToken()`
- `tryGetValidToken()`

## 自定义 Header、Tabbar 和安全区

Uni 端没有使用第三方 UI 库，布局基础全是自定义组件。

关键文件：

- `src/composables/useAppLayout.ts`
- `src/components/app-page-shell/app-page-shell.vue`
- `src/components/app-nav-bar/app-nav-bar.vue`
- `src/tabbar/index.vue`
- `src/utils/systemInfo.ts`

### Safe Area 计算

<MermaidDiagram
  label="Safe area and tabbar calculation"
  :code="[
    'flowchart LR',
    '  SYS[systemInfo + safeAreaInsets]',
    '  TOP[statusBarHeight / safeTop]',
    '  NAV[resolveNavigationBarHeight()]',
    '  HEADER[headerHeight]',
    '  BOTTOM[safeBottom]',
    '  TAB[tabbarHeight]',
    '  VARS[CSS variables]',
    '',
    '  SYS --> TOP',
    '  SYS --> BOTTOM',
    '  TOP --> NAV --> HEADER',
    '  BOTTOM --> TAB',
    '  HEADER --> VARS',
    '  TAB --> VARS',
  ].join('\n')"
/>

`useAppLayout()` 会输出统一 CSS 变量：

- `--app-safe-top`
- `--app-safe-bottom`
- `--app-nav-height`
- `--app-header-height`
- `--app-tabbar-height`

这样页面组件不需要自己重复计算刘海、安全区和底部导航高度。

## 页面外壳与公共组件

页面默认包在 `AppPageShell` 中，统一处理：

- Header 标题
- 返回逻辑
- 内容区边距
- 安全区补偿

业务组件主要放在 `src/components/`，当前常用的有：

- `AppButton`
- `AppInput`
- `AppList`
- `AppListItem`
- `AppSection`
- `AppStatus`
- `AppTag`
- `AppAvatar`

这套组件存在的意义不是追求复杂视觉，而是让 App、H5、微信小程序都能走同一套样式语义和交互规则。

## 页面组织方式

当前页面都比较轻，主要依赖公共组件和 store 拼装：

- 登录页：账号密码登录，底部提供注册入口
- 注册页：完成基础注册
- 门户页：展示概览、快捷入口、最近动态
- 我的页：展示当前用户、角色、状态和登录操作
- 设置页：展示已同步的控制台偏好

请求一般通过：

- `src/api/*.ts`
- `appApi`
- Pinia store

## Tabbar

自定义 Tabbar 相关文件：

- `src/tabbar/config.ts`
- `src/tabbar/store.ts`
- `src/tabbar/index.vue`

特点：

- 默认使用自定义 Tabbar
- 启动时隐藏原生 Tabbar
- 自动处理底部安全区
- 可按页面判断是否显示底部导航

`src/tabbar/config.ts` 里的 `selectedTabbarStrategy` 负责决定当前平台是否使用自定义 Tabbar。

## 条件编译约定

移动端实现里几个关键点依赖条件编译：

- 小程序环境识别：`MP-WEIXIN`
- App 环境识别：`APP-PLUS`
- H5 默认降级成 `WEB` client

因此新增平台行为时，优先放在：

- `src/api/client.ts`
- `src/composables/useAppLayout.ts`
- `src/utils/systemInfo.ts`

不要把平台分支散落到每个页面里。

## 新增一个移动端页面

1. 在 `src/pages` 下新增页面文件
2. 页面用 `navigationStyle: 'custom'`，默认走自定义 Header
3. 使用 `AppPageShell`
4. 如果是 Tabbar 页面，补 `src/tabbar/config.ts`
5. 请求统一走 `appApi`，不要直接散写 `uni.request`
6. 如果涉及登录态或用户信息，优先放到 store 层
