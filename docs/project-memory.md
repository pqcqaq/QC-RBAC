# Project Memory

Last updated: 2026-03-29

## 1. 项目定位

这是一个面向长期演进的 RBAC / Console 基础工程，不是一次性 CRUD Demo。仓库目标是提供一套可以继续扩展为中后台、运营平台、SaaS 控制台或多端账号中心的统一底座。

当前目标包含：

- 真实的后端 RBAC 服务
- 对外可展示的 Web 前台
- 专业化的 Web 控制台
- 保持官方结构的 Uni 客户端接入位点
- 跨端共享的 API 请求与类型边界
- 具备审计、软删除、策略认证和后台 timer 的基础设施

## 2. 固定边界

### Monorepo 结构

- `apps/backend`
- `apps/web-frontend`
- `apps/app-frontend`
- `packages/api-common`

### 不应轻易改变的结构决策

- Web 继续维持 `frontend` 与 `console` 双命名空间。
- App 继续维持 unibest 官方结构。
- 后端 timer 统一在 `apps/backend/src/timers` 注册。
- 跨端契约继续由 `packages/api-common` 承担。

## 3. 当前技术栈

### Backend

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Redis
- JWT
- bcrypt
- Socket.io
- S3 compatible storage
- toad-scheduler

### Web

- Vue 3
- TypeScript
- Element Plus
- Pinia
- Vue Router
- Vite
- UnoCSS / Iconify

### App

- uni-app
- unibest structure
- Wot UI
- Pinia

### Shared

- `packages/api-common`
  - API factory
  - fetch adaptor
  - uni adaptor
  - shared auth / rbac / file DTO
  - auth client header constants

## 4. 当前已实现状态

### 4.1 Backend

已实现：

- 认证：
  - 登录
  - 注册
  - 刷新令牌
  - 登出
  - 当前用户
  - 认证策略列表
  - 验证码发送
  - 验证码校验
- RBAC：
  - 用户 / 角色 / 权限 CRUD
  - 权限来源分析
  - 菜单树 CRUD
  - 当前用户可访问菜单树
- 其他：
  - dashboard summary
  - audit logs
  - realtime channel
  - avatar upload
  - upload reconcile timer

### 4.2 认证模型

认证分两层：

1. `AuthClient`
   - 系统级客户端身份
   - 通过 `X-RBAC-Client-Code` 与 `X-RBAC-Client-Secret` 校验
2. `AuthStrategy`
   - 认证方式定义
   - 当前内置三种：
     - `username-password`
     - `email-code`
     - `phone-code`

相关模型：

- `AuthClient`
- `AuthStrategy`
- `UserAuthentication`
- `VerificationCode`
- `RefreshToken`

当前 seed：

- client：
  - `web-console`
  - `uni-wechat-miniapp`
- mock code：
  - 邮箱 `123456`
  - 手机 `654321`

### 4.3 数据层规则

受管实体默认具备：

- `id`
- `createId`
- `updateId`
- `createdAt`
- `updatedAt`
- `deleteAt`

当前语义：

- 主键统一雪花 ID
- `delete` -> `deleteAt`
- 查询默认排除逻辑删除
- 审计字段通过 Prisma 扩展自动处理

### 4.4 Web 前端

当前结构：

- `pages/frontend`
  - 项目首页
  - 系统架构页
  - 认证策略页
  - 404 页
- `pages/console`
  - 登录页
  - 仪表盘
  - 用户管理
  - 角色管理
  - 权限管理
  - 菜单结构管理
  - 审计日志
  - 权限来源分析
  - 实时协作

当前特性：

- FrontendLayout / ConsoleLayout 分离
- 控制台路由集中在 `/console/**`
- 登录后动态注入菜单与控制台页面
- 工作台标签、布局偏好、页面过渡等状态持久化
- `v-permission` / `v-role`
- 页面目录下 `components` 子目录规范
- 搜索表单、列表、详情、编辑等细节从页面组件中下沉

### 4.5 App 前端

当前方向：

