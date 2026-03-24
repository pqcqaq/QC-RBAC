---
title: 测试用例
description: 后端 framework / integration 测试结构、运行方式，以及每个测试用例实际验证的逻辑。
---

## 测试结构

```text
apps/backend/test
├─ framework
│  ├─ delete-reference-checker.test.ts
│  ├─ runtime-transaction.test.ts
│  ├─ request-audit-retention.test.ts
│  ├─ realtime-client.test.ts
│  ├─ realtime-topic.test.ts
│  └─ excel-export.test.ts
├─ integration
│  ├─ admin-resources.test.ts
│  ├─ attachments.test.ts
│  ├─ auth.test.ts
│  ├─ clients.test.ts
│  ├─ exports.test.ts
│  ├─ files.test.ts
│  ├─ oauth.test.ts
│  ├─ realtime.test.ts
│  ├─ realtime-topics.test.ts
│  └─ rbac.test.ts
└─ support
   └─ backend-testkit.ts
```

拆分原则：

- `framework`：验证可复用的底层抽象
- `integration`：验证真实 API、权限、数据库、上传、OAuth、导出等业务链路
- `support/backend-testkit.ts`：统一测试数据库、seed、登录、客户端请求头、二进制导出解析、上传辅助，以及 mock OAuth Provider
- 集成测试默认直接启动 `createApp()`，所以 `requestContextMiddleware`、`asyncHandler(...)`、自动事务和错误处理中间件都在真实链路里生效

## 执行链路

<MermaidDiagram
  label="Backend test flow"
  :code="[
    'flowchart LR',
    '  Test[Test file]',
    '  Kit[backend-testkit]',
    '  Prisma[prisma generate + test db]',
    '  Seed[seed database]',
    '  App[Express app]',
    '  Mock[Mock OAuth Provider]',
    '  Assert[assertions]',
    '',
    '  Test --> Kit --> Prisma --> Seed --> App --> Assert',
    '  Test --> Mock --> App',
  ].join('\n')"
/>

## 运行方式

```bash
pnpm --filter @rbac/backend test
pnpm --filter @rbac/backend test -- auth.test.ts
pnpm --filter @rbac/backend test -- oauth.test.ts
```

默认会先：

- `prisma generate`
- `tsc -p tsconfig.test.json --noEmit`
- 再执行 `node --import tsx --test`

测试数据库会基于 `DATABASE_URL` 或 `TEST_DATABASE_URL` 自动推导 `_test` 后缀数据库。

## `backend-testkit.ts` 具体提供什么

`apps/backend/test/support/backend-testkit.ts` 现在负责：

- 推导测试数据库 URL
- 初始化和清空测试库
- 启动 Express app
- 复用种子数据
- 生成不同客户端的测试请求头
- 登录并拿到 session
- 解析 Excel 导出响应
- 启动独立随机端口的 mock OAuth Provider
- 在 `db push --force-reset`、reseed、teardown 之前等待异步请求审计 flush 完成，避免测试数据库重置和后台审计写入竞争

新增集成测试时，优先复用它，不要每个文件重新搭一遍数据库和 mock 服务。

## Framework

### `framework/delete-reference-checker.test.ts`

- `detects guarded delete and soft-delete operations`
  验证删除检查器能正确识别 `delete`、`deleteMany` 和软删除式 `updateMany`
- `blocks deleting records that still have incoming references`
  验证存在入向引用时，直接删除会被拦截，并返回具体关系信息
- `blocks updateMany soft deletes when referenced records still exist`
  验证批量软删除同样会经过引用检查
- `blocks deleting menu parents while active children still reference them`
  验证自引用模型也受保护
- `allows batch soft deletion when the self-referencing graph is deleted together`
  验证同一批次删除完整自引用图时可以通过

### `framework/excel-export.test.ts`

- `streams xlsx responses from async row sources and normalizes exported values`
  验证导出抽象支持异步行源，并统一格式化布尔值、数组、对象、时间、sheet 名称和文件名
- `creates timestamped file names with zero-padded local datetime parts`
  验证时间戳文件名格式稳定
