---
layout: home
title: QC-RBAC
titleTemplate: false
hero:
  name: QC-RBAC
  text: 认证、授权、多端接入的一体化基础工程
  tagline: 面向开发者的文档。重点讲仓库结构、运行方式、实现细节、现有抽象和扩展路径。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 开发指南
      link: /guide/development
    - theme: alt
      text: 后端实现
      link: /guide/backend
features:
  - title: Backend
    details: Express 5 + Prisma。认证、RBAC、OAuth/OIDC、上传、导出、定时任务都在这里实现。
  - title: Web Console
    details: Vue 3 + Pinia + Vue Router。菜单驱动动态路由，工作台配置会同步到当前用户。
  - title: Uni Frontend
    details: uni-app + 自定义组件。Header、Tabbar、安全区和登录态都由项目自己控制。
  - title: Shared Contract
    details: packages/api-common 统一权限常量、客户端枚举、请求客户端、适配器和 API 工厂。
  - title: OAuth
    details: 同时支持 OAuth/OIDC Provider 与第三方登录客户端模式，包含 PKCE、刷新与用户映射。
  - title: Testing
    details: 后端测试已拆成 framework + integration 两层，分别覆盖删除保护、导出抽象、认证、OAuth、RBAC、附件、客户端和后台管理主链路。
---

## 文档范围

- 后端实现：认证、RBAC、OAuth/OIDC、上传、附件、导出、定时任务、Prisma 扩展。
- Web 前端：登录、动态路由、工作台状态、分页列表、导出、页面组织方式。
- Uni 前端：登录注册、门户、个人页、设置页、自定义 Header / Tabbar / 安全区。
- 共享抽象：`api-common` 里的类型、权限常量、请求客户端、适配器、API 工厂。
- 测试体系：框架级测试、业务集成测试、测试基建与运行方式。
- 扩展方式：新增模块、新增客户端类型、新增列表页、新增导出与测试怎么接。

## 仓库结构

```text
simple-project-demo
├─ apps
│  ├─ backend                  # Express + Prisma + PostgreSQL + Redis
│  ├─ web-frontend             # Web 控制台
│  ├─ app-frontend             # uni-app 移动端
│  ├─ oauth-test-provider      # OAuth Provider 测试服务
│  ├─ oauth-test-application   # OAuth Client 测试应用
│  └─ docs                     # 当前文档站
└─ packages
   └─ api-common               # 共享类型、权限常量、请求抽象、API 工厂
```

## 核心入口

| 场景 | 入口文件 |
| --- | --- |
| 后端应用启动 | `apps/backend/src/app.ts` |
| API 路由挂载 | `apps/backend/src/routes/index.ts` |
| OAuth/OIDC 协议路由 | `apps/backend/src/routes/oauth2.ts` |
| 数据治理 | `apps/backend/src/lib/prisma.ts` |
| Web API 客户端 | `apps/web-frontend/src/api/client.ts` |
| Web 动态菜单 | `apps/web-frontend/src/stores/menus.ts` |
| Uni API 客户端 | `apps/app-frontend/src/api/client.ts` |
| Uni 页面外壳 | `apps/app-frontend/src/components/app-page-shell/app-page-shell.vue` |
| 共享 API 工厂 | `packages/api-common/src/api/factory.ts` |

## 阅读顺序

1. 先看 [快速开始](/guide/quick-start)，把数据库、后端、Web、Uni 跑起来。
2. 再看 [开发指南](/guide/development)，建立整体实现地图。
3. 按需进入 [后端实现](/guide/backend)、[Web 前端](/guide/web-frontend)、[Uni 前端](/guide/uni-frontend)、[共享抽象](/guide/shared)。
4. 要补测试或排查回归时，直接看 [测试用例](/guide/testing)。
5. 真正开始加功能时，再看 [扩展指南](/guide/extension)。
