# RBAC Console Foundation

一个面向真实业务演进的 RBAC Monorepo 基础工程，提供后端权限服务、Web 控制台、Uni 移动端接入位点，以及跨端共享的 API 抽象。它不是“演示级 CRUD 模板”，而是从认证策略、客户端身份、审计字段、菜单驱动路由、上传补偿、软删除与雪花 ID 等基础能力开始，直接按可持续扩展的方式组织。

如果你正在寻找一套可以继续长成内部中后台、SaaS 管理台、运营控制台或多端账号体系的起点，这个仓库值得保留。如果这类基础工程对你有帮助，欢迎 Star。

## 为什么值得关注

- 后端不是假权限。用户、角色、权限、菜单、认证、验证码、客户端、刷新令牌、审计日志全部落库。
- 认证不是单一表单。支持“系统级 client + 策略级认证”双层模型，前端根据后端启用策略动态渲染登录与注册界面。
- 路由不是写死的。控制台页面统一挂在 `/console/**`，可访问页面由菜单树和权限配置共同驱动。
- 数据层不是裸 Prisma。核心实体统一审计字段、逻辑删除和雪花 ID，删除行为映射为 `deleteAt` 更新。
- 上传不是一次性 happy path。支持 S3 兼容直传、本地降级和定时巡检补偿。
- 前端不是只做列表页。已包含公共前台、正式化登录页、控制台工作台、右键菜单、权限指令与组件抽离规范。

## 项目预览

> [截图占位] 公共前台首页：展示产品定位、能力概览、系统架构入口和“进入控制台”按钮

> [截图占位] 认证策略介绍页：展示三种认证策略卡片、认证流程时间线、client 与 token 关系说明

> [截图占位] 登录页：左侧产品展示面板 + 右侧策略化登录/注册表单，支持验证码发送与 mock 回执展示

> [截图占位] 控制台工作台：侧边栏、顶部标签页、仪表盘概览、主题与布局偏好联动

> [截图占位] 菜单结构管理页：左侧树形结构、右侧检查面板、右键菜单、编辑弹窗

> [截图占位] Uni 移动端页面：登录 / 注册 / 我的权限视图 / 控制台入口概览

## 核心能力

### 1. 身份认证与客户端安全

- `AuthClient` 模型定义系统级客户端，当前内置：
  - `web-console`
  - `uni-wechat-miniapp`
- 所有认证相关接口都会校验客户端身份：
  - 登录
  - 注册
  - 发送验证码
  - 校验验证码
  - 刷新令牌
  - 登出
- Token 带有 client 语义，可追溯登录来源。
- `AuthStrategy` + `UserAuthentication` + `VerificationCode` 组成策略模式认证体系。
- 当前内置认证策略：
  - `username-password`
  - `email-code`
  - `phone-code`
- 支持策略级开关：
  - 是否启用
  - 是否允许登录
  - 是否允许注册
  - 是否允许验证码校验
  - 是否启用 mock

### 2. RBAC 与菜单驱动控制台

- 用户、角色、权限完整 CRUD。
- 用户权限来源分析。
- 菜单节点支持目录、页面、动作三级结构。
- 菜单树与权限绑定共同决定控制台导航与可操作范围。
- Web 前端支持：
  - 动态菜单注入
  - 页面缓存标签
  - 右键菜单
  - `v-permission`
  - `v-role`

### 3. 可靠性与审计

- 核心实体统一包含：
  - `id`
  - `createId`
  - `updateId`
  - `createdAt`
  - `updatedAt`
  - `deleteAt`
- 统一雪花算法主键生成。
- Prisma 扩展层统一注入：
  - 创建审计信息
  - 更新审计信息
  - 逻辑删除
  - 默认过滤软删除记录
- 审计日志记录关键行为。

### 4. 文件上传与后台补偿

- 支持 S3 兼容对象存储直传。
- 支持本地文件落盘作为降级路径。
- 支持单片与分片上传。
- 后端内置 `timers` 注册中心。
- 上传巡检 timer 会定时检查未完成的单片直传记录并补全状态。

### 5. 多端工程组织

- `apps/backend`：Express + Prisma + PostgreSQL + Redis + Socket.io
- `apps/web-frontend`：Vue 3 + Element Plus + Pinia + Vue Router + Vite
- `apps/app-frontend`：基于 unibest 结构的 uni-app 客户端
- `packages/api-common`：共享类型、请求适配器、API 工厂、权限常量

## 架构概览

```text
simple-project-demo
├─ apps
│  ├─ backend
│  │  ├─ prisma                # 数据模型、迁移、seed
│  │  └─ src
│  │     ├─ routes            # HTTP 路由
│  │     ├─ services          # 业务服务
│  │     ├─ middlewares       # 鉴权、错误处理、request context
│  │     ├─ timers            # 定时任务注册与具体 timer
│  │     └─ utils             # 审计、RBAC、密码、token、snowflake
│  ├─ web-frontend
│  │  └─ src
│  │     ├─ pages/frontend    # 对外展示页
│  │     ├─ pages/console     # 控制台业务页
│  │     ├─ directives        # v-permission / v-role
│  │     ├─ layouts           # Frontend / Console 布局
│  │     └─ stores            # auth / menus / workbench
│  └─ app-frontend            # Uni 端
└─ packages
   └─ api-common              # 共享请求与类型边界
```

