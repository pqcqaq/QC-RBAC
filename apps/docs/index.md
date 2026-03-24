---
layout: home
title: QC-RBAC
titleTemplate: false
hero:
  name: QC-RBAC
  text: 认证、授权、多端接入的一体化基础工程
  tagline: 面向开发者的实现文档。重点讲清楚仓库结构、请求链路、核心数据模型、现有抽象和扩展方式。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 开发指南
      link: /guide/development
    - theme: alt
      text: 实时通信
      link: /guide/realtime
    - theme: alt
      text: 后端实现
      link: /guide/backend
features:
  - title: Backend
    details: Express 5 + Prisma。认证、RBAC、OAuth/OIDC、上传、请求审计、导出、定时任务都在这里实现。
  - title: Web Console
    details: Vue 3 + Pinia + Vue Router。菜单驱动动态路由，工作台配置会同步到当前用户。
  - title: Uni Frontend
    details: uni-app + 自定义组件。Header、Tabbar、安全区和登录态都由项目自己控制。
  - title: Shared Contract
    details: packages/api-common 统一客户端枚举、共享类型、请求客户端、实时协议适配器和 API 工厂。
  - title: Realtime
    details: 标准 WebSocket + topic 订阅协议。支持连接关联、心跳、自动重连和前后端 topic 同步。
  - title: Built-in Components
    details: Web 已沉淀出可复用的关联选择组件，文档会同步记录参数、插槽和后端约定。
  - title: OAuth
    details: 同时支持 OAuth/OIDC Provider 与第三方登录客户端模式，包含 PKCE、刷新与用户映射。
  - title: Testing
    details: 后端测试已拆成 framework + integration 两层，分别覆盖删除保护、导出抽象、认证、OAuth、RBAC、附件、客户端和后台管理主链路。
---

## 建议阅读顺序

1. 先读 [快速开始](/guide/quick-start)，把数据库、后端、Web、Uni 跑起来。
2. 再读 [开发指南](/guide/development)，建立仓库整体地图。
3. 需要理解后端主链路时，直接看 [后端实现](/guide/backend)。
4. 需要改控制台页面时，先看 [Web 前端](/guide/web-frontend) 和 [内置组件](/components/)。
5. 需要改移动端页面时，先看 [Uni 前端](/guide/uni-frontend)。
6. 需要新增协议、请求头、客户端类型或共享 API 时，先看 [共享抽象](/guide/shared)。
7. 需要理解 websocket、topic、心跳和组件级订阅方式时，直接看 [实时通信](/guide/realtime)。
8. 动代码前先看 [测试用例](/guide/testing) 和 [扩展指南](/guide/extension)。

## 主链路总览

<MermaidDiagram
  label="QC-RBAC runtime map"
  :code="[
    'flowchart LR',
    '  subgraph Clients',
    '    WEB[Web Console]',
    '    UNI[Uni Frontend]',
    '    OAPP[OAuth Test Application]',
    '    OPROV[Demo Provider]',
    '  end',
    '  SHARED[packages/api-common]',
    '  API[apps/backend /api]',
    '  OAUTH[apps/backend /oauth2]',
    '  DB[(PostgreSQL)]',
    '  REDIS[(Redis)]',
    '  TIMER[Timers]',
    '',
    '  WEB --> SHARED',
    '  UNI --> SHARED',
    '  SHARED --> API',
    '  API --> DB',
    '  API --> REDIS',
    '  OAPP --> OAUTH',
    '  OAUTH --> DB',
    '  OPROV --> API',
    '  TIMER --> API',
    '  TIMER --> DB',
  ].join('\n')"
/>

图中各层职责如下：

- `packages/api-common` 是多端共用协议层，负责共享类型、客户端头、请求客户端、实时协议和 API 工厂。
- 实时链路也已经收敛到共享层和后端 hub，详见 [实时通信](/guide/realtime)。
- `apps/backend /api` 提供后台管理、认证、文件、附件、客户端管理、OAuth 管理等业务接口。
- `apps/backend /oauth2` 提供标准 OAuth2 / OIDC Provider 端点。
- Web 和 Uni 都不自己拼请求协议，优先复用 `api-common` 生成的客户端和 API 面。
- 后端的持久化主库是 PostgreSQL，会话和部分缓存依赖 Redis。

## 文档覆盖什么

- 后端实现：认证、RBAC、菜单、OAuth/OIDC、文件上传、附件管理、RequestRecord / Operation 请求审计、Excel 导出、BackendRuntimeContext、自动事务、受管 Prisma、删除保护、定时任务。
- Web 前端：登录页、动态菜单路由、工作台状态、分页列表、导出、页面结构和表单关系选择。
- Uni 前端：登录注册、门户、个人中心、设置、自定义 Header / Tabbar / Safe Area、多端客户端识别。
- 共享抽象：客户端类型、共享类型、请求核心、平台适配器、实时协议、API 工厂、下载请求配置。
- 测试体系：framework / integration 拆分、测试基建、mock OAuth Provider、各测试文件覆盖点。

## 仓库结构

```text
simple-project-demo
├─ apps
│  ├─ backend                  # Express + Prisma + PostgreSQL + Redis
│  ├─ web-frontend             # Web 控制台
│  ├─ app-frontend             # uni-app 移动端
│  ├─ oauth-test-provider      # 外部 OAuth Provider 测试服务
│  ├─ oauth-test-application   # OAuth Client 测试应用
│  └─ docs                     # 当前文档站
└─ packages
   └─ api-common               # 共享类型、请求抽象、实时协议、API 工厂
```

## 常见阅读入口

| 你要做什么 | 先看哪里 |
| --- | --- |
| 修登录、刷新、登出问题 | `/guide/backend` 的认证与会话 + `/guide/web-frontend` 或 `/guide/uni-frontend` 的登录态部分 |
| 新增后台资源页面 | `/guide/backend`、`/guide/web-frontend`、`/guide/extension` |
| 新增客户端类型 | `/guide/shared`、`/guide/backend`、`/guide/extension` |
| 接 websocket 推送、排查订阅或心跳问题 | `/guide/realtime` |
| 排查 OAuth Provider / 第三方登录 | `/guide/backend` 的 OAuth 章节 + `/guide/testing` 的 `oauth.test.ts` |
| 理解为什么删除被阻止 | `/guide/backend` 的删除引用检查章节 + `framework/delete-reference-checker.test.ts` |
| 给列表加导出 | `/guide/backend` 的 Excel 导出 + `/guide/web-frontend` 的 `useDownload` / `ListExportButton` |
