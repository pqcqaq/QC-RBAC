---
title: 介绍
description: QC-RBAC 的仓库边界、模块分工和第一次进入项目时的定位方式。
---

`QC-RBAC` 是一个面向正式业务的认证与授权基础工程。它不是只演示登录的脚手架，而是把账号体系、客户端识别、RBAC、菜单路由、OAuth/OIDC、附件、导出、测试和文档统一收进一个 monorepo。

## 它主要解决什么问题

- Web 控制台、微信小程序、App 需要共用一套认证和会话协议。
- 后台管理需要 RBAC、菜单驱动页面、审计日志、文件上传和导出。
- 系统既要能作为 OAuth/OIDC Provider，也要能接第三方登录。
- 前后端不希望重复维护权限码、客户端类型、请求头和 API 类型。
- 需要把“删除保护、分页、导出、关系选择、测试”做成可复用规则，而不是每个模块都重写一遍。

## 系统边界

<MermaidDiagram
  label="Repository boundaries"
  :code="[
    'flowchart TB',
    '  subgraph apps',
    '    BACKEND[backend]',
    '    WEB[web-frontend]',
    '    UNI[app-frontend]',
    '    DOCS[docs]',
    '    OTP[oauth-test-provider]',
    '    OTA[oauth-test-application]',
    '  end',
    '  SHARED[packages/api-common]',
    '  DB[(PostgreSQL)]',
    '  REDIS[(Redis)]',
    '',
    '  WEB --> SHARED',
    '  UNI --> SHARED',
    '  BACKEND --> SHARED',
    '  BACKEND --> DB',
    '  BACKEND --> REDIS',
    '  OTA --> BACKEND',
    '  BACKEND --> OTP',
    '  DOCS -.documents.-> BACKEND',
    '  DOCS -.documents.-> WEB',
    '  DOCS -.documents.-> UNI',
    '  DOCS -.documents.-> SHARED',
  ].join('\n')"
/>

## 仓库分工

| 目录 | 作用 | 你通常会在这里改什么 |
| --- | --- | --- |
| `apps/backend` | 后端服务 | Prisma 模型、路由、service、timer、权限检查 |
| `apps/web-frontend` | Web 控制台 | 登录页、控制台页面、动态路由、工作台设置 |
| `apps/app-frontend` | uni-app 移动端 | 登录注册、门户、个人页、设置页、自定义组件 |
| `apps/oauth-test-provider` | 外部 OAuth 测试服务 | 联调第三方登录 |
| `apps/oauth-test-application` | OAuth 客户端测试应用 | 联调本系统作为 Provider |
| `apps/docs` | 文档站 | 实现说明、图示、组件文档、测试说明 |
| `packages/api-common` | 共享协议层 | 类型、权限常量、客户端枚举、请求封装、API 工厂 |

## 从需求到代码怎么找

| 功能 | 后端入口 | 前端入口 | 共享入口 |
| --- | --- | --- | --- |
| 登录 / 注册 / 刷新 | `apps/backend/src/routes/auth.ts` | `apps/web-frontend/src/stores/auth.ts`、`apps/app-frontend/src/store/token.ts` | `packages/api-common/src/api/factory.ts` |
| 客户端校验 | `apps/backend/src/services/auth-clients.ts` | `apps/web-frontend/src/api/client.ts`、`apps/app-frontend/src/api/client.ts` | `packages/api-common/src/types/auth-client.ts` |
| RBAC / 菜单 | `apps/backend/src/services/system-rbac.ts`、`apps/backend/src/routes/menus.ts` | `apps/web-frontend/src/stores/menus.ts` | `packages/api-common/src/constants/permissions.ts` |
| OAuth Provider | `apps/backend/src/routes/oauth2.ts` | `apps/oauth-test-application` | 无 |
| 第三方登录 | `apps/backend/src/routes/oauth.ts`、`apps/backend/src/services/oauth-auth-server.ts` | `apps/web-frontend/src/pages/console/auth/LoginView.vue` | `packages/api-common/src/api/factory.ts` |
| 导出下载 | `apps/backend/src/utils/excel-export.ts` | `apps/web-frontend/src/composables/use-download.ts` | `packages/api-common/src/client/core.ts` |
| 关系选择器 | 资源 `options` 接口 | `apps/web-frontend/src/components/form/RelationSelectFormItem.vue` | `OptionSearchPayload` |

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

## 第一次阅读建议

1. 想知道系统是怎么启动的，先看 `apps/backend/src/app.ts` 和 `apps/web-frontend/src/api/client.ts`。
2. 想知道一个登录请求怎么流转，先看 `apps/backend/src/routes/auth.ts`、`apps/backend/src/services/auth-clients.ts`、`apps/backend/src/services/session-service.ts`。
3. 想知道控制台为什么能动态出菜单和路由，先看 `apps/backend/src/routes/menus.ts`、`apps/web-frontend/src/stores/menus.ts`、`apps/web-frontend/src/meta/pages.ts`。
4. 想知道 Uni 为什么能适配 H5 / App / 小程序，先看 `apps/app-frontend/src/api/client.ts`、`apps/app-frontend/src/composables/useAppLayout.ts`、`apps/app-frontend/src/tabbar/config.ts`。
5. 想知道共享协议怎么抽象，先看 `packages/api-common/src/types/auth-client.ts` 和 `packages/api-common/src/api/factory.ts`。

## 当前统一约定

- 权限常量只在 `packages/api-common/src/constants/permissions.ts` 维护。
- 后端列表接口统一返回 `items + meta`，分页字段统一为 `page` / `pageSize`。
- Web 列表导出统一使用 `createExcelExportHandler + useDownload + ListExportButton`。
- 表单里的关联选择统一使用 `RelationSelectFormItem`，搜索区通过插槽传入，不在组件内部写死。
- Uni 页面统一使用自定义组件和 `navigationStyle: 'custom'`。
- 受管模型的 Snowflake ID、审计字段、软删除、删除引用检查统一在 Prisma 扩展层处理。
- 任何有行为变化的改动都要同步测试和文档。
