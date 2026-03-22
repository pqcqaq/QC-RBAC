---
title: 开发指南
description: 当前项目里的认证、RBAC、OAuth、上传、导出与多端协作是如何真正落地的。
---

这页不做概念科普，只解释当前仓库里的实现方式。阅读时建议同时打开对应代码文件，这样最容易建立真实心智模型。

<div class="doc-index">
  <a href="/guide/introduction">先回到介绍页看整体边界</a>
  <a href="/architecture/tech-stack">并行参考技术选型</a>
</div>

## 1. 请求从哪里进入系统

后端统一从 `apps/backend/src/routes/index.ts` 挂载业务模块。当前主要入口包括：

| 路由前缀 | 作用 |
| --- | --- |
| `/api/auth` | 登录、注册、验证码、会话、第三方登录回调、用户偏好 |
| `/api/users` `/api/roles` `/api/permissions` | RBAC 主体与权限管理 |
| `/api/menus` | 控制台菜单树与权限映射 |
| `/api/clients` | 多客户端管理与配置 |
| `/api/oauth` | OAuth Provider / Application 管理后台 |
| `/api/files` | 上传预签名、分片、本地回调 |
| `/api/audit-logs` | 审计日志查询与导出 |
| `/api/realtime` | 实时消息与导出 |

常见分层方式是：

- route 负责接入协议与入参校验
- middleware 负责鉴权、client 识别、权限检查
- service 负责实际业务流程
- prisma / utils 负责数据治理、token、安全等通用能力

## 2. 认证为什么是 Client + Strategy 两层

这套系统里，登录并不是“传用户名密码就结束”。所有认证请求都会先经过 `authClientMiddleware`：

- 从请求头读取 `X-RBAC-Client-Code`
- 读取 `X-RBAC-Client-Secret`
- 调用 `authenticateHeadersClient`
- 校验当前请求到底来自哪个系统级 client

只有 client 身份成立，才会继续进入 `authService` 处理认证策略。

<MermaidDiagram
  label="Client + Strategy Login Flow"
  :code="[
    'sequenceDiagram',
    '  participant UI as Web or Uni',
    '  participant CM as authClientMiddleware',
    '  participant AS as authService',
    '  participant SS as session-service',
    '  participant DB as Prisma / DB',
    '',
    '  UI->>CM: client code + client secret',
    '  CM->>DB: authenticateHeadersClient()',
    '  DB-->>CM: resolved AuthClient',
    '  UI->>AS: login or register payload',
    '  AS->>DB: resolve strategy + identity',
    '  AS->>SS: issueUserSession(userId, client)',
    '  SS->>DB: persist RefreshToken',
    '  SS-->>UI: accessToken + refreshToken + user',
  ].join('\n')"
/>

这层设计解决了两个问题：

- 同一套认证接口可以同时服务 Web、小程序、App
- client 本身可以带类型与配置，例如 Web 的协议 / 域名 / 端口，小程序的 `appId` / `appSecret`

对应的数据模型主要是：

- `AuthClient`
- `AuthStrategy`
- `UserAuthentication`
- `VerificationCode`
- `RefreshToken`

相关代码重点看：

- `apps/backend/src/middlewares/auth-client.ts`
- `apps/backend/src/config/auth-clients.ts`
- `apps/backend/src/routes/auth.ts`
- `apps/backend/src/services/session-service.ts`

## 3. 认证策略如何决定登录与注册行为

系统当前内置三种策略：

- `username-password`
- `email-code`
- `phone-code`

`/api/auth/strategies` 会根据当前启用状态返回策略列表，前端登录页再根据策略动态渲染输入项。策略模型里可单独控制：

- 是否启用
- 是否允许登录
- 是否允许注册
- 是否允许验证码验证
- 是否启用 mock

这意味着“登录页长什么样”不是固定模板，而是服务端策略的投影。

## 4. 会话、浏览器 Cookie 与用户偏好如何协作

`issueUserSession` 会同时生成：

- access token
- refresh token
- 当前用户信息
- 当前 client 摘要

refresh token 会落到数据库 `RefreshToken` 表，同时在 Redis 写入 `refresh:${jti}`，便于后续校验与吊销。

对于 Web client，`auth.ts` 里还有一个专门的 `syncBrowserSession`：

