---
title: 后端实现
description: 后端服务的目录、请求链路、核心数据模型、统一治理能力和扩展方式。
---

## 先从哪些文件读起

如果你第一次排查后端问题，建议按这个顺序看：

1. `apps/backend/src/main.ts`
2. `apps/backend/src/app.ts`
3. `apps/backend/src/routes/index.ts`
4. `apps/backend/src/routes/auth.ts` 或目标模块路由
5. `apps/backend/src/services/*`
6. `apps/backend/src/lib/backend-runtime-context.ts`
7. `apps/backend/src/lib/runtime-transaction.ts`
8. `apps/backend/src/lib/prisma.ts`
9. `apps/backend/src/lib/delete-reference-checker.ts`
10. `apps/backend/src/lib/entity-relation-graph.ts`

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
   ├─ topics
   ├─ timers
   └─ utils
```

常用目录分工：

- `routes/`：HTTP 协议入口，做参数解析、权限检查、响应包装。
- `services/`：核心业务逻辑。
- `middlewares/`：认证、客户端识别、权限校验、错误处理。
- `lib/`：Prisma、Redis 等基础设施层。
- `timers/`：正式注册的后台任务。
- `utils/`：token、持久化、文件、RBAC 映射等通用工具。

## 编译产物

后端的生产构建现在走 `tsdown`，不再是单纯的 `tsc` 直出：

- `pnpm --filter @rbac/backend build`
  - 先执行 `prisma generate`
  - 再把 `src/main.ts` 打成 Node ESM bundle
- 默认产物入口是 `apps/backend/dist/src/main.mjs`
- `@rbac/api-common` 会在构建时一起被 bundle 进后端产物，避免把整个 workspace 包原样带进运行时
- 构建开启了 sourcemap 和 tree shaking，运行时启动脚本会带 `--enable-source-maps`

这套编译链路的目标不是把所有依赖都硬塞进一个可执行文件，而是：

- 让后端自己的源码和 workspace 内共享代码得到 bundling / tree shaking
- 继续保留 Node / Prisma 运行时依赖的兼容性
- 把生产构建和开发启动解耦，各自针对运行场景优化

开发态入口也已经更新成更轻量的 watcher 组合：

- `pnpm --filter @rbac/backend dev`
  - 启动 `nodemon`
  - 每次启动或重启前先执行一次 `prisma generate`
  - 然后再执行 `tsx src/main.ts`
- `src/**/*.ts`、`prisma/**/*.prisma`、`.env` 变化后，后端进程会自动热重启
- `prisma/generated/**/*.ts` 会被显式忽略，不参与 watcher 触发；schema 变化时由重启前的 `prisma generate` 重新生成 client

这里的“热重载”更准确地说是“进程级热重启”：

- 不做模块级 HMR 注入
- 但源码、配置和 Prisma schema 变更后，不需要手工停掉再重开服务

## 实时网关

后端实时入口现在在：

```text
apps/backend/src/lib/socket.ts
```

这里不再使用 `socket.io`，而是标准 `ws` + 自定义协议层。

当前 hub 负责：

- HTTP `upgrade` 握手与 access token 鉴权
- 同一用户、多连接、多客户端的连接索引
- topic 订阅索引
- `sub:ack / unsub:ack` 同步前后端 topic 状态
- topic 分发工具 `publishRealtimeMessage(...)`
- 心跳 `ping / pong`
- 心跳超时断开和客户端重连协作

围绕订阅授权，后端现在又补了两层：

- `src/topics/*.ts` 负责注册 topic 目录、订阅权限码和生命周期回调，新增 topic 时不再把逻辑散落在 `socket.ts`。
- `src/services/realtime-topic-auth.ts` 负责把 `RealtimeTopic` 表、用户权限、topic 通配覆盖判断和 Redis 缓存组合起来，统一处理 `sub` 请求授权。

现有事件已经映射成 topic：

- `/chat/global/message`
- `/system/presence/changed`
- `/system/audit/event`
- `/system/users/<userId>/rbac-updated`

具体协议、后端导出方法和前端接入方式，统一看 [实时通信](/guide/realtime)。

### 订阅授权管理

运行时订阅授权的后台 CRUD 入口是：

- `apps/backend/src/routes/realtime-topics.ts`
- `apps/backend/src/services/system-rbac.ts`
- `apps/backend/src/utils/rbac-records.ts`

这层现在负责：

- 把 `RealtimeTopic` 暴露成独立管理资源，而不是把 topic 绑定写死在前端或 shared 常量里。
- 通过 `/api/realtime-topics/options/permissions` 复用权限选择器协议。
- 保护系统注册 topic：系统 topic 由 `src/topics/*.ts` 和 `system-rbac.ts` seed，同步到数据库后只允许查看，不允许在后台直接改写或删除。
- 自定义 topic 绑定允许完整 CRUD，用于后续扩展业务订阅面。

## 应用入口与请求链路

`src/app.ts` 负责把所有基础设施接起来：

- `cors + helmet + cookieParser + morgan`
- `requestContextMiddleware`
- `/uploads` 静态目录
- `oauth2Router`
- `/api` 业务路由
- `errorHandler`

`src/main.ts` 则负责进程级启动顺序：

- 创建 HTTP server
- 初始化 websocket hub
- bootstrap 系统 RBAC
- 打印一次当前 Prisma schema 的实体关联关系摘要
- 启动 HTTP 监听和 timer registry

启动期的实体关系输出现在默认是“紧凑纯文本”：

- 第一行汇总 `models / edges / components`
- 后面按连通分量打印，每个分量只占少量行
- `nodes=` 只展示模型预览，`relations=` 用压缩形式展示真实外键边，例如 `UserRole.user->User(userId=id,!)`
- `! / ? / *` 分别表示 `required / optional / list`

如果要临时展开更多内容：

- `RBAC_PRINT_RELATION_GRAPH_DETAILS=1`
  - 继续打印逐模型的 `outgoing / incoming` 明细
- `RBAC_PRINT_RELATION_GRAPH_MERMAID=1`
  - 额外打印可复制的 Mermaid `erDiagram` 源码

关系图的 schema 解析方案现在也是固定的，不再依赖额外第三方 AST 库：

- 入口在 `src/lib/entity-relation-graph.ts`
- 启动时直接读取 Prisma Client 内部挂着的 `client._engineConfig.inlineSchema`
  - 也就是当前进程实际使用的那份内联 `schema.prisma`
  - 不需要再额外去磁盘读文件
- 解析过程是轻量字符串解析：
  - 先按 `model Xxx { ... }` 切出每个 model block
  - 再把 block 内字段语句按括号平衡拼接完整，跳过 `@@index` 这类 model-level 语句
  - 只提取显式 `@relation(fields: [...], references: [...])` 的字段来生成边
- 每条边都会保留：
  - `sourceModel / sourceField`
  - `targetModel`
  - `fields -> references` 映射
  - 字段基数 `required / optional / list`
  - 可选的 relation name
- 解析结果会按整份 schema 字符串做缓存
  - 同一份 schema 在同一进程内只解析一次
- 如果 Prisma 没暴露 `inlineSchema`，启动期就只打印 `relation graph unavailable`，不会影响后端继续启动

### 请求运行时与事务边界

当前后端不是直接在路由里裸用 Prisma，而是先进入统一运行时：

- `requestContextMiddleware` 先创建根 `BackendRuntimeContext`，生成或透传 `x-request-id`，把 `req`、`res`、根数据库客户端和请求级审计状态放进 `AsyncLocalStorage`
- 所有异步接口都要通过 `asyncHandler(...)` 进入，框架会在这里自动开启事务
- `asyncHandler(...)` 内部调用 `runInBackendRuntimeTransaction(...)`，默认使用 `Serializable` 隔离级别
- 接口执行成功时自动提交；抛错时自动回滚；错误继续交给 `errorHandler`
- 服务层如果确实需要显式事务块，使用 `runInBackendRuntimeTransaction(...)`；如果当前请求已经在事务内，它不会重复开启嵌套事务
- 请求结束后，框架会把这次请求聚合成一条 `RequestRecord`，并把每次 `select/create/update/delete/...` 聚合成多条 `Operation`

这意味着“请求上下文读取”和“数据库连接选择”都不应该散落在业务代码里自己拼装，而是统一从运行时获取。

### 后端编写约定

后端代码现在按下面的边界写：

- `routes/*` 负责路由注册、Zod 校验、权限中间件、HTTP 参数解析和响应格式
- `services/*` 放真正的业务逻辑、关系同步、事务块和跨模型写操作
- `utils/*` 放 DTO 映射、分页、导出、审计、RBAC 读取这类可复用工具
- `lib/*` 放运行时上下文、事务入口、Prisma、Redis、Socket 这类基础设施

写接口时先遵守这几个规则：

- 异步路由统一走 `asyncHandler(...)`
- 需要登录态的路由先挂 `authMiddleware`
- 需要权限的路由用 `requirePermission(...)` 或 `requireAnyPermission(...)`
- 默认数据库入口用 `prisma`
- 只有在需要原始表访问、恢复软删除关系、批量同步中间表、或显式 transaction client 时才使用 `prismaRaw`
- 只有框架初始化、进程启动、定时任务启动或请求结束后的审计落库这类请求外逻辑，才允许直接用 root Prisma client

典型写法：

```ts
resourceRouter.post(
  '/',
  authMiddleware,
  requirePermission('resource.create'),
  asyncHandler(async (req, res) => {
    const payload = resourcePayloadSchema.parse(req.body);
    return ok(res, await createResource(payload), 'Resource created');
  }),
);
```

```ts
export const createResource = async (payload: ResourcePayload) => {
  const row = await prisma.resource.create({
    data: withSnowflakeId({
      code: payload.code,
      name: payload.name,
    }),
  });

  return toResourceRecord(row);
};
```

服务层如果确实要把多步写操作锁成一个业务事务，使用：

```ts
await runInBackendRuntimeTransaction(async (runtime) => {
  const tx = runtime.dbRaw;
  // multi-step writes here
});
```

如果接口为了协议兼容必须自己写错误响应，例如 OAuth2 返回标准 JSON 错误、302 redirect 或 HTML 错页，响应写出后要调用 `rollbackHandledResponse()`，否则 `asyncHandler(...)` 会把这次请求当成成功提交。

### 当前 API 路由分组

| 路由前缀 | 路由文件 | 说明 |
| --- | --- | --- |
| `/api/health` | `src/routes/index.ts` | 健康检查 |
| `/api/auth` | `src/routes/auth.ts` | 认证、会话、策略发现、第三方登录 ticket 交换、用户偏好与头像 |
| `/api/dashboard` | `src/routes/dashboard.ts` | 控制台汇总数据 |
| `/api/users` / `/api/roles` / `/api/permissions` / `/api/menus` / `/api/clients` | 对应资源路由 | 后台管理资源与选择器接口 |
| `/api/oauth` | `src/routes/oauth.ts` | 外部 OAuth Provider 与 OAuth Application 管理 |
| `/api/files` / `/api/attachments` | `src/routes/files.ts` / `src/routes/attachments.ts` | 上传计划、上传回调、附件管理 |
| `/api/audit-logs` | `src/routes/audit.ts` | 请求审计日志查询与导出 |
| `/api/realtime` / `/api/realtime-topics` | `src/routes/realtime.ts` / `src/routes/realtime-topics.ts` | 实时消息历史、消息发送、订阅授权绑定管理 |

<MermaidDiagram
  label="Express request pipeline"
  :code="[
    'flowchart LR',
    '  REQ[HTTP Request]',
    '  CORS[cors / helmet / body parser]',
    '  CTX[requestContextMiddleware]',
    '  ROUTE[route module]',
    '  MW[middlewares]',
    '  AH[asyncHandler]',
    '  TX[runInBackendRuntimeTransaction]',
    '  SERVICE[service]',
    '  PRISMA[managed prisma / prismaRaw]',
    '  DB[(PostgreSQL / Redis)]',
    '  ERR[errorHandler]',
    '',
    '  REQ --> CORS --> CTX --> ROUTE --> MW --> AH --> TX --> SERVICE --> PRISMA --> DB',
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
- 当前持久化字段已包含 `themePresetId`、`themeMode(light/dark/auto)`、侧栏风格、布局、切换动画、缓存标签和页面状态

### 当前用户头像

- `User` 不再直接存头像 URL，改为 `avatarFileId -> MediaAsset.id`
- `/api/auth/me`、用户列表、用户详情统一返回 `avatarFileId`、`avatarUrl`、`avatarFile`
- `PUT /api/auth/avatar` 用来把当前登录用户绑定到自己上传的图片记录
- 用户管理里的头像字段和控制台右上角头像上传都走同一套图片记录模型

## RBAC 与菜单

RBAC 初始化在 `src/services/system-rbac.ts`。

- 权限种子来自 `src/constants/system-permissions.ts`
- `bootstrapSystemRbac` 会写入权限、系统角色、`RealtimeTopic` 和默认菜单树
- 菜单树分为目录、页面、行为三类节点，对应 `MenuNodeType`

这部分现在有一个重要边界：

- `system-permissions.ts` 只负责初始化种子。
- 运行时权限检查仍然来自数据库里的 `Permission / RolePermission / UserRole`。
- realtime 订阅授权来自数据库里的 `RealtimeTopic` 绑定和 `src/topics` 注册表，不直接读取共享常量文件。

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

当前回显接口：

- `POST /api/users/options/roles/resolve`
- `POST /api/roles/options/permissions/resolve`
- `POST /api/menus/options/permissions/resolve`
- `POST /api/oauth/applications/options/permissions/resolve`

请求体约定：

- `page`、`pageSize` 是统一分页字段
- 业务过滤字段直接平铺在 body 上，例如 `q`、`code`、`name`、`module`、`action`
- 前端 `RelationSelectFormItem` 的 `params.xxx` 会直接映射到这些字段
- 回显接口 body 固定为 `{ ids: string[] }`
- 回显接口返回数组，顺序按传入 ids 保持，缺失记录会自动忽略

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
- OAuth 应用权限 scope 的编辑态回显走 `POST /api/oauth/applications/options/permissions/resolve`

关键实现：

- `buildExternalProviderAuthorizeUrl` 生成跳转地址
- `handleExternalProviderCallback` 处理第三方回调
- `exchangeOAuthLoginTicket` 把一次性 ticket 换成本地会话
- 外部 access token / refresh token 落在 `OAuthToken`
- `oauth-upstream-refresh` 定时任务在过期前刷新上游 token
- 如果上游返回 `invalid_grant`，会撤销本地 `EXTERNAL_REFRESH_TOKEN`，避免之后持续无效重试
- 如果第三方 subject 变化但仍映射到同一个本地用户，会复用已有 `(userId, providerId)` 关联而不是重复插入
- `src/services/oauth-admin.ts` 对 `OAuthApplicationPermission` 采用“软删、恢复、仅新增缺失关系”的同步策略，避免更新 OAuth 应用时因为软删除记录仍占用唯一键而触发 `(applicationId, permissionId)` 冲突

## 文件上传与附件

上传链路分成两层。

### 1. 上传计划

- `POST /api/files/presign`
- `src/services/file-upload.ts` 创建 `MediaAsset`
- 返回上传策略、对象键、回调信息

### 2. 附件管理

- `src/routes/attachments.ts` 提供列表、详情、编辑、删除、导出
- `MediaAsset` 支持 `tag1`、`tag2` 作为业务筛选字段
- 用户头像等图片引用关系也落在 `MediaAsset` 上，删除时会先经过统一删除引用检查
- `/api/attachments/options/images` 和 `/resolve` 返回所有已完成的图片记录，`attachment` 和 `avatar` 两种 kind 都可作为图片选择器数据源
- 删除附件前会先做引用检查，确认可删后再删存储对象并软删除数据库记录

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

### BackendRuntimeContext

`src/lib/backend-runtime-context.ts` 是后端运行时的唯一入口，当前统一承载：

- `db`：当前请求应该使用的受管 Prisma 客户端
- `dbRaw`：当前请求对应的原始 Prisma / Transaction Client
- `dbRawDriver`：当前运行时真正的 raw driver，给删除引用检查和需要真实 tx client 的基础设施使用
- `request` / `response`
- `requestId`
- `actorId`
- `inTransaction`
- 请求级审计状态：开始时间、失败信息、已捕获的 `Operation`、flush 状态

`src/utils/request-context.ts` 现在只是兼容层。像 `getRequestActorId()`、`setRequestActorId()` 这种旧接口，底层也是在读写 `BackendRuntimeContext`。

这层不是简单的“把 request 挂到全局变量里”。它用的是 Node 的 `AsyncLocalStorage`，所以在同一个请求链路里，无论业务代码再往下调用多少层 service、helper 或 Prisma 代理，都可以通过运行时拿到同一个上下文。

运行时上下文在这个项目里有三种形态：

- 请求根上下文
  - 由 `requestContextMiddleware` 创建
  - 持有 root 级 `db / dbRaw`
  - `inTransaction = false`
  - 负责承接整个请求的 `requestId`、`actorId` 和审计状态
- 事务上下文
  - 由 `runInBackendRuntimeTransaction(...)` 基于请求根上下文 `fork(...)`
  - 把 `db / dbRaw / dbRawDriver` 切到当前事务客户端
  - `inTransaction = true`
  - 继续复用同一份审计状态，所以事务内外采集到的 `Operation` 会落到同一条 `RequestRecord`
- 请求外运行时
  - 只在 timer、启动期 bootstrap、测试基建、请求结束后的审计落库等场景出现
  - 没有 `request / response`
  - 不应该拿来承接普通业务接口

`actorId` 的来源也统一收敛在运行时里：

- 绝大多数受保护接口通过 `authMiddleware` 认证成功后写入 `setRequestActorId(...)`
- 登录、刷新、ticket 交换这类还没进入统一认证中间件的接口，会在对应 route 里显式写入当前用户
- 之后所有 `prisma` 受管写操作和请求审计都从运行时读取这个 `actorId`

### 自动事务

事务边界已经下沉到 `src/utils/http.ts`：

- 每个 `asyncHandler(...)` 包装的异步接口都会自动进入 `runInBackendRuntimeTransaction(...)`
- 默认事务隔离级别是 `Serializable`
- 同一个请求内，`prisma` / `prismaRaw` 会自动切到当前事务客户端
- 服务层显式调用 `runInBackendRuntimeTransaction(...)` 时，如果已经处于请求事务内，会直接复用当前事务上下文
- 如果接口为了协议兼容需要自己写出错误响应而不是直接抛错，例如 OAuth2 的 JSON / redirect / HTML error，响应写出后要显式调用 `rollbackHandledResponse()` 触发回滚

约束：

- 不要再在 `app.ts`、整组 router 包装层做事务控制
- 新增异步接口时不要直接写裸 `async (req, res) => {}`，统一走 `asyncHandler(...)`
- 业务代码不要直接调用 `getRootPrismaClient()` 绕过运行时，除非是在框架初始化或测试基础设施里

这里真正的关键点不是“自动开事务”，而是“自动把事务客户端绑定回运行时”：

- `asyncHandler(...)` 包装的接口会进入 `runInBackendRuntimeTransaction(...)`
- 如果当前请求还没在事务里，它会用 root Prisma 开一个 `Serializable` 事务
- 然后基于当前上下文 `fork(...)` 出事务上下文，把 `db / dbRaw / dbRawDriver` 全部替换成 tx 版本
- 如果 service 内部再次调用 `runInBackendRuntimeTransaction(...)`，由于当前已经 `inTransaction = true`，框架会直接复用现有事务，不会再开嵌套事务

这就是为什么业务代码几乎不需要手动传 transaction client。只要你在请求里统一使用 `prisma` / `prismaRaw`，它们天然就会落在当前事务上。

### 为什么全局导出的 `prisma` / `prismaRaw` 仍然能命中同一个事务

表面上看，`src/lib/prisma.ts` 导出的是“全局变量”：

- `export const prisma = ...`
- `export const prismaRaw = ...`

但它们不是固定绑定到某一个 PrismaClient 的单例，而是“动态代理”：

- `prisma` 每次访问属性时，都会去当前 `BackendRuntimeContext` 里取 `db`
- `prismaRaw` 每次访问属性时，都会去当前 `BackendRuntimeContext` 里取 `dbRaw`
- 当前请求如果已经进入事务，这两个值就是基于同一个 `tx` 创建出来的 managed / raw client
- 当前请求如果还没进入事务，它们才会回退到 root 级 client

可以把它理解成：

- 导出的名字是全局的
- 但名字背后真正执行数据库操作的 client，是运行时按“当前异步调用链”现取的

所以在同一个 `asyncHandler(...)` 包装的业务请求里：

```ts
await prisma.user.create(...)
await prismaRaw.user.update(...)
```

虽然一个走 managed 语义、一个走 raw 语义，但底层仍然会命中同一个事务上下文，只是代理行为不同：

- `prisma`
  - 使用当前事务里的 managed client
  - 会做软删除过滤、操作者字段补齐、`delete -> soft delete` 改写
- `prismaRaw`
  - 使用当前事务里的 raw client
  - 不做受管改写
  - 但仍然在同一个事务里，也仍然会记录 `Operation`

这也是为什么这个项目可以把 `prisma` / `prismaRaw` 放在任意 service 里直接 import，而不需要像传统写法那样层层显式传递 `tx`。

### 从 `/api/users` 到 `RequestRecord / Operation` 落库的完整时序

`/api/users` 是最典型的请求链路之一：

- `usersRouter.use(authMiddleware)` 先做认证
- `GET /api/users` 经过 `requirePermission('user.read')`
- handler 本身由 `asyncHandler(...)` 包装
- handler 里直接执行 `prisma.user.count(...)` 和 `prisma.user.findMany(...)`

对应的运行时与审计时序如下：

<MermaidDiagram
  label="User list request to request audit persistence"
  :code="[
    'sequenceDiagram',
    '  participant C as Client',
    '  participant A as Express App',
    '  participant RC as requestContextMiddleware',
    '  participant ALS as BackendRuntimeContext',
    '  participant AM as authMiddleware',
    '  participant UR as /api/users handler',
    '  participant AH as asyncHandler',
    '  participant TX as runInBackendRuntimeTransaction',
    '  participant MP as managed prisma proxy',
    '  participant DB as PostgreSQL',
    '  participant FL as flushRequestAuditRecord',
    '  participant AR as RequestRecord/Operation',
    '  participant RT as realtime audit topic',
    '',
    '  C->>A: GET /api/users?page=1&pageSize=10',
    '  A->>RC: enter middleware chain',
    '  RC->>ALS: create root BackendRuntimeContext(requestId, req, res)',
    '  RC-->>A: continue',
    '  A->>AM: authenticate request',
    '  AM->>ALS: setRequestActorId(user.id)',
    '  AM-->>A: continue',
    '  A->>UR: match /api/users',
    '  UR->>AH: invoke wrapped handler',
    '  AH->>TX: runInBackendRuntimeTransaction(...)',
    '  TX->>DB: open Serializable transaction',
    '  TX->>ALS: fork transaction context(db/dbRaw -> tx client)',
    '  UR->>MP: prisma.user.count({ where })',
    '  MP->>DB: execute count with managed filter',
    '  MP->>ALS: add READ Operation',
    '  UR->>MP: prisma.user.findMany({ where, skip, take })',
    '  MP->>DB: execute findMany with managed filter',
    '  MP->>ALS: add READ Operation',
    '  UR-->>C: 200 User list',
    '  A->>RC: response finish / close',
    '  RC->>FL: schedule async audit flush',
    '  FL->>ALS: read actorId, request, response, operations, failure',
    '  FL->>AR: insert RequestRecord + nested Operation[]',
    '  FL->>RT: emit /system/audit/event',
  ].join('\\n')"
/>

可以把这条链路拆成 6 步理解：

1. `requestContextMiddleware` 先创建根上下文，生成或透传 `x-request-id`，并把 `req / res` 放进 `AsyncLocalStorage`。
2. `authMiddleware` 认证成功后，把当前用户 ID 写进运行时。这一步决定了后续 `createId / updateId / actorId` 的来源。
3. `asyncHandler(...)` 自动把接口放进请求事务里，避免在 route/service 手工传 tx。
4. `prisma.user.count(...)` 和 `prisma.user.findMany(...)` 不会直接打到 Prisma delegate，而是先经过受管代理，补齐软删除过滤，并在运行时里追加两条 `READ Operation`。
5. 请求成功返回后，事务先提交；如果抛错则回滚；如果接口已经写出了协议响应但仍然需要回滚，则通过 `rollbackHandledResponse()` 标记为失败回滚。
6. 响应结束后，框架异步 flush 审计，把“这一整个请求”汇总成一条 `RequestRecord`，再把本次请求内采集到的每次数据库操作落成多条 `Operation`。

### 请求审计

请求审计不再走单独的手工 audit util。现在统一由运行时和 Prisma 代理自动采集，数据表是：

- `RequestRecord`
  - 一条请求一条记录
  - 保存 `requestId`、操作者、认证来源、HTTP method/path、query/params/body、状态码、成功与否、错误信息、读写次数、总耗时
- `Operation`
  - 一条请求内每次数据库操作一条记录
  - 通过 `requestRecordId + sequence` 关联到对应请求
  - 保存 `model`、`operation`、`effectiveOperation`、`MANAGED/RAW`、`READ/WRITE`、`committed`、`softDelete`、主实体 ID、影响记录数、参数快照、结果快照、effect diff、错误信息、耗时

`effect` 字段的结构是面向查询设计的：

- 读操作：`preview + summary`
  - `preview` 是最多 20 条的脱敏结果预览
  - `summary` 包含结果类型、返回数量、返回 ID
- 写操作：`records + summary`
  - `records[]` 按实体 ID 记录 `before`、`after` 和字段级 `changes`
  - `summary.changedRecordCount` 给列表和导出做聚合统计

事务语义：

- 只要写操作发生在请求事务里，最终是否真的落库，由 `Operation.committed` 表示
- 请求成功提交时，事务内写操作的 `committed = true`
- 请求回滚或 `rollbackHandledResponse()` 触发回滚时，事务内写操作的 `committed = false`
- 这时 `effect.records[].after` 表示事务内观察到的修改结果，不代表最终数据库状态，最终是否生效必须看 `committed`

安全边界：

- 请求体、查询参数、数据库前后镜像都会统一经过脱敏
- `password`、`token`、`secret`、`salt`、`*Hash` 这类字段不会明文进入审计表
- 审计落库在请求结束后异步串行执行，不会和业务事务共用同一条事务链

如果按实现拆开看，请求审计其实分两段：

- 采集阶段
  - 发生在每次 Prisma delegate 调用时
  - 由 `src/lib/prisma.ts` 里的代理统一执行
  - 读操作直接根据结果生成 `preview + summary`
  - 写操作会先读 `beforeRows`，再执行写入，再读 `afterRows`，然后生成 `before / after / changes`
- flush 阶段
  - 发生在响应结束之后
  - 由 `requestContextMiddleware` 监听 `res.finish / res.close` 触发
  - `flushRequestAuditRecord(...)` 从 `BackendRuntimeContext` 把这次请求聚合成 `RequestRecord + Operation[]`

这里有几个实现细节，文档里需要特别记住：

- `MANAGED` 和 `RAW` 都会记录 `Operation`
  - `RAW` 不是“跳过审计”
  - 它只是跳过受管改写，保留原始 Prisma 语义
- 审计里会同时保存 `requestedArgs` 和 `effectiveArgs`
  - 所以你能看出 `findUnique -> findFirst`
  - 也能看出 `delete -> update(deleteAt=...)`
- `committed` 不等于 `succeeded`
  - `succeeded` 表示这次数据库调用本身是否成功
  - `committed` 表示这次写入最终是否随请求事务一起提交
- `effect.records[].after` 是事务内观察到的结果
  - 如果最终 `committed = false`，它不代表数据库最终状态
- 审计 flush 使用的是 root raw Prisma client
  - 它故意不复用当前请求事务
  - 这样业务提交和审计落库不会绑在同一条事务链上
- 审计 flush 还会进入一个全局串行队列
  - 避免多个请求同时结束时并发写审计表
  - 也避免测试 reset 数据库时和后台异步 flush 相互竞争

### RequestRecord 和 Operation 各自负责什么

可以把它们理解成“请求级 envelope + 数据库操作级明细”：

- `RequestRecord`
  - 回答“谁在什么时候，以什么认证方式，从哪里发起了什么 HTTP 请求，最终成功还是失败”
  - 适合列表筛选、导出、按请求排查问题
- `Operation`
  - 回答“这个请求里具体发生了哪些数据库操作，框架有没有改写语义，最终是否提交，影响了哪些主实体”
  - 适合定位事务问题、软删除行为、受管与 raw 差异

两者的关系是：

- 一次请求只会有一条 `RequestRecord`
- 一次请求里可能有 0 到 N 条 `Operation`
- `Operation.sequence` 保证了同一请求内可以按真实执行顺序重放数据库轨迹
- 删除旧 `RequestRecord` 时，关联 `Operation` 会通过级联删除一起清理

### 受管 Prisma 客户端

`src/lib/prisma.ts` 现在不只是“Prisma 扩展”，而是运行时感知的数据库入口：

- `prisma`：总是解析到当前 `BackendRuntimeContext.db`
- `prismaRaw`：总是解析到当前 `BackendRuntimeContext.dbRaw`
- 统一处理 Snowflake ID
- 统一补 `createId` / `updateId`
- 统一处理软删除
- 默认过滤 `deleteAt = null`

对受管模型执行 `delete` 时，实际会转成更新 `deleteAt`，并且这套行为在普通请求和事务内请求中保持一致。

更具体一点，`prisma` 这层受管能力可以拆成 4 件事：

- 运行时绑定
  - `prisma` 永远解析到当前 `BackendRuntimeContext.db`
  - 所以请求进入事务后，不需要业务代码自己切换 client
- 受管改写
  - 受管模型的查询默认补 `deleteAt = null`
  - `findUnique` 会改写成 `findFirst`
  - `delete` / `deleteMany` 会改写成软删除更新
- 元数据补齐
  - `create` 自动补 Snowflake ID、`createId`、`updateId`
  - `update` 自动补 `updateId`
- 审计采集
  - 统一记录 `requestedArgs / effectiveArgs / result / effect / error`
  - 读写都会变成 `Operation`

这里还要补一个容易忽略的事实：

- `prisma` / `prismaRaw` 的“事务一致性”不是通过模块级可变变量实现的
- 而是通过 `AsyncLocalStorage + BackendRuntimeContext + Proxy resolver` 实现的
- 所以保证同一事务的前提是：
  - 代码运行时仍然处于同一条请求异步链路里
  - 访问的是导出的代理本身，而不是提前缓存出来的某个 delegate 或底层 client

### `prisma`、`prismaRaw` 和 root client 的使用边界

默认顺序：

1. 请求内业务逻辑优先用 `prisma`
2. 只有明确需要原始语义时才用 `prismaRaw`
3. 只有请求上下文之外的基础设施代码才直接用 root client

具体区别：

- `prisma`
  - 自动绑定当前 `BackendRuntimeContext`
  - 自动补 Snowflake ID、`createId`、`updateId`
  - 自动处理软删除和 `deleteAt = null` 过滤
  - 自动记录 `Operation`
  - 适合绝大多数读写接口
- `prismaRaw`
  - 仍然绑定当前运行时事务，但不做受管模型改写
  - 仍然自动记录 `Operation`
  - 适合中间表同步、恢复已软删除关系、读取原始记录、或直接使用 transaction client
  - 使用时需要你自己清楚 `deleteAt`、`createId`、`updateId` 应该怎么维护
- `getRootPrismaClient()` / `getRootPrismaRawClient()`
  - 不跟请求运行时绑定
  - 只用于 `main.ts`、timer、测试基建、请求结束后的审计落库等请求外场景

判断不准时，先用 `prisma`，只有在受管行为不符合目标时再切到 `prismaRaw`。

如果只记一句话，可以记成：

- `prisma`：请求内默认入口，受管 + 审计
- `prismaRaw`：请求内特殊入口，原始语义 + 审计
- root client：请求外基础设施入口，不应该进入普通 route/service 主链路

### 两个容易踩坑的边界

#### 1. 不是“整个请求生命周期”都在同一个事务里

当前后端的事务是由 `asyncHandler(...)` 开启的，而不是由最外层 Express 请求入口开启的。

这意味着：

- `requestContextMiddleware` 创建了请求根上下文，但这时还没有业务事务
- 像 `authMiddleware` 这种运行在 route handler 之前的中间件，如果自己查库，使用的是请求根上下文里的 root 级 client
- 只有真正进入 `asyncHandler(...)` 之后，当前请求才会切到事务上下文

所以这套框架保证的是：

- 同一个 `asyncHandler(...)` 包装的业务执行段内，`prisma` / `prismaRaw` 会落到同一个事务

它不保证的是：

- 从最外层 middleware 到响应结束的所有数据库访问，都天然在同一个事务里

这也是为什么认证、客户端识别、部分前置校验如果发生在 `asyncHandler(...)` 之前，不应该假设自己已经处于业务事务内。

#### 2. 不要缓存 delegate 或底层 client

错误示例：

```ts
const userDelegate = prisma.user;
```

或者：

```ts
const fixedClient = prisma;
```

然后在请求外初始化时就把它们保存起来，后续复用。

这样做的问题是：

- 代理解析发生得太早
- 后面真正进入请求事务时，这个缓存对象不一定还会跟着当前 `BackendRuntimeContext` 切换
- 结果就是看起来在用“全局 prisma”，实际上可能已经提前绑定到了 root client

安全写法是：

- 在函数执行时直接使用 `prisma.user...`
- 或者在请求内临时取用，不要把 delegate 缓存成模块级常量

可以接受的模式是：

```ts
export const listUsers = async () =>
  prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });
```

不推荐的模式是：

```ts
const userDelegate = prisma.user;

export const listUsers = async () =>
  userDelegate.findMany({
    orderBy: { createdAt: 'desc' },
  });
```

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
- `request-audit-retention`
- `upload-reconcile`

当前 timer registry 同时支持：

- `defineIntervalTimer(...)`
- `defineCronTimer(...)`

`request-audit-retention` 会在每天 `0:00` 清理 30 天之前的 `RequestRecord / Operation` 记录，依赖 `Operation -> RequestRecord` 的级联删除保证不会留下孤儿数据。

新增后台任务时，沿着 `defineIntervalTimer / defineCronTimer -> createBackendTimerRegistry` 扩展，不要写成独立脚本。

## 测试

后端测试已经拆成两层：

- `apps/backend/test/framework`
- `apps/backend/test/integration`
- `apps/backend/test/support/backend-testkit.ts`

优先读这些测试文件：

- `framework/delete-reference-checker.test.ts`
- `framework/excel-export.test.ts`
- `framework/request-audit-retention.test.ts`
- `framework/runtime-transaction.test.ts`
- `integration/auth.test.ts`
- `integration/files.test.ts`
- `integration/oauth.test.ts`
- `integration/rbac.test.ts`

它们基本覆盖了认证、授权、OAuth、自动事务、请求审计、删除保护、导出、上传失败补偿和权限链路的主行为。

## 新增后端模块的最短路径

1. 在 `schema.prisma` 增加模型和关系。
2. 如果模型需要统一的 Snowflake ID / 操作者字段 / 软删除 / Operation 审计，把模型名加入 `src/lib/prisma.ts` 的受管集合。
3. 在 `packages/api-common` 增加共享类型和 API 工厂方法。
4. 在 `src/routes` 新增路由时，异步处理器统一走 `asyncHandler(...)`，核心逻辑放进 `src/services`。
5. 如果服务层需要显式事务块，使用 `runInBackendRuntimeTransaction(...)`，不要自己在路由里直接开 Prisma 事务。
6. 如果是后台可见模块，补权限码并更新 `system-rbac.ts` 菜单种子。
7. 如果模块需要 websocket topic，补 `src/topics` 注册项、订阅权限和 `RealtimeTopic` seed。
8. 如果是列表页，直接接 `createExcelExportHandler`。
9. 在对应的 `framework` 或 `integration` 测试补用例，并同步更新 docs。