- `supports resolving columns from exported rows for dynamic headers`
  验证 `columns` 可以用函数形式读取导出记录，动态展开列头并保持行数据对齐

### `framework/runtime-transaction.test.ts`

- `commits writes and preserves actor ids from request context`
  验证请求上下文里的 `actorId` 能传递到受管 Prisma 写入，并且成功请求会落下对应 `RequestRecord + Operation`
- `rolls back writes when an async handler throws`
  验证 `asyncHandler(...)` 包装的接口在抛错时会整体回滚，并把事务内写操作标记成 `committed = false`
- `rolls back handled error responses and reuses the same nested transaction`
  验证已写出错误响应的协议型接口只要调用 `rollbackHandledResponse()` 也会回滚，并且服务层显式事务会复用当前请求事务而不是独立提交
- `redacts sensitive request and database fields in persisted audit records`
  验证请求体和数据库前后镜像里的敏感字段会统一脱敏

### `framework/request-audit-retention.test.ts`

- `removes request records older than 30 days and cascades operations`
  验证每天 0 点执行的请求审计清理逻辑会删除 30 天之前的 `RequestRecord`，并通过级联删除清掉关联 `Operation`

### `framework/realtime-topic.test.ts`

- `matches exact, single-level, and multi-level subscriptions`
  验证 realtime topic matcher 支持精确匹配、`+` 单层通配和 `#` 多层通配
- `determines whether an authorized subscription pattern covers a requested topic`
  验证 `coversWsSubscriptionTopic(...)` 能正确判断数据库授权 pattern 是否覆盖客户端请求的订阅 topic
- `normalizes legal topics and rejects invalid wildcard placement`
  验证发布 topic / 订阅 topic 会被标准化，并拒绝非法通配符位置

### `framework/realtime-client.test.ts`

- `syncs subscribed topics, dispatches wildcard handlers, and closes after the last unsubscribe`
  验证 shared websocket client 会基于 `sub:ack` / `unsub:ack` 同步本地与服务端 topics，正确分发匹配 topic 的消息，并在最后一个订阅移除后主动断开
- `answers heartbeat pings and reconnects after a non-fatal close while topics remain`
  验证客户端会自动回复 `ping -> pong` 心跳，并在仍有订阅 topic 时按退避策略重连

## Integration

### `integration/admin-resources.test.ts`

- `returns 400 instead of 500 for duplicate unique values`
- `paginates roles, permissions, selector options and realtime message history`
- `protects audit logs and immutable seed identifiers`
- `supports full admin CRUD lifecycle and avatar relations`

覆盖点：

- 后台基础 CRUD
- 唯一键冲突处理
- 选择器分页接口
- 实时消息分页
- 种子权限 / 角色保护
- 用户头像图片外键回填
- `/api/auth/avatar` 当前用户头像绑定链路

### `integration/attachments.test.ts`

- `supports attachment management CRUD, tag filters and xlsx export`
- `supports image option search and resolve for image selectors`
- `blocks deleting avatar images that are still referenced by users`

覆盖点：

- 上传计划
- 文件回调
- 附件列表 / 详情 / 编辑 / 删除
- `tag1`、`tag2` 筛选
- 导出结果正确性
- 图片选择器 options / resolve
- 被用户头像引用时的删除保护

### `integration/auth.test.ts`

- `requires valid client credentials for auth routes and stamps tokens with client identity`
- `supports register, me, refresh and logout`
- `seeds a dedicated localhost:9000 web client for uni h5 development`
- `persists workbench preferences on the current user session`
- `supports strategy discovery, verification and code-based auth flows`
- `links email-code auth to password accounts and respects login toggles`

覆盖点：

- 客户端凭证和客户端上下文校验
- 会话主链路
- Uni H5 的 `web-uni-h5` 客户端
- 用户偏好持久化，包括工作台主题 preset 和 `light / dark / auto` 明暗模式
- 验证码链路
- 策略开关

### `integration/clients.test.ts`

- `supports client management with typed config and protects the current request client`
- `protects audit export and returns filtered client exports`

覆盖点：

