---
title: 后端实现
description: 后端服务的目录、请求链路、核心模块和扩展方式。
---

## 目录结构

```text
apps/backend
├─ prisma
│  ├─ schema.prisma
│  └─ seed-data.ts
└─ src
   ├─ app.ts
   ├─ config
   ├─ lib
   ├─ middlewares
   ├─ routes
   ├─ services
   ├─ timers
   └─ utils
```

常用目录分工：

- `routes/`：HTTP 协议入口，做参数解析、权限检查、响应包装。
- `services/`：核心业务逻辑。
- `middlewares/`：认证、客户端识别、权限校验、错误处理。
- `lib/`：Prisma、Redis 等基础设施层。
- `timers/`：正式注册的后台任务。
- `utils/`：token、审计、持久化、文件、RBAC 映射等通用工具。

## 应用入口

- `src/app.ts` 负责中间件注册、静态上传目录、OAuth/OIDC 协议路由和 `/api` 路由挂载。
- `src/routes/index.ts` 统一挂载业务模块：
  - `/api/auth`
  - `/api/users`
  - `/api/roles`
  - `/api/permissions`
  - `/api/menus`
  - `/api/clients`
  - `/api/oauth`
  - `/api/files`
  - `/api/attachments`
  - `/api/realtime`
  - `/api/audit-logs`
- `src/routes/oauth2.ts` 单独暴露 OAuth/OIDC 协议端点，不挂在 `/api` 下。

## 认证与会话

认证主线在 `src/routes/auth.ts`。

### 1. 先校验客户端，再校验用户

- `authClientMiddleware` 读取 `X-RBAC-Client-*` 请求头。
- `src/services/auth-clients.ts` 会按客户端类型做额外校验：
  - `WEB`：校验协议、域名、端口和允许来源。
  - `UNI_WECHAT_MINIAPP`：校验 `appId`。
  - `APP`：校验包名和平台。
- 客户端类型和配置结构由 `packages/api-common/src/types/auth-client.ts` 统一定义。

### 2. 再按策略处理登录和注册

- `src/services/auth-service.ts` 负责解析认证策略、验证密码或验证码、创建账号绑定。
- 当前种子策略：
  - `username-password`
  - `email-code`
  - `phone-code`
- `/api/auth/strategies` 返回启用中的登录、注册、验证码策略列表，前端按这个结果决定表单。

### 3. 会话生成与偏好同步

- `issueUserSession` 在 `src/services/session-service.ts` 中生成 access token 和 refresh token。
- Refresh token 同时写入数据库 `RefreshToken` 和 Redis。
- Web 客户端额外通过 `setBrowserSessionCookie` 同步浏览器 cookie。
- 用户配置通过 `/api/auth/preferences` 持久化到 `User.preferences`，`/api/auth/me` 会把它带回前端。

## RBAC 与菜单

RBAC 初始化在 `src/services/system-rbac.ts`。

- 权限目录来自 `packages/api-common/src/constants/permissions.ts`。
- `bootstrapSystemRbac` 会写入：
  - 权限
  - 系统角色
  - 默认菜单树
- 默认菜单树包含目录、页面、行为三类节点，对应 `MenuNodeType`。

运行时约束：

- API 权限检查走 `requirePermission(...)` 中间件。
- 前端菜单来源于 `/api/menus/current`，并不是写死在前端路由里。
- 页面权限和按钮权限都来自同一套菜单树与权限码。
- 角色和权限选择用到的选项接口已经统一成“`POST + body` 查询对象”，避免前端弹窗一次性拉全量数据。

当前分页选项接口：

- `POST /api/users/options/roles`
- `POST /api/roles/options/permissions`
- `POST /api/menus/options/permissions`
- `POST /api/oauth/applications/options/permissions`

请求体约定：

- `page`、`pageSize` 是统一分页字段。
- 业务过滤字段直接平铺在 body 上，例如 `q`、`code`、`name`、`module`、`action`。
- 前端 `RelationSelectFormItem` 的 `params.xxx` 直接映射到这些字段，不需要再把搜索 UI 或 URL query 约束写死在组件里。

## OAuth / OIDC

后端同时实现两条链路。

### 1. 我们作为 Provider

协议端点在 `src/routes/oauth2.ts`：

- `/.well-known/openid-configuration`
- `/oauth2/jwks`
- `/oauth2/authorize`
- `/oauth2/token`
- `/oauth2/userinfo`
- `/oauth2/introspect`
- `/oauth2/revoke`
- `/oauth2/logout`

核心逻辑在 `src/services/oauth-auth-server.ts`，支持：

- authorization code
- refresh token
- PKCE
- OIDC `id_token`
- consent page
- token introspection / revoke

实现细节：