- 登录成功后写浏览器 session cookie
- 刷新成功后更新 cookie
- 登出后清空 cookie

用户设置不会只存在前端状态里。`/api/auth/preferences` 会把偏好写入 `User.preferences` JSON 字段，
`/api/auth/me` 再把它们一并带回前端，这样重新登录后不会丢失设置。

## 5. RBAC 为什么和菜单系统放在一起讲

因为这个项目的控制台不是“有权限就能看所有写死路由”。真正的控制台入口来自三件事的组合：

- 系统权限目录
- 用户拥有的角色与权限
- 菜单树上为页面节点分配的权限

系统种子在 `apps/backend/src/services/system-rbac.ts` 里完成：

- `permissionCatalog` 先灌入权限目录
- 再生成系统角色
- 最后根据默认菜单树创建 `MenuNode`

<MermaidDiagram
  label="RBAC and Menu Bootstrap"
  :code="[
    'flowchart TD',
    '  CATALOG[permissionCatalog]',
    '  PERM[Permission Seeds]',
    '  ROLE[System Roles]',
    '  MENU[MenuNode Tree]',
    '  USERROLE[UserRole]',
    '  ROLEPERM[RolePermission]',
    '  WEB[Web Menu Store]',
    '  ROUTER[Dynamic Console Routes]',
    '',
    '  CATALOG --> PERM',
    '  PERM --> ROLE',
    '  PERM --> MENU',
    '  ROLE --> USERROLE',
    '  PERM --> ROLEPERM',
    '  MENU --> WEB',
    '  WEB --> ROUTER',
  ].join('\n')"
/>

Web 端的关键点在 `apps/web-frontend/src/stores/menus.ts`：

- 先拉取当前用户菜单树
- 把页面节点统一映射到 `/console/**`
- 通过 `viewKey` 找到页面注册表里的组件
- 动态注入到 `console-root` 下面

所以你给某个页面加权限，本质上是在改菜单树和权限映射，而不是直接改前端路由表。

## 6. OAuth / OIDC 如何同时支持 Provider 和第三方登录

这个项目有两条 OAuth 主线，且都已经落地：

### 6.1 我们作为 OAuth / OIDC Provider

第三方应用可以把本系统当作认证中心使用。核心对象包括：

- `OAuthApplication`
- `OAuthApplicationPermission`
- `OAuthState`
- `OAuthToken`

授权流程支持：

- authorization code
- refresh token
- PKCE
- OIDC `id_token`
- token introspection / revoke / userinfo / discovery / JWKS

### 6.2 我们作为 OAuth Client 接第三方登录

登录页下方可以读取启用中的外部 `OAuthProvider`，用户点击后会经历：

- 获取 provider authorize url
- 浏览器跳去第三方授权
- 第三方回调本系统 `/api/auth/oauth/providers/:code/callback`
- 系统创建一次性 login ticket
- 浏览器回到登录页，用 ticket 交换本地登录会话

<MermaidDiagram
  label="Provider + External Login Combined View"
  :code="[
    'sequenceDiagram',
    '  participant App as Third-party App',
    '  participant Core as RBAC OAuth Service',
    '  participant Browser as Browser User',
    '  participant Ext as External Provider',
    '',
    '  App->>Core: /oauth2/authorize + PKCE',
    '  Core-->>Browser: login or consent',
    '  Browser->>Core: approve request',
    '  Core-->>App: authorization code',
    '  App->>Core: /oauth2/token',
    '  Core-->>App: access_token / refresh_token / id_token',
    '',
    '  Browser->>Core: ask external provider authorize url',
    '  Core-->>Browser: redirect to Ext',
    '  Browser->>Ext: authorize',
    '  Ext-->>Core: callback code',
    '  Core-->>Browser: login ticket',
    '  Browser->>Core: exchange ticket',
    '  Core-->>Browser: local session',
  ].join('\n')"
/>

外部 provider 的 access token 与 refresh token 也会被保存到 `OAuthToken`，并通过后台定时任务在过期前 5 分钟尝试刷新，
从而支持长周期访问上游资源。

重点代码：

- `apps/backend/src/services/oauth-auth-server.ts`
- `apps/backend/src/routes/auth.ts`
- `apps/backend/src/routes/oauth.ts`
- `apps/backend/src/timers/oauth-upstream-refresh.timer.ts`