- 客户端按类型配置
- 当前请求客户端保护
- 客户端列表导出
- 审计导出权限边界

### `integration/exports.test.ts`

- `exports filtered user lists and realtime history as xlsx workbooks`

覆盖点：

- 导出接口返回合法 xlsx
- 导出结果应用筛选条件

### `integration/files.test.ts`

- `persists FAILED upload status when callback finalization errors`

覆盖点：

- 上传 finalize 失败时，`MediaAsset.uploadStatus` 会被持久化为 `FAILED`
- 失败补偿不会被请求事务一起回滚掉
- 请求级审计也是请求外持久化，但测试基建会在 reset 前等待它完成

### `integration/oauth.test.ts`

- `exposes oauth application permission options without depending on role management permissions`
- `updates oauth application permissions without creating duplicate relation rows`
- `supports authorization code + PKCE + userinfo + protected api`
- `supports upstream oauth login, ticket exchange and refresh task`
- `revokes external refresh tokens when the upstream provider returns invalid_grant`
- `reuses an existing provider link for the same user when the upstream subject changes`

覆盖点：

- OAuth 应用 scope 选择接口权限
- OAuth 应用权限关系在软删除模型下的更新、恢复与幂等性
- 系统作为 Provider 的完整协议链路
- 系统作为 OAuth Client 的第三方登录链路
- 上游 refresh token 失效处理
- OAuth 用户映射复用逻辑

### `integration/realtime-topics.test.ts`

- `lists seeded realtime topic bindings for admins`
- `supports permission option search and resolve for topic bindings`
- `supports custom realtime topic CRUD and rejects duplicate topic permission bindings`
- `prevents editing or deleting seeded realtime topics`
- `forbids ordinary members from reading realtime topic bindings`

覆盖点：

- `RealtimeTopic` 的后台 CRUD
- topic pattern 和 permission 绑定的唯一性检查
- 系统注册 topic 的只读保护
- 订阅授权页面所依赖的权限选择器 options / resolve 接口
- 普通成员无法访问订阅授权管理资源

### `integration/rbac.test.ts`

- `prevents ordinary members from reading admin resources`
- `lets admins create permission-role-user chains and inspect permission sources`
- `invalidates cached permissions after role updates`
- `blocks deleting referenced records until business code clears the relation`
- `enforces assignment permissions for scoped operators`

覆盖点：

- 后台权限边界
- 权限来源分析
- 权限缓存刷新
- 删除保护
- 受限操作员分配边界

### `integration/realtime.test.ts`

- `tracks the same user across multiple realtime client groups`
- `acknowledges subscriptions and unsubscriptions and dispatches wildcard topic messages`
- `rejects topic subscriptions that are not covered by the current user permissions`
- `pushes permission updates only to affected online users and includes full sync targets`
- `pushes menu updates only to online users whose menu tree is affected`

覆盖点：

- 标准 websocket upgrade 和 access token 鉴权
- `ready` 首帧和心跳参数下发
- 同一用户下不同客户端连接分组索引
- `sub` / `sub:ack` / `unsub` / `unsub:ack` 协议同步
- wildcard topic 推送分发
- `sub` 请求会校验 `RealtimeTopic` 与用户 permission 的覆盖关系，并继续执行 topic 注册项的业务授权
- 权限更新事件只推给受影响在线用户
- 菜单结构变更只推给菜单树受影响在线用户
- `RbacUpdatedPayload.targets` 用于区分 `user` / `menus` 刷新范围
- 无订阅 topic 时服务端主动关闭连接

## 新增测试时怎么判断放哪里

| 场景 | 放置位置 |
| --- | --- |
| 新增通用抽象，例如导出工厂、删除检查器、解析器、请求运行时、事务包装 | `framework` |
| 新增业务接口、管理页面、权限链路、OAuth 链路 | `integration` |
| 需要复用登录、种子、上传、导出解析、mock Provider | `support/backend-testkit.ts` |

## 写测试时的项目约定

- 任何行为变化都要补测试
- 先复用 `backend-testkit.ts`
- 测试不要再堆到一个总文件里
- 改动影响测试结构或覆盖范围时，同步更新这页文档

