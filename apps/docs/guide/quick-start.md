---
title: 快速开始
description: 用最少步骤把 QC-RBAC 跑起来。
---

## 环境要求

- Node.js LTS
- `pnpm 10.x`
- Docker，或本地可用的 PostgreSQL / Redis

## 1. 安装依赖

```bash
pnpm install
```

根目录 `postinstall` 会先构建 `@rbac/api-common`，保证共享类型和请求工厂可直接被各端引用。

## 2. 准备环境变量

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/web-frontend/.env.example apps/web-frontend/.env
Copy-Item apps/app-frontend/env/.env.example apps/app-frontend/env/.env
```

关键变量：

| 位置 | 变量 | 说明 |
| --- | --- | --- |
| Backend | `DATABASE_URL` | PostgreSQL 连接串 |
| Backend | `REDIS_URL` | Redis 连接串 |
| Backend | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 会话签名密钥 |
| Backend | `CLIENT_ORIGIN` | Web 允许来源，影响 CORS 和 Web Client 校验 |
| Web | `VITE_API_BASE_URL` | Web API 地址 |
| Web | `VITE_AUTH_CLIENT_CODE` / `VITE_AUTH_CLIENT_SECRET` | Web 客户端凭证 |
| App | `VITE_SERVER_BASEURL` | Uni API 地址 |
| App | `VITE_AUTH_CLIENT_CODE` / `VITE_AUTH_CLIENT_SECRET` | Uni / App 客户端凭证 |
| App | `VITE_AUTH_CLIENT_APP_ID` / `VITE_APP_PACKAGE_NAME` | 小程序 AppID 或 App 包名 |

## 3. 启动数据库和缓存

```bash
pnpm db:up
```

默认会使用 `infra/docker-compose.yml` 启动 PostgreSQL 和 Redis。

## 4. 初始化 Prisma 和种子数据

```bash
pnpm --filter @rbac/backend prisma:generate
pnpm --filter @rbac/backend prisma:migrate
pnpm --filter @rbac/backend prisma:seed
```

种子会写入：

- 默认客户端：`web-console`、`uni-wechat-miniapp`、`native-app`
- 三种认证策略：用户名密码、邮箱验证码、手机号验证码
- 默认角色、权限目录、菜单树
- 演示账号
- OAuth Provider / Application 测试数据

## 5. 启动项目

```bash
pnpm dev
```

这个命令会启动：

- `@rbac/api-common`
- `@rbac/backend`
- `@rbac/web-frontend`
- `@rbac/app-frontend`

文档站单独启动：

```bash
pnpm dev:docs
```

## 6. 常用地址

| 服务 | 地址 |
| --- | --- |
| Web 控制台 | `http://localhost:5173` |
| Web 登录页 | `http://localhost:5173/login` |
| Backend API | `http://localhost:3300/api` |
| OAuth / OIDC Provider | `http://localhost:3300/oauth2/*` |
| 文档站 | `pnpm dev:docs` 后按终端输出访问 |
| OAuth 测试 Provider | `http://localhost:3310` |
| OAuth 测试 Application | `http://localhost:3320` |

## 7. 默认账号

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 超级管理员 | `admin` | `Admin123!` |
| 运营经理 | `manager` | `Manager123!` |
| 普通成员 | `user` | `User123!` |

验证码 mock：

- 邮箱验证码：`123456`
- 手机验证码：`654321`

## 8. 常用命令

```bash
pnpm lint
pnpm build

pnpm --filter @rbac/backend test
pnpm --filter @rbac/backend test -- auth.test.ts
pnpm --filter @rbac/backend test -- oauth.test.ts
pnpm --filter @rbac/docs build
```

如果只改一端，优先跑对应包的 `lint` / `build`。

## 9. 测试数据库

后端集成测试默认会从 `DATABASE_URL` 或 `TEST_DATABASE_URL` 推导一个带 `_test` 后缀的数据库。

当前测试按目录拆分：

```text
apps/backend/test/framework
apps/backend/test/integration
apps/backend/test/support/backend-testkit.ts
```

完整测试清单和每个用例的覆盖逻辑，直接看 [测试用例](/guide/testing)。
