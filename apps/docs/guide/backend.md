---
title: 后端实现
description: 后端服务的目录、请求链路、核心数据模型、统一治理能力和扩展方式。
---

## 先从哪些文件读起

如果你第一次排查后端问题，建议按这个顺序看：

1. `apps/backend/src/app.ts`
2. `apps/backend/src/routes/index.ts`
3. `apps/backend/src/routes/auth.ts` 或目标模块路由
4. `apps/backend/src/services/*`
5. `apps/backend/src/lib/prisma.ts`
6. `apps/backend/src/lib/delete-reference-checker.ts`

这样看能先建立“HTTP 请求从哪进、业务逻辑在哪、数据库治理在哪”的基本坐标。

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

## 应用入口与请求链路

`src/app.ts` 负责把所有基础设施接起来：

- `cors + helmet + cookieParser + morgan`
- `requestContextMiddleware`
- `/uploads` 静态目录
- `oauth2Router`
- `/api` 业务路由
- `errorHandler`

<MermaidDiagram
  label="Express request pipeline"
  :code="[
    'flowchart LR',
    '  REQ[HTTP Request]',
    '  CORS[cors / helmet / body parser]',
    '  CTX[requestContextMiddleware]',
    '  ROUTE[route module]',
    '  MW[middlewares]',
    '  SERVICE[service]',
    '  PRISMA[prisma extension]',
    '  DB[(PostgreSQL / Redis)]',
    '  ERR[errorHandler]',
    '',
    '  REQ --> CORS --> CTX --> ROUTE --> MW --> SERVICE --> PRISMA --> DB',
    '  ROUTE -.throw.-> ERR',
    '  MW -.throw.-> ERR',
    '  SERVICE -.throw.-> ERR',
  ].join('\n')"
/>

## 核心数据模型

### 认证 / RBAC

<MermaidDiagram
  label="Auth and RBAC entities"
  :code="[
    'erDiagram',
    '  USER {',
    '    string id PK',
    '    string username',
    '    string status',
    '    json preferences',
    '  }',
    '  AUTH_CLIENT {',
    '    string id PK',
    '    string code UK',
    '    string type',
    '    json config',
    '  }',
    '  REFRESH_TOKEN {',
    '    string id PK',
    '    string token',
    '    datetime expiresAt',
    '  }',
    '  USER_AUTHENTICATION {',
    '    string id PK',
    '    string identifier',
    '    string authType',
    '  }',
    '  ROLE {',
    '    string id PK',
    '    string code UK',
    '    string roleType',
    '  }',
    '  PERMISSION {',
    '    string id PK',
    '    string code UK',
    '    string module',
    '  }',
    '  USER_ROLE {',
    '    string id PK',
    '  }',
    '  ROLE_PERMISSION {',
    '    string id PK',
    '  }',
    '  MENU_NODE {',
    '    string id PK',
    '    string type',
    '    string viewKey',
    '  }',
    '  USER ||--o{ USER_AUTHENTICATION : binds',
    '  USER ||--o{ REFRESH_TOKEN : owns',
    '  AUTH_CLIENT ||--o{ REFRESH_TOKEN : issues',
    '  USER ||--o{ USER_ROLE : assigns',
    '  ROLE ||--o{ USER_ROLE : contains',
    '  ROLE ||--o{ ROLE_PERMISSION : grants',
    '  PERMISSION ||--o{ ROLE_PERMISSION : links',
    '  MENU_NODE }o--|| PERMISSION : binds',
  ].join('\n')"
/>

### OAuth / 附件

<MermaidDiagram
  label="OAuth and file entities"
  :code="[
    'erDiagram',
    '  OAUTH_PROVIDER {',
    '    string id PK',
    '    string code UK',
    '    string issuer',
    '  }',
    '  OAUTH_APPLICATION {',
    '    string id PK',
    '    string clientId UK',
    '    string responseTypes',
    '  }',
    '  OAUTH_STATE {',
    '    string id PK',
    '    string state UK',
    '    string kind',
    '  }',
    '  OAUTH_USER {',
    '    string id PK',
    '    string providerSubject',
    '  }',
    '  OAUTH_TOKEN {',
    '    string id PK',
    '    string kind',
    '    datetime expiresAt',
    '    datetime revokedAt',
    '  }',
    '  OAUTH_APPLICATION_PERMISSION {',
    '    string id PK',
    '  }',
    '  MEDIA_ASSET {',
    '    string id PK',
    '    string kind',
    '    string uploadStatus',
    '    string tag1',
    '    string tag2',
    '  }',
    '  USER ||--o{ OAUTH_USER : links',
    '  OAUTH_PROVIDER ||--o{ OAUTH_USER : maps',
    '  OAUTH_USER ||--o{ OAUTH_TOKEN : stores',
    '  OAUTH_APPLICATION ||--o{ OAUTH_STATE : starts',
    '  USER ||--o{ OAUTH_STATE : authorizes',
    '  OAUTH_APPLICATION ||--o{ OAUTH_APPLICATION_PERMISSION : exposes',
    '  PERMISSION ||--o{ OAUTH_APPLICATION_PERMISSION : scopes',
  ].join('\n')"
