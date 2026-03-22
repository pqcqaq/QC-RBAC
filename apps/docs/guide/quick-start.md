---
title: 快速开始
description: 用最少步骤把数据库、后端、前端和文档站一起跑起来。
---

## 环境准备

建议先具备以下基础环境：

- `pnpm 10.x`
- Docker 或本地可用的 PostgreSQL / Redis
- 可正常运行当前仓库依赖的 Node.js LTS 环境

项目是 monorepo，建议直接在仓库根目录完成所有安装与启动操作。

## 1. 安装依赖

```bash
pnpm install
```

安装完成后，`postinstall` 会先构建 `@rbac/api-common`，保证共享类型可被各端直接引用。

## 2. 准备环境变量

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/web-frontend/.env.example apps/web-frontend/.env
Copy-Item apps/app-frontend/env/.env.example apps/app-frontend/env/.env
```

如果你使用 Bash，也可以使用普通 `cp`。

### 当前默认环境文件

- `apps/backend/.env`
- `apps/web-frontend/.env`
- `apps/app-frontend/env/.env`

### 需要重点确认的变量

| 位置 | 变量 | 说明 |
| --- | --- | --- |
| Backend | `DATABASE_URL` | PostgreSQL 连接串 |
| Backend | `REDIS_URL` | Redis 连接串 |
| Backend | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 会话签名密钥 |
| Backend | `CLIENT_ORIGIN` | Web 客户端允许来源 |
| Web | `VITE_AUTH_CLIENT_CODE` / `VITE_AUTH_CLIENT_SECRET` | Web 端 client 标识 |
| App | `VITE_AUTH_CLIENT_CODE` / `VITE_AUTH_CLIENT_SECRET` | 移动端 client 标识 |
| App | `VITE_AUTH_CLIENT_APP_ID` | 微信小程序或移动端标识 |

::: warning 注意
`apps/backend/.env.example` 当前主要覆盖核心服务变量。OAuth/OIDC 与上游 token 刷新相关变量在
`apps/backend/src/config/env.ts` 中带有默认值，但生产环境不应依赖默认回退，应显式配置。
:::

## 3. 启动数据库与缓存

```bash
pnpm db:up
```

默认会根据 `infra/docker-compose.yml` 拉起 PostgreSQL 与 Redis。

## 4. 初始化 Prisma

```bash
pnpm --filter @rbac/backend prisma:generate
pnpm --filter @rbac/backend prisma:migrate
pnpm --filter @rbac/backend prisma:seed
```

这里会写入：

- 默认客户端
- 三种认证策略
- 默认角色与权限目录
- 默认菜单树
- 演示账号
- 本地 OAuth Provider / Application 测试数据

## 5. 启动主应用

```bash
pnpm dev
```

这个命令会启动：

- `@rbac/api-common` 监听构建
- `@rbac/backend`
- `@rbac/web-frontend`
- `@rbac/app-frontend`

文档站被独立排除在默认 `pnpm dev` 之外，避免常规业务开发时多起一个服务。

### 单独启动某一端

```bash
pnpm dev:backend
pnpm dev:web
pnpm dev:app
pnpm dev:docs
```

## 6. 常用访问地址

| 服务 | 地址 |
| --- | --- |
| Web 前台 / 控制台 | `http://localhost:5173` |
| 登录页 | `http://localhost:5173/login` |
| Backend API | `http://localhost:3300/api` |
| 文档站 | 运行 `pnpm dev:docs` 后查看终端输出 |
| OAuth 测试 Provider | `http://localhost:3310` |
| OAuth 测试 Application | `http://localhost:3320` |

## 7. 默认账号与测试数据

### 演示账号

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 超级管理员 | `admin` | `Admin123!` |
| 运营经理 | `manager` | `Manager123!` |
| 普通成员 | `user` | `User123!` |

### 默认认证策略

- `username-password`
- `email-code`
- `phone-code`

### Mock 验证码

- 邮箱验证码：`123456`
- 手机验证码：`654321`

### 默认客户端

- `web-console`
- `uni-wechat-miniapp`
- `native-app`

## 8. 可选：调试 OAuth 生态

项目内已经放了两个测试应用，便于联调本系统既做 Provider、又接第三方登录的能力。

```bash
pnpm --filter @rbac/oauth-test-provider dev
pnpm --filter @rbac/oauth-test-application dev
```

默认 seed 会同时写入：

- 一个外部 OAuth Provider：`demo-provider`
- 一个使用本系统作为 Provider 的 OAuth Application：`demo-oauth-app`

## 9. 常用校验命令

```bash
pnpm lint
pnpm build

pnpm --filter @rbac/backend test
pnpm --filter @rbac/docs build
```

如果你只改了某一端，优先在对应 package 内完成 lint / build，再决定是否跑全仓校验。
