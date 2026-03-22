---
title: 介绍
description: 从项目定位、能力边界到目录结构，先理解它适合用来做什么。
---

这不是一个“页面先跑起来再补权限”的仓库。它从一开始就把认证、授权、客户端识别、菜单驱动路由、数据审计、
上传补偿和 OAuth/OIDC 这些底层能力做成明确模块，目的是把项目起点抬高到“可继续演进”，而不是“能演示”。

<div class="doc-index">
  <a href="/guide/quick-start">继续阅读：快速开始</a>
  <a href="/guide/development">继续阅读：开发指南</a>
</div>

## 项目定位

这套工程适合以下类型的系统作为起点：

- 企业内部中后台与运营控制台
- SaaS 管理台与账号中心
- 需要 Web 控制台 + 移动端统一认证的项目
- 需要 OAuth2 / OIDC Provider 能力的身份平台
- 需要从第一天就保留审计、软删除与权限治理的业务系统

它不适合把业务页面快速堆满、暂时不考虑身份边界的项目。这个仓库的核心价值，恰恰在于先把系统级边界做好。

## 核心能力一览

| 模块 | 解决的问题 | 关键对象 / 入口 |
| --- | --- | --- |
| Client + Strategy 认证 | 区分接入方并按策略处理登录、注册、验证码 | `AuthClient`、`AuthStrategy`、`UserAuthentication`、`VerificationCode` |
| 会话与偏好持久化 | Web Cookie 同步、refresh token、用户设置落库 | `/api/auth/*`、`RefreshToken`、`User.preferences` |
| RBAC 与菜单驱动控制台 | 控制台导航、权限来源、动态路由 | `Permission`、`Role`、`MenuNode` |
| OAuth / OIDC | 作为 Provider 服务别人，或接外部第三方登录 | `OAuthProvider`、`OAuthApplication`、`OAuthState`、`OAuthToken` |
| 文件上传与补偿 | 单片、本地、S3 上传与后台巡检 | `MediaAsset`、`/api/files/*`、timers |
| Excel 导出与下载 | 列表页按查询条件导出全部结果 | `createExcelExportHandler`、`useDownload` |
| 多端共享 API 边界 | 避免 Web 与移动端各自复制协议逻辑 | `packages/api-common` |

## 系统视角

<MermaidDiagram
  label="Core Runtime Model"
  :code="[
    'flowchart LR',
    '  subgraph Frontend[Frontends]',
    '    WEB[Vue Web Console]',
    '    UNI[uni-app Mobile]',
    '  end',
    '',
    '  subgraph Shared[Shared Boundary]',
    '    COMMON[api-common]',
    '  end',
    '',
    '  subgraph Backend[Express Backend]',
    '    ROUTES[Routes]',
    '    SERVICES[Services]',
    '    TIMERS[Timers]',
    '  end',
    '',
    '  DB[(PostgreSQL)]',
    '  REDIS[(Redis)]',
    '',
    '  WEB --> COMMON',
    '  UNI --> COMMON',
    '  COMMON --> ROUTES',
    '  ROUTES --> SERVICES',
    '  SERVICES --> DB',
    '  SERVICES --> REDIS',
    '  TIMERS --> SERVICES',
  ].join('\n')"
/>

这个图里最重要的不是技术名词，而是边界关系：

- Web 与移动端不直接定义自己的权限协议，而是走共享包。
- 后端路由层只负责接请求与鉴权，主要业务逻辑下沉到 service。
- 后台定时任务不是旁路脚本，而是和业务 service 共用同一套模型与配置。

## 仓库结构

```text
simple-project-demo
├─ apps
│  ├─ backend                  # Express + Prisma + PostgreSQL + Redis
│  ├─ web-frontend             # Vue 3 控制台与公共前台
│  ├─ app-frontend             # uni-app 移动端
│  ├─ oauth-test-provider      # 本地 OAuth Provider 测试服务
│  ├─ oauth-test-application   # 本地 OAuth 客户端测试应用
│  └─ docs                     # 当前 VitePress 文档站
└─ packages
   └─ api-common               # 请求配置、共享类型、权限常量
```

这个结构的含义很直接：不同终端是独立应用，但协议与能力边界要统一收敛。

## 项目已经内建的系统种子

- 系统权限目录来自 `packages/api-common/src/constants/permissions.ts`
- 系统角色和默认菜单来自 `apps/backend/src/services/system-rbac.ts`
- 默认客户端、认证策略、演示账号和 OAuth 测试数据来自 `apps/backend/prisma/seed-data.ts`

这意味着你在本地初始化数据库后，拿到的不是空壳，而是一套可立即联调的完整骨架。

## 建议阅读顺序

1. 先看 [快速开始](/guide/quick-start)，把项目跑起来。
2. 再看 [技术选型](/architecture/tech-stack)，理解为什么边界是这样组织的。
3. 最后看 [开发指南](/guide/development)，再去改代码和加功能。