/>

这些图不是完整 schema 抄录，而是帮助第一次接触项目的人快速建立主关系。真实字段以 `prisma/schema.prisma` 为准。

## 认证与会话

认证主线在 `src/routes/auth.ts`。

### 登录链路时序

<MermaidDiagram
  label="Login request sequence"
  :code="[
    'sequenceDiagram',
    '  participant Client',
    '  participant ACM as authClientMiddleware',
    '  participant ACS as auth-clients.ts',
    '  participant Route as auth.ts',
    '  participant Service as auth-service.ts',
    '  participant Session as session-service.ts',
    '  participant Redis',
    '  participant DB as PostgreSQL',
    '',
    '  Client->>ACM: POST /api/auth/login + X-RBAC-Client-*',
    '  ACM->>ACS: authenticateAuthClient(...)',
    '  ACS->>DB: load AuthClient by code',
    '  ACS->>ACS: validate secret + request context',
    '  ACM-->>Route: req.authClient',
    '  Route->>Service: authService.login(payload)',
    '  Service->>DB: verify account / auth strategy',
    '  Route->>Session: issueUserSession(userId, client)',
    '  Session->>DB: create RefreshToken',
    '  Session->>Redis: cache refresh jti',
    '  Session-->>Route: accessToken + refreshToken + currentUser',
    '  Route-->>Client: session payload (+ cookie for WEB)',
  ].join('\n')"
/>

### 关键实现点

- `authClientMiddleware` 先识别客户端，再允许进入认证接口。
- `src/services/auth-clients.ts` 不只校验 `client secret`，还会按类型校验上下文：
  - `WEB`：校验协议、域名、端口和来源。
  - `UNI_WECHAT_MINIAPP`：校验 `appId`。
  - `APP`：校验 `packageName` 和 `platform`。
- `src/services/auth-service.ts` 负责解析策略、验证密码或验证码、创建账号绑定。
- `src/services/session-service.ts` 统一签发 access token / refresh token，并把 refresh token 写进数据库和 Redis。
- Web 登录成功后会额外设置浏览器 cookie，供 `/oauth2/authorize` 这样的浏览器协议链路复用。

### 当前认证策略

- `username-password`
- `email-code`
- `phone-code`

`/api/auth/strategies` 返回启用中的登录、注册、验证码策略，以及第三方 OAuth Provider 列表。Web 和 Uni 登录页都按这份服务端返回结果渲染，不在前端写死。

### 用户偏好持久化

- `/api/auth/preferences` 持久化到 `User.preferences`
- `/api/auth/me` 返回 `preferences`
- Web 工作台在登录、刷新、重新进入时都会从这里恢复配置

## RBAC 与菜单

RBAC 初始化在 `src/services/system-rbac.ts`。

- 权限目录来自 `packages/api-common/src/constants/permissions.ts`
- `bootstrapSystemRbac` 会写入权限、系统角色、默认菜单树
- 菜单树分为目录、页面、行为三类节点，对应 `MenuNodeType`

### 运行时约束

- API 权限检查走 `requirePermission(...)`
- `/api/menus/current` 根据当前用户权限返回菜单树
- 前端页面和按钮权限都依赖同一套菜单树与权限码
- 角色和权限选择的选项接口已经统一为 `POST + body` 分页协议

当前分页选项接口：

- `POST /api/users/options/roles`
- `POST /api/roles/options/permissions`
- `POST /api/menus/options/permissions`
- `POST /api/oauth/applications/options/permissions`

请求体约定：

- `page`、`pageSize` 是统一分页字段
- 业务过滤字段直接平铺在 body 上，例如 `q`、`code`、`name`、`module`、`action`
- 前端 `RelationSelectFormItem` 的 `params.xxx` 会直接映射到这些字段

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

### 授权码 + PKCE 链路

<MermaidDiagram
  label="OAuth authorization code + PKCE"
  :code="[
    'sequenceDiagram',
    '  participant App as OAuth Client App',
    '  participant Browser',
    '  participant Server as QC-RBAC /oauth2',
    '  participant DB as PostgreSQL',
    '',
    '  App->>Browser: redirect to /oauth2/authorize',
    '  Browser->>Server: GET /oauth2/authorize',
    '  Server->>Server: resolve browser session',
    '  alt not logged in',
    '    Server-->>Browser: redirect /login',
    '  else logged in',
    '    Server->>DB: create OAuthState',
    '    Server-->>Browser: render consent page',
    '    Browser->>Server: GET /oauth2/authorize/decision?approve',
    '    Server->>DB: persist authorization code',
    '    Server-->>Browser: redirect to application callback',
    '    Browser-->>App: code + state',
    '    App->>Server: POST /oauth2/token + code_verifier',
    '    Server->>DB: verify code and issue OAuthToken',
    '    Server-->>App: access_token + refresh_token + id_token',
    '    App->>Server: GET /oauth2/userinfo',
    '    Server-->>App: user claims',
    '  end',
  ].join('\n')"
