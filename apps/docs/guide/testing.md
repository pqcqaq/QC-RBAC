---
title: 测试用例
description: 后端 framework / integration 测试结构、运行方式，以及每个测试用例实际验证的逻辑。
---

## 测试结构

```text
apps/backend/test
├─ framework
│  ├─ delete-reference-checker.test.ts
│  └─ excel-export.test.ts
├─ integration
│  ├─ admin-resources.test.ts
│  ├─ attachments.test.ts
│  ├─ auth.test.ts
│  ├─ clients.test.ts
│  ├─ exports.test.ts
│  ├─ oauth.test.ts
│  └─ rbac.test.ts
└─ support
   └─ backend-testkit.ts
```

拆分原则：

- `framework`：验证可复用的底层抽象。
- `integration`：验证真实 API、权限、数据库、上传、OAuth、导出等业务链路。
- `support/backend-testkit.ts`：统一测试数据库、seed、登录、客户端请求头、二进制导出解析和上传辅助。

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

## Framework

### `framework/delete-reference-checker.test.ts`

- `detects guarded delete and soft-delete operations`：验证删除检查器能正确识别 `delete`、`deleteMany` 和软删除式 `updateMany`，不会把普通更新误判成删除。
- `blocks deleting records that still have incoming references`：验证存在入向引用时，直接删除会被拦截，并返回具体关系信息。
- `blocks updateMany soft deletes when referenced records still exist`：验证批量软删除同样会经过引用检查，不会绕开保护。
- `blocks deleting menu parents while active children still reference them`：验证自引用模型也受保护，父菜单被子菜单引用时不能删除。
- `allows batch soft deletion when the self-referencing graph is deleted together`：验证同一批次把整棵自引用关系一起删除时可以通过。

### `framework/excel-export.test.ts`

- `streams xlsx responses from async row sources and normalizes exported values`：验证导出抽象支持异步行源，并会统一格式化布尔值、数组、对象、时间、sheet 名称和文件名。
- `creates timestamped file names with zero-padded local datetime parts`：验证时间戳文件名格式稳定，年月日时分秒都会补零。

## Integration

### `integration/admin-resources.test.ts`

- `returns 400 instead of 500 for duplicate unique values`：验证后台资源写入唯一键冲突时返回 400，而不是 500。
- `paginates roles, permissions and realtime message history`：验证角色、权限、实时消息列表的分页和筛选行为正常。
- `protects audit logs and immutable seed identifiers`：验证审计日志权限受保护，系统种子权限和系统角色的关键标识不可随意改。
- `supports full admin CRUD lifecycle and avatar upload`：验证后台用户、角色、权限的完整 CRUD 主链路，以及头像上传和回收流程。

### `integration/attachments.test.ts`

- `supports attachment management CRUD, tag filters and xlsx export`：验证附件上传、查询、详情、标签编辑、标签筛选、导出和删除都可用。

### `integration/auth.test.ts`

- `requires valid client credentials for auth routes and stamps tokens with client identity`：验证认证接口必须带合法客户端凭证，且签发的 token 会记录客户端身份，跨客户端不能混用。
- `supports register, me, refresh and logout`：验证注册、获取当前用户、刷新 token、登出这条标准会话链路。
- `persists workbench preferences on the current user session`：验证用户工作台配置会持久化到后端，并在 `me`、`refresh` 时返回。
- `supports strategy discovery, verification and code-based auth flows`：验证认证策略发现、验证码发送与校验、邮箱/手机号验证码登录与注册流程。
- `links email-code auth to password accounts and respects login toggles`：验证邮箱验证码策略可桥接已有密码账号，并且登录开关关闭后会严格拒绝登录相关操作。

### `integration/clients.test.ts`

- `supports client management with typed config and protects the current request client`：验证客户端管理支持按类型维护差异化 config，并阻止禁用或删除当前正在使用的客户端。
- `protects audit export and returns filtered client exports`：验证审计导出权限控制，以及客户端导出会正确应用筛选条件。

### `integration/exports.test.ts`

- `exports filtered user lists and realtime history as xlsx workbooks`：验证用户导出和实时消息导出都是合法 xlsx，并且保留筛选结果。

### `integration/oauth.test.ts`

- `exposes oauth application permission options without depending on role management permissions`：验证 OAuth 应用的权限 scope 选项接口独立受 `oauth-application.*` 权限控制，不依赖角色管理权限。
- `supports authorization code + PKCE + userinfo + protected api`：验证系统作为 OAuth/OIDC Provider 时，授权码、PKCE、userinfo、受保护 API、introspect、revoke 的完整协议链路。
- `supports upstream oauth login, ticket exchange and refresh task`：验证系统作为 OAuth Client 时，第三方登录回调、本地 ticket 交换和外部 access token 刷新任务的完整链路。

### `integration/rbac.test.ts`

- `prevents ordinary members from reading admin resources`：验证普通成员无法访问后台管理资源。
- `lets admins create permission-role-user chains and inspect permission sources`：验证管理员可以创建权限、角色、用户链路，并查看权限来源分析结果。
- `invalidates cached permissions after role updates`：验证角色权限变更后，用户侧缓存权限会被刷新。
- `blocks deleting referenced records until business code clears the relation`：验证业务实体仍被引用时不能删除，必须先由业务层清理关系。
- `enforces assignment permissions for scoped operators`：验证受限操作员即便拥有基础读写权限，也不能越权分配角色或权限。

## 写新测试时的约定

- 新增通用框架能力，优先补到 `framework`。
- 新增业务模块或接口，补到 `integration`。
- 测试里统一复用 `backend-testkit.ts`，不要每个文件自己重复搭数据库、登录、上传和导出解析逻辑。
- 改动影响测试结构或覆盖范围时，同步更新这页文档。