## 7. 文件上传和补偿为什么不是一次性 happy path

上传能力的设计目标是“即使浏览器没完整回调，也尽量把状态收回来”。当前主流程是：

1. 前端请求 `/api/files/presign`
2. 后端创建 `MediaAsset`，写入上传策略、objectKey、uploadToken 等元数据
3. 前端按返回计划上传到本地或 S3 兼容存储
4. 上传完成后调用 `/api/files/callback`
5. 后端 `finalizeUpload`，写入最终 URL 与 ETag

如果是单片直传到 S3，但前端没来得及回调，后台 `upload-reconcile` timer 会巡检 `PENDING` 记录：

- 如果对象已存在，则直接补记为 `COMPLETED`
- 如果长时间仍不存在，则标记为 `FAILED`

这就是为什么上传不是一条接口，而是一套“计划 -> 上传 -> 回调 -> 巡检”的闭环。

## 8. Excel 导出与前端下载如何解耦

后端的思路是：每个列表页自己保留查询逻辑，但把“如何导出 Excel”抽象成统一工厂。

### 后端

`apps/backend/src/utils/excel-export.ts` 暴露了 `createExcelExportHandler`，调用时只需要提供：

- `parseQuery`
- `queryRows`
- `columns`
- `fileName`
- `sheetName`

各模块只负责把自己的查询条件和列定义传进去。这样 `users`、`roles`、`permissions`、`clients`、`audit`、`realtime`
都能用同一套导出实现。

### 前端

Web 端的 `useDownload` 负责：

- 统一拼接下载请求
- 自动带认证重试
- 处理流式响应与下载进度
- 从 `content-disposition` 解析文件名
- 触发浏览器实际保存

列表页只需要给 `ListExportButton` 一个下载 API 配置函数即可。

这让“查询”和“导出”保持一致，但又不会把下载细节塞进每个页面组件里。

## 9. Prisma 扩展层如何统一审计、Snowflake 和软删除

项目没有要求每个 service 手动补审计字段，而是把这件事放进 `apps/backend/src/lib/prisma.ts`：

- `create` / `createMany` 自动补 `id`、`createId`、`updateId`
- `update` / `updateMany` 自动补 `updateId`
- `delete` / `deleteMany` 实际会转成 `update deleteAt`
- `findFirst` / `findMany` / `count` 等默认过滤 `deleteAt != null`

这样仓库里所有受管模型都天然获得：

- Snowflake 主键
- 审计人信息
- 软删除语义

如果你在业务里看到 `prisma.xxx.delete(...)`，它并不是真的物理删除。

## 10. 定时任务是正式模块，不是脚本补丁

`apps/backend/src/timers/index.ts` 会注册两类正式 timer：

- `oauth-upstream-refresh`
- `upload-reconcile`

这说明系统已经把“后台补偿”视为服务能力的一部分，而不是某个部署文档里的手工脚本。

当你以后继续加：

- 清理任务
- token 回收任务
- 报表任务
- 数据一致性检查

都应该沿用这条 timer registry 路径继续扩展。

## 11. 新功能建议怎么接入

如果你要继续在这个仓库开发新能力，优先遵循下面的路径：

1. 先看是否属于已有模块，尽量延续现有 route / service / store 结构。
2. 如果涉及权限，先补 `permissionCatalog`，再决定是否挂到菜单树。
3. 如果涉及新端接入，先定义 client 类型与 config 结构，不要只塞一个 secret。
4. 如果涉及列表导出，直接复用 `createExcelExportHandler` 与 `useDownload`。
5. 如果涉及后台补偿或长周期任务，优先放入 timer registry，而不是外部脚本。

## 12. 推荐直接打开的文件

```text
apps/backend/src/routes/auth.ts
apps/backend/src/services/oauth-auth-server.ts
apps/backend/src/services/system-rbac.ts
apps/backend/src/config/auth-clients.ts
apps/backend/src/utils/excel-export.ts
apps/backend/src/lib/prisma.ts
apps/web-frontend/src/router/index.ts
apps/web-frontend/src/stores/menus.ts
apps/web-frontend/src/composables/use-download.ts
packages/api-common/src/constants/permissions.ts
```

如果只允许读十个文件，先从这里开始，基本就能建立整套系统的主干认知。