## 关键设计

### 公共前台与控制台双命名空间

- `/`、`/architecture`、`/authentication` 面向访客与项目介绍。
- `/login` 作为控制台认证入口。
- `/console/**` 承载所有后台页面。
- 公共前台与控制台通过不同布局管理，避免项目一打开就直接落进后台壳子。

### Client + Strategy 双层认证模型

请求进入认证接口前，先验证客户端头：

- `X-RBAC-Client-Code`
- `X-RBAC-Client-Secret`

通过 client 校验后，再进入认证策略层。这样可以同时满足：

- 区分 Web 与 Uni 小程序等系统级接入方
- 保持登录、注册、验证码逻辑的后端统一治理
- 为后续接入短信、邮件、企业 SSO、第三方 OAuth 预留清晰扩展位

### 数据层统一审计和逻辑删除

项目没有把“软删除”留给页面层自行约定，而是在 Prisma 扩展层统一处理。只要是受管模型：

- `delete` 会映射为 `update deleteAt`
- `findFirst/findMany/findUnique` 默认过滤已删除记录
- `create/update/upsert` 自动补齐审计信息

这让仓库更接近生产可维护性的基线，而不是示例项目常见的“后期再补”。

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 PostgreSQL / Redis

```bash
pnpm db:up
```

### 3. 复制环境变量

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web-frontend/.env.example apps/web-frontend/.env
cp apps/app-frontend/env/.env.example apps/app-frontend/env/.env
```

Windows PowerShell 可以使用：

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/web-frontend/.env.example apps/web-frontend/.env
Copy-Item apps/app-frontend/env/.env.example apps/app-frontend/env/.env
```

### 4. 初始化数据库

```bash
pnpm --filter @rbac/backend prisma:generate
pnpm --filter @rbac/backend prisma:migrate
pnpm --filter @rbac/backend prisma:seed
```

### 5. 启动开发环境

```bash
pnpm dev
```

也可以按端分别启动：

```bash
pnpm dev:backend
pnpm dev:web
pnpm dev:app
```

### 6. 打开入口

- 公共前台：`http://localhost:5173/`
- 控制台登录：`http://localhost:5173/login`
- 后端 API：`http://localhost:3300/api`

## 环境变量说明

### Backend

主要文件：`apps/backend/.env`

重点变量：

- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AUTH_WEB_CLIENT_SECRET`
- `AUTH_UNI_WECHAT_MINIAPP_CLIENT_SECRET`
- `S3_*`
- `UPLOAD_RECONCILE_*`
- `CLIENT_ORIGIN`

### Web

主要文件：`apps/web-frontend/.env`

- `VITE_API_BASE_URL`
- `VITE_WS_URL`
- `VITE_AUTH_CLIENT_CODE`
- `VITE_AUTH_CLIENT_SECRET`

### Uni App

主要文件：`apps/app-frontend/env/.env`

- `VITE_SERVER_BASEURL`
- `VITE_AUTH_CLIENT_CODE`
- `VITE_AUTH_CLIENT_SECRET`
- `VITE_WX_APPID`

## 默认种子数据

### 客户端

- `web-console` / `rbac-web-client-secret`
- `uni-wechat-miniapp` / `rbac-uni-miniapp-secret`

### 认证策略

- 用户名密码：`username-password`
- 邮箱验证码：`email-code`
- 手机验证码：`phone-code`

### Mock 验证码

- 邮箱验证码：`123456`
- 手机验证码：`654321`

### 演示账号

- 超级管理员：`admin` / `Admin123!`
- 运营经理：`manager` / `Manager123!`
- 普通用户：`user` / `User123!`

同时内置邮箱与手机号认证标识，便于直接联调策略认证页面。

## 常用验证命令

```bash
pnpm --filter @rbac/backend lint
pnpm --filter @rbac/backend test
pnpm --filter @rbac/backend build

pnpm --filter @rbac/api-common build
pnpm --filter @rbac/web-frontend build
pnpm --filter @rbac/app-frontend type-check
```

## 文档地图

- `docs/README.md`：文档总览与阅读顺序
- `docs/project-memory.md`：当前项目状态、边界、关键约束与继续开发注意事项
- `docs/development-guidelines.md`：默认开发规范
- `docs/implementation-history.md`：最近一轮重要实现历史
- `docs/plans/*.md`：历史设计与规划快照

## 适合用于什么场景

- 企业内部管理后台基础工程
- SaaS 控制台与账号中心
- 多端统一身份接入层
- 需要从一开始就保留审计和软删除语义的业务系统
- 需要 Web 控制台 + Uni 小程序双端协同的项目

## License

当前仓库未单独声明开源许可证。如果你计划公开分发，请在发布前补充明确的 License 策略。

---

如果你也在搭建一套真正可扩展的 RBAC / Console 基础工程，而不是一次性 Demo，这个仓库会比单纯的脚手架更接近长期维护的起点。欢迎 Star，或直接基于它继续演进你的业务框架。
