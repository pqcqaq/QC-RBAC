# RBAC Monorepo Starter

一个基于 `pnpm workspace` 的 RBAC 基础项目，包含：

- `apps/backend`：Express + Prisma + PostgreSQL + Redis + Socket.io + 内置 timers
- `packages/api-common`：跨 Web / uni-app 的请求封装、类型和请求 adaptor
- `apps/web-frontend`：Vue 3 + TypeScript + Element Plus + Pinia + Vue Router + Vite 8
- `apps/app-frontend`：基于官方 unibest / wot-ui 的 uni-app 客户端

## 核心能力

- 注册 / 登录 / 刷新令牌 / 登出
- 用户、角色、权限的完整 CRUD
- RBAC 权限分配与用户权限来源分析
- 审计日志检索、实时频道、头像上传
- 未完成上传定时巡检（单文件 S3 直传补偿）
- Redis 权限缓存 + 刷新令牌会话存储
- 头像上传（S3 兼容对象存储 + 本地降级）
- Socket.io 实时协同频道 / 审计广播
- Web 管理面板 + App 端登录与权限查看

## 推荐启动顺序

```bash
pnpm install
pnpm db:up
cp apps/backend/.env.example apps/backend/.env
pnpm --filter @rbac/backend prisma:generate
pnpm --filter @rbac/backend prisma:migrate
pnpm --filter @rbac/backend prisma:seed
pnpm dev
```

当前仓库默认后端端口已经统一为 `3300`，因为本机 `3000` 常被其他本地服务占用。

如果你需要临时覆盖端口，可以用环境变量，例如：

```bash
set PORT=3300&& set CLIENT_ORIGIN=http://127.0.0.1:4173&& pnpm --filter @rbac/backend dev
```

Web 端可参考 `apps/web-frontend/.env.example` 配置 API 与 WebSocket 地址。

上传巡检 timer 已经内置在 `apps/backend/src/timers`，默认跟随后端进程一起启动，可通过 `apps/backend/.env` 中的 `UPLOAD_RECONCILE_*` 变量调整。

## 默认种子账号

- 超级管理员：`admin@example.com` / `Admin123!`
- 运营经理：`manager@example.com` / `Manager123!`
- 普通用户：`user@example.com` / `User123!`

## 已实现页面

- Web：登录 / 注册、仪表盘、审计日志、用户管理、角色管理、权限目录、权限来源分析、实时协作
- App：登录 / 注册、移动端仪表盘、我的角色与有效权限

## 持续开发记忆

为避免多轮开发后丢失上下文，仓库内已经补充项目级记忆文档：

- `docs/project-memory.md`：当前项目状态、核心约束、架构决策、开发流程、验证规则
- `docs/plans/2026-03-20-rbac-monorepo-design.md`：最初的实现设计与任务拆分

后续继续开发前，建议先读这两份文档。
