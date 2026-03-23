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

- `framework`：验证可复用的底层抽象
- `integration`：验证真实 API、权限、数据库、上传、OAuth、导出等业务链路
- `support/backend-testkit.ts`：统一测试数据库、seed、登录、客户端请求头、二进制导出解析、上传辅助，以及 mock OAuth Provider

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

## Integration

### `integration/admin-resources.test.ts`

- `returns 400 instead of 500 for duplicate unique values`
- `paginates roles, permissions, selector options and realtime message history`
- `protects audit logs and immutable seed identifiers`
- `supports full admin CRUD lifecycle and avatar upload`

覆盖点：

- 后台基础 CRUD
- 唯一键冲突处理
- 选择器分页接口
- 实时消息分页
- 种子权限 / 角色保护
- 头像上传链路

### `integration/attachments.test.ts`

- `supports attachment management CRUD, tag filters and xlsx export`

覆盖点：

- 上传计划
- 文件回调
- 附件列表 / 详情 / 编辑 / 删除
- `tag1`、`tag2` 筛选
- 导出结果正确性

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
- 用户偏好持久化
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

### `integration/oauth.test.ts`

- `exposes oauth application permission options without depending on role management permissions`
- `supports authorization code + PKCE + userinfo + protected api`
- `supports upstream oauth login, ticket exchange and refresh task`
- `revokes external refresh tokens when the upstream provider returns invalid_grant`
- `reuses an existing provider link for the same user when the upstream subject changes`

覆盖点：

- OAuth 应用 scope 选择接口权限
- 系统作为 Provider 的完整协议链路
- 系统作为 OAuth Client 的第三方登录链路
- 上游 refresh token 失效处理
- OAuth 用户映射复用逻辑

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

## 新增测试时怎么判断放哪里

| 场景 | 放置位置 |
| --- | --- |
| 新增通用抽象，例如导出工厂、删除检查器、解析器 | `framework` |
| 新增业务接口、管理页面、权限链路、OAuth 链路 | `integration` |
| 需要复用登录、种子、上传、导出解析、mock Provider | `support/backend-testkit.ts` |

## 写测试时的项目约定

- 任何行为变化都要补测试
- 先复用 `backend-testkit.ts`
- 测试不要再堆到一个总文件里
- 改动影响测试结构或覆盖范围时，同步更新这页文档