- 保持 unibest 项目组织方式
- 复用 `api-common`
- 已包含登录 / 注册 / 首页 / 我的 / 权限相关接入位点

## 5. 关键架构原则

### 5.1 后端定义，前端消费

以下内容应继续以后端为事实来源：

- 菜单树
- 页面/动作权限绑定
- 认证策略开关
- 客户端身份校验

前端主要负责：

- 读取配置
- 渲染对应 UI
- 在展示层裁剪无权限操作

### 5.2 公共前台与控制台必须分离

- `/` 命名空间用于介绍项目、承接外部访问和信任建立。
- `/console` 命名空间用于后台业务操作。
- 不要让控制台壳子重新吞掉公共前台入口。

### 5.3 页面组件只做编排

对 Web 管理页，默认规范是：

- 页面组件负责 orchestration
- 搜索表单、表格、详情、编辑弹窗、右键菜单等拆到 `components`
- 共享体验问题优先在全局样式、共享组件、布局层修复

### 5.4 展示层权限不是最终裁决

- `v-permission` / `v-role` 只负责隐藏按钮与操作入口
- 后端 RBAC 才是最终权限裁决

### 5.5 OAuth 授权页与裁决边界

- OAuth 授权确认页与错误页可以放在 Web 前端承载，但前端只负责展示与交互，不负责安全裁决。
- 当前登录用户身份必须由后端会话/令牌识别，不依赖前端 store 或 localStorage 的登录态。
- OAuth 授权最终结果（是否允许、重定向目标）必须由后端返回，前端不能自行拼接或决定 redirect。
- 授权会话的所属用户校验必须在后端完成，避免跨账号串用 `session_state`。
- 前端 OAuth 页面应通过后端 API 拉取授权会话详情并提交 `approve/deny`，后端再返回最终 `redirectUrl`。

### 5.5 文档需要同步维护

发生架构变化时，至少同步更新：

- `README.md`
- `docs/project-memory.md`
- `docs/development-guidelines.md`

## 6. 默认端口与入口

- backend：`3300`
- web：默认 `5173`
- public frontend：`/`
- login：`/login`
- console：`/console`

不要单独修改某一端口而不同时更新依赖它的环境变量和文档。

## 7. 优先查看的文件

继续开发前，先看：

1. `README.md`
2. `docs/README.md`
3. `docs/project-memory.md`
4. `docs/development-guidelines.md`
5. `docs/implementation-history.md`

关键实现锚点：

- backend 启动入口：`apps/backend/src/main.ts`
- backend timers：`apps/backend/src/timers/index.ts`
- Prisma 扩展：`apps/backend/src/lib/prisma.ts`
- 认证策略：`apps/backend/src/services/auth-strategies.ts`
- auth routes：`apps/backend/src/routes/auth.ts`
- web router：`apps/web-frontend/src/router/index.ts`
- access directives：`apps/web-frontend/src/directives/access.ts`
- frontend 内容：`apps/web-frontend/src/pages/frontend`
- console 页面：`apps/web-frontend/src/pages/console`

## 8. 验证方式

- Backend：
  - `pnpm --filter @rbac/backend lint`
  - `pnpm --filter @rbac/backend test`
  - `pnpm --filter @rbac/backend build`
- Shared API：
  - `pnpm --filter @rbac/api-common lint`
  - `pnpm --filter @rbac/api-common build`
- Web：
  - `pnpm --filter @rbac/web-frontend lint`
  - `pnpm --filter @rbac/web-frontend build`
- App：
  - `pnpm --filter @rbac/app-frontend type-check`

## 9. 不可退化的约束

- RBAC 必须保持真实数据库驱动
- App 必须保持 unibest 结构
- 控制台路由必须继续聚合在 `/console/**`
- 菜单树继续作为控制台导航事实来源
- 认证接口必须继续校验 client 身份
- 认证流程继续由 strategy 模式承载
- 核心实体继续维持审计字段 + 软删除 + 雪花 ID
- 后台定时任务继续收敛到 backend timers
- Web 页面继续遵守“页面编排 + 目录内 components 拆分”的规范
