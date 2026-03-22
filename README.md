# QC-RBAC

[![Docs](https://img.shields.io/badge/docs-rbac.zust.online-1677ff?style=flat-square&logo=vitepress&logoColor=white)](https://rbac.zust.online/)
[![License](https://img.shields.io/github/license/pqcqaq/QC-RBAC?style=flat-square)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/pqcqaq/QC-RBAC?style=flat-square)](https://github.com/pqcqaq/QC-RBAC/stargazers)
[![Last Commit](https://img.shields.io/github/last-commit/pqcqaq/QC-RBAC?style=flat-square)](https://github.com/pqcqaq/QC-RBAC/commits/main)

QC-RBAC 是一个围绕认证、授权、多端接入组织的 Monorepo。仓库当前包含后端服务、Web 控制台、uni-app 移动端、OAuth Provider / Client 测试项目，以及前后端共享的 API 协议层。

在线文档：<https://rbac.zust.online/>

根目录 README 只保留仓库入口信息。详细实现、扩展方式和测试说明统一放在在线文档和 `apps/docs`。

## 核心能力

- 认证体系：支持客户端校验、策略化登录注册、Refresh Token、用户偏好持久化。
- RBAC：用户、角色、权限、菜单树完整落库，控制台页面和按钮权限由菜单与权限共同驱动。
- OAuth / OIDC：既能作为 Provider 对外提供授权服务，也能作为 Client 接入第三方登录，支持 PKCE、`userinfo`、`introspect`、`revoke`。
- Web 控制台：动态菜单路由、分页列表、统一导出、工作台偏好同步到当前用户。
- Uni 移动端：自定义 Header、Tabbar、安全区适配，不依赖第三方 UI 组件库。
- 共享协议层：`packages/api-common` 统一客户端枚举、权限常量、请求适配器和 API 工厂。
- 测试：后端测试按 `framework` 与 `integration` 拆分，覆盖删除保护、导出抽象、认证、OAuth、RBAC、附件、客户端等主链路。

## 仓库结构

```text
simple-project-demo
├─ apps
│  ├─ backend                  # Express + Prisma + PostgreSQL + Redis
│  ├─ web-frontend             # Web 控制台
│  ├─ app-frontend             # uni-app 移动端
│  ├─ oauth-test-provider      # OAuth Provider 测试服务
│  ├─ oauth-test-application   # OAuth Client 测试应用
│  └─ docs                     # VitePress 文档站
└─ packages
   └─ api-common               # 共享类型、权限常量、请求抽象、API 工厂
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 准备环境变量

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/web-frontend/.env.example apps/web-frontend/.env
Copy-Item apps/app-frontend/env/.env.example apps/app-frontend/env/.env
```

关键变量：

- Backend：`DATABASE_URL`、`REDIS_URL`、`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、`CLIENT_ORIGIN`
- Web：`VITE_API_BASE_URL`、`VITE_AUTH_CLIENT_CODE`、`VITE_AUTH_CLIENT_SECRET`
- App：`VITE_SERVER_BASEURL`、`VITE_AUTH_CLIENT_CODE`、`VITE_AUTH_CLIENT_SECRET`

### 3. 启动 PostgreSQL 和 Redis

```bash
pnpm db:up
```

### 4. 初始化 Prisma 和种子数据

```bash
pnpm --filter @rbac/backend prisma:generate
pnpm --filter @rbac/backend prisma:migrate
pnpm --filter @rbac/backend prisma:seed
```

### 5. 启动开发环境

```bash
pnpm dev
```

按端启动：

```bash
pnpm dev:backend
pnpm dev:web
pnpm dev:app
pnpm dev:docs
```

## 常用地址

| 服务 | 地址 |
| --- | --- |
| Web 控制台 | `http://localhost:5173` |
| Web 登录页 | `http://localhost:5173/login` |
| Backend API | `http://localhost:3300/api` |
| OAuth / OIDC Provider | `http://localhost:3300/oauth2/*` |
| 在线文档 | `https://rbac.zust.online/` |
| 本地文档预览 | `http://localhost:6174` |
| OAuth 测试 Provider | `http://localhost:3310` |
| OAuth 测试 Application | `http://localhost:3320` |

## 默认种子数据

### 客户端

| code | 类型 | 用途 |
| --- | --- | --- |
| `web-console` | `WEB` | Web 控制台 |
| `web-uni-h5` | `WEB` | uni H5 / 本地 `localhost:9000` 调试 |
| `uni-wechat-miniapp` | `UNI_WECHAT_MINIAPP` | 微信小程序 |
| `native-app` | `APP` | 原生 App |

### 认证策略

- `username-password`
- `email-code`
- `phone-code`

### 演示账号

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 超级管理员 | `admin` | `Admin123!` |
| 运营经理 | `manager` | `Manager123!` |
| 普通成员 | `user` | `User123!` |

Mock 验证码：

- 邮箱验证码：`123456`
- 手机验证码：`654321`

## 常用命令

```bash
pnpm lint
pnpm build

pnpm --filter @rbac/backend test
pnpm --filter @rbac/backend test -- auth.test.ts
pnpm --filter @rbac/backend test -- oauth.test.ts

pnpm --filter @rbac/docs build
```

## 文档入口

- 在线文档：<https://rbac.zust.online/>
- 文档首页：[`apps/docs/index.md`](./apps/docs/index.md)
- 快速开始：[`apps/docs/guide/quick-start.md`](./apps/docs/guide/quick-start.md)
- 开发指南：[`apps/docs/guide/development.md`](./apps/docs/guide/development.md)
- 后端实现：[`apps/docs/guide/backend.md`](./apps/docs/guide/backend.md)
- Web 前端：[`apps/docs/guide/web-frontend.md`](./apps/docs/guide/web-frontend.md)
- Uni 前端：[`apps/docs/guide/uni-frontend.md`](./apps/docs/guide/uni-frontend.md)
- 共享抽象：[`apps/docs/guide/shared.md`](./apps/docs/guide/shared.md)
- 测试用例：[`apps/docs/guide/testing.md`](./apps/docs/guide/testing.md)
- 扩展指南：[`apps/docs/guide/extension.md`](./apps/docs/guide/extension.md)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=pqcqaq/QC-RBAC&type=Date)](https://star-history.com/#pqcqaq/QC-RBAC&Date)

## License

项目使用 [MIT](./LICENSE) 许可证。