- Consent 页的“同意 / 拒绝”走同源链接跳转到 `/oauth2/authorize/decision`，避免浏览器在严格 CSP 下拦截表单提交。

### 2. 我们作为 OAuth Client

- 外部 Provider 的管理接口在 `src/routes/oauth.ts`。
- 管理接口当前分成两组：
  - `/api/oauth/providers`
  - `/api/oauth/applications`
- OAuth 应用还额外提供 `POST /api/oauth/applications/options/permissions`，用于给应用分配可暴露的 permission scope。
- 登录页拉取启用中的 `OAuthProvider`。
- `buildExternalProviderAuthorizeUrl` 生成跳转地址。
- `handleExternalProviderCallback` 处理第三方回调。
- `exchangeOAuthLoginTicket` 把一次性 ticket 换成本地会话。
- 外部 access token / refresh token 会落在 `OAuthToken` 表。
- OAuth 用户关联优先按 `(providerId, providerSubject)` 匹配；如果 subject 变化但还是同一个本地用户，会复用已有 `(userId, providerId)` 关联并更新 subject，避免重复建链。

Web 控制台对应的管理页面已经落地：

- `/console/oauth/providers`
- `/console/oauth/applications`

## 文件上传与附件

上传主链路分成两层：

### 1. 上传计划

- `POST /api/files/presign`
- `src/services/file-upload.ts` 创建 `MediaAsset`
- 返回上传策略、对象键、回调信息

### 2. 附件管理

- `src/routes/attachments.ts` 提供附件列表、详情、编辑、删除、导出
- `MediaAsset` 现在包含 `tag1`、`tag2`，可作为业务筛选字段
- 删除附件前会先删存储对象，再软删除数据库记录

上传补偿：

- `src/timers/upload-reconcile.timer.ts` 定时检查 `PENDING` 记录
- 如果对象已存在但前端没回调，会补写为 `COMPLETED`

## Excel 导出

后端导出统一走 `src/utils/excel-export.ts`。

`createExcelExportHandler` 只要求每个模块提供：

- `parseQuery`
- `queryRows`
- `columns`
- `fileName`
- `sheetName`

当前已接入：

- users
- roles
- permissions
- clients
- audit logs
- realtime messages
- attachments

这让每个模块只维护自己的查询逻辑，不重复处理 Excel stream、响应头和文件名。

## 数据层统一治理

### Prisma 扩展

`src/lib/prisma.ts` 统一处理：

- Snowflake ID
- `createId` / `updateId`
- 软删除
- 默认过滤 `deleteAt = null`

对受管模型执行 `delete` 时，实际会转成更新 `deleteAt`。

### 删除引用检查

`src/lib/delete-reference-checker.ts` 会在删除前自动检查引用关系。

关键点：

- 引用关系不是手写的。
- 它直接从 `Prisma.dmmf.datamodel.models` 生成入向引用映射。
- 只要模型之间在 Prisma schema 中有关系，删除保护就能识别。

这意味着新增实体关系后，不需要在每个业务删除接口里重复写“先查是否被引用”。

## 定时任务

正式 timer 注册入口在 `src/timers/index.ts`。

当前内置：

- `oauth-upstream-refresh`
- `upload-reconcile`

新增后台任务时，沿着 `defineIntervalTimer -> createBackendTimerRegistry` 的路径扩展，不要写成独立脚本。

## 测试

后端测试已经拆成两层：

- `apps/backend/test/framework`
- `apps/backend/test/integration`
- `apps/backend/test/support/backend-testkit.ts`

当前已经覆盖的主链路包括：

- 客户端校验
- 登录、注册、刷新、登出
- 策略化认证
- 偏好持久化
- RBAC 与菜单
- OAuth / OIDC
- 上传与附件
- 列表导出
- 客户端管理
- 删除保护
- OAuth 管理权限边界

按文件查看时：

- `framework/delete-reference-checker.test.ts` 验证删除引用检查器。
- `framework/excel-export.test.ts` 验证导出抽象。
- `integration/*.test.ts` 验证真实业务链路。

完整测试清单见 [测试用例](/guide/testing)。

## 新增后端模块的最短路径

1. 在 `schema.prisma` 增加模型和关系。
2. 如果模型需要统一审计 / 软删除，把模型名加入 `src/lib/prisma.ts` 的受管集合。
3. 在 `packages/api-common` 增加共享类型和 API 工厂方法。
4. 在 `src/routes` 新增路由，在 `src/services` 放核心逻辑。
5. 如果是后台可见模块，补权限码并更新 `system-rbac.ts` 菜单种子。
6. 如果是列表页，直接接 `createExcelExportHandler`。
7. 在对应的 `framework` 或 `integration` 测试文件补测试，并同步更新 docs。
