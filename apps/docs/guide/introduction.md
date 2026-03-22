---
title: 介绍
description: QC-RBAC 的仓库边界、模块分工和适用范围。
---

`QC-RBAC` 是一个用于认证、授权、多端接入的 monorepo。它不是演示模板，重点在于把系统级能力先做成稳定边界，再让业务接上来。

## 适用场景

- 需要统一账号体系的 Web 控制台。
- 需要 Web、微信小程序、App 共用认证协议的项目。
- 需要 RBAC、菜单驱动路由和审计日志的后台系统。
- 需要同时支持 OAuth/OIDC Provider 和第三方登录的身份服务。
- 需要把文件上传、附件管理、Excel 导出做成正式模块的项目。

## 仓库分工

| 目录 | 作用 | 你通常会在这里改什么 |
| --- | --- | --- |
| `apps/backend` | 后端服务 | Prisma 模型、路由、service、timer、权限检查 |
| `apps/web-frontend` | Web 控制台 | 登录页、控制台页面、动态路由、工作台设置 |
| `apps/app-frontend` | uni-app 移动端 | 登录注册、门户、个人页、设置页、自定义组件 |
| `apps/oauth-test-provider` | 外部 OAuth 测试服务 | 联调第三方登录 |
| `apps/oauth-test-application` | OAuth 客户端测试应用 | 联调本系统作为 Provider |
| `packages/api-common` | 共享协议层 | 类型、权限常量、客户端枚举、请求封装、API 工厂 |

## 当前主模块

| 模块 | 关键对象 | 主要入口 |
| --- | --- | --- |
| 认证与会话 | `AuthClient`、`AuthStrategy`、`UserAuthentication`、`RefreshToken` | `apps/backend/src/routes/auth.ts` |
| RBAC 与菜单 | `Permission`、`Role`、`MenuNode` | `apps/backend/src/services/system-rbac.ts` |
| OAuth/OIDC | `OAuthProvider`、`OAuthApplication`、`OAuthState`、`OAuthUser`、`OAuthToken` | `apps/backend/src/routes/oauth.ts`、`apps/backend/src/routes/oauth2.ts` |
| 上传与附件 | `MediaAsset` | `apps/backend/src/routes/files.ts`、`apps/backend/src/routes/attachments.ts` |
| 导出与下载 | Excel 导出工厂、下载组合式 | `apps/backend/src/utils/excel-export.ts`、`apps/web-frontend/src/composables/use-download.ts` |
| 移动端布局 | 自定义 Header、Tabbar、安全区 | `apps/app-frontend/src/composables/useAppLayout.ts` |
| 测试体系 | `framework`、`integration`、`backend-testkit` | `apps/backend/test/**` |

## 关键约定

- 权限常量统一定义在 `packages/api-common/src/constants/permissions.ts`。
- 后端列表接口统一返回 `items + meta`，Web 列表页默认做分页和导出。
- 后端如果暂时没有分页接口，Web 页面会在筛选结果上做前端分页，但接口结构仍优先按分页标准设计。
- Web 控制台路由不手写在固定表里，而是由菜单树和 `viewKey` 动态注册。
- Uni 前端不依赖第三方 UI 库，页面基础组件全部在 `components/` 中自定义。
- 受管模型的软删除、审计字段、Snowflake ID、删除引用检查统一放在 Prisma 扩展层。
- 文档需要跟代码一起更新，尤其是新增页面、接口、共享抽象和测试时。

## 推荐先读的文件

```text
apps/backend/src/app.ts
apps/backend/src/routes/auth.ts
apps/backend/src/services/system-rbac.ts
apps/backend/src/lib/prisma.ts
apps/web-frontend/src/stores/menus.ts
apps/web-frontend/src/stores/workbench.ts
apps/app-frontend/src/api/client.ts
apps/app-frontend/src/components/app-page-shell/app-page-shell.vue
packages/api-common/src/api/factory.ts
packages/api-common/src/types/auth-client.ts
```