/>

核心逻辑在 `src/services/oauth-auth-server.ts`，支持：

- authorization code
- refresh token
- PKCE
- OIDC `id_token`
- consent page
- token introspection / revoke

补充实现点：

- Consent 页的“同意 / 拒绝”走 `/oauth2/authorize/decision`，避免浏览器直接提交跨源表单造成状态混乱。
- Web 登录成功后写入的浏览器 session cookie 会被 `/oauth2/authorize` 读取，所以 Provider 链路不需要在授权页再做一次单独登录。

### 2. 我们作为 OAuth Client

- 外部 Provider 管理在 `src/routes/oauth.ts`
- 管理接口分为：
  - `/api/oauth/providers`
  - `/api/oauth/applications`
- OAuth 应用权限 scope 选择单独走 `POST /api/oauth/applications/options/permissions`

关键实现：

- `buildExternalProviderAuthorizeUrl` 生成跳转地址
- `handleExternalProviderCallback` 处理第三方回调
- `exchangeOAuthLoginTicket` 把一次性 ticket 换成本地会话
- 外部 access token / refresh token 落在 `OAuthToken`
- `oauth-upstream-refresh` 定时任务在过期前刷新上游 token
- 如果上游返回 `invalid_grant`，会撤销本地 `EXTERNAL_REFRESH_TOKEN`，避免之后持续无效重试
- 如果第三方 subject 变化但仍映射到同一个本地用户，会复用已有 `(userId, providerId)` 关联而不是重复插入

## 文件上传与附件

上传链路分成两层。

### 1. 上传计划

- `POST /api/files/presign`
- `src/services/file-upload.ts` 创建 `MediaAsset`
- 返回上传策略、对象键、回调信息

### 2. 附件管理

- `src/routes/attachments.ts` 提供列表、详情、编辑、删除、导出
- `MediaAsset` 支持 `tag1`、`tag2` 作为业务筛选字段
- 删除附件前先删存储对象，再软删除数据库记录

补偿任务：

- `src/timers/upload-reconcile.timer.ts`
- 定时检查 `PENDING` 记录
- 如果对象已存在但前端没回调，会补写为 `COMPLETED`

## Excel 导出

后端导出统一走 `src/utils/excel-export.ts`。

`createExcelExportHandler` 只要求模块提供：

- `parseQuery`
- `queryRows`
- `columns`
- `fileName`
- `sheetName`

`columns` 支持两种形式：

- 直接传静态列数组，保持流式写入
- 传函数 `({ query, rows }) => columns`，先基于导出记录生成列头，再写入工作表，适合动态指标列

当前已接入：

- users
- roles
- permissions
- clients
- audit logs
- realtime messages
- attachments

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

- 引用关系不是手写的
- 它会从 Prisma 的模型关系信息生成入向引用映射
- 只要 schema 里关系正确，删除保护就能识别

这意味着新增实体关系后，不需要在每个删除接口里重复写“先查是否被引用”。

## 定时任务

正式 timer 注册入口在 `src/timers/index.ts`。

当前内置：

- `oauth-upstream-refresh`
- `upload-reconcile`

新增后台任务时，沿着 `defineIntervalTimer -> createBackendTimerRegistry` 扩展，不要写成独立脚本。

## 测试

后端测试已经拆成两层：

- `apps/backend/test/framework`
- `apps/backend/test/integration`
- `apps/backend/test/support/backend-testkit.ts`

优先读这些测试文件：

- `framework/delete-reference-checker.test.ts`
- `framework/excel-export.test.ts`
- `integration/auth.test.ts`
- `integration/oauth.test.ts`
- `integration/rbac.test.ts`

它们基本覆盖了认证、授权、OAuth、删除保护、导出和权限链路的主行为。

## 新增后端模块的最短路径

1. 在 `schema.prisma` 增加模型和关系。
2. 如果模型需要统一审计 / 软删除，把模型名加入 `src/lib/prisma.ts` 的受管集合。
3. 在 `packages/api-common` 增加共享类型和 API 工厂方法。
4. 在 `src/routes` 新增路由，在 `src/services` 放核心逻辑。
5. 如果是后台可见模块，补权限码并更新 `system-rbac.ts` 菜单种子。
6. 如果是列表页，直接接 `createExcelExportHandler`。
7. 在对应的 `framework` 或 `integration` 测试补用例，并同步更新 docs。
