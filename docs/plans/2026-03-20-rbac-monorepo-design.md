# RBAC Monorepo Implementation Plan

> Historical snapshot: 这是 2026-03-20 的初始设计计划。当前真实状态请优先参考 `README.md`、`docs/project-memory.md` 与 `docs/development-guidelines.md`。

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个可直接扩展的 monorepo RBAC 基础项目，覆盖 backend、web、app 与共享 API 层。

**Architecture:** 采用 `pnpm workspace` 管理多包。`backend` 提供认证、RBAC、文件上传、实时事件和权限来源分析 API；`api-common` 提供共享 DTO、权限常量和请求适配器；`web-frontend` 提供高质感管理控制台；`app-frontend` 提供基于 unibest 组织方式的登录和权限视图。

**Tech Stack:** Express, TypeScript, Prisma, PostgreSQL 18, Redis 6, Socket.io, Vue 3, Element Plus, Pinia, Vue Router, uni-app, unibest-style project layout.

---

### Task 1: Workspace scaffolding

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `infra/docker-compose.yml`

**Step 1:** 创建 monorepo 根配置和统一脚本。

**Step 2:** 约定 `apps/*` 与 `packages/*` 的目录边界。

**Step 3:** 添加数据库与缓存容器编排。

### Task 2: Shared API package

**Files:**
- Create: `packages/api-common/src/**/*`

**Step 1:** 设计统一的 `RequestAdaptor` 接口。

**Step 2:** 实现 `fetch` 与 `uni.request` 两套适配器。

**Step 3:** 输出 auth / users / roles / permissions / dashboard / realtime 的 API 工厂与类型。

### Task 3: Backend RBAC

**Files:**
- Create: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/src/**/*`

**Step 1:** 建模用户、角色、权限、关联表、刷新令牌、媒体资源、聊天消息。

**Step 2:** 实现注册、登录、刷新、登出与当前用户查询。

**Step 3:** 实现用户、角色、权限的完整 CRUD 与权限检查。

**Step 4:** 实现用户权限来源分析和 dashboard 汇总。

**Step 5:** 实现 OSS 上传服务和 Socket.io 协同频道。

### Task 4: Web admin console

**Files:**
- Create: `apps/web-frontend/src/**/*`

**Step 1:** 设计高级感布局、品牌配色和管理台导航。

**Step 2:** 实现登录态、路由守卫与权限控制。

**Step 3:** 实现仪表盘、用户管理、角色管理、权限管理、权限来源分析与实时协同页。

### Task 5: App frontend

**Files:**
- Create: `apps/app-frontend/**/*`

**Step 1:** 按 unibest 习惯搭建目录与配置文件。

**Step 2:** 复用 `api-common` 的 uni 适配器实现登录、个人信息、权限视图。

**Step 3:** 提供一个轻量但完整的移动端管理入口。
