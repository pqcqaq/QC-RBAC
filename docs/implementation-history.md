# Implementation History

Last updated: 2026-03-29

本文档记录最近一轮主要实现成果，用于帮助后续开发者快速恢复项目上下文。它不是计划，也不是宣传文案，而是“已经落地了什么”的摘要。

## 1. Monorepo 基线建立

- 仓库按 `pnpm workspace` 收敛为统一 monorepo。
- 明确分为四个主要边界：
  - `apps/backend`
  - `apps/web-frontend`
  - `apps/app-frontend`
  - `packages/api-common`
- 共享请求适配器、类型和 Header 常量下沉到 `api-common`，避免 Web 与 Uni 两端重复维护接口契约。

## 2. 后端 RBAC 基础能力落地

- 完成用户、角色、权限及关联表建模。
- 实现用户、角色、权限的完整 CRUD。
- 支持权限来源分析，用于解释某个用户为何拥有某个权限。
- 补齐 dashboard 汇总、实时频道和审计日志能力。

## 3. 认证体系从单一登录升级为“Client + Strategy”

- 新增 `AuthClient` 模型，系统级客户端需要通过 code + secret 才能调用认证接口。
- 新增 `AuthStrategy`、`UserAuthentication`、`VerificationCode` 三张核心表。
- 认证逻辑改为策略模式，当前内置：
  - 用户名密码
  - 邮箱验证码
  - 手机验证码
- 登录、注册、验证码发送、验证码校验不再写死在单一路径里，而是根据策略配置走不同处理器。
- strategy 支持 mock 开关和 mock value，便于本地联调。
- 刷新令牌与 token 链路保留 client 来源语义，避免多客户端之间相互串用。

## 4. ORM 层统一审计字段、软删除与雪花 ID

- 核心实体统一包含：
  - `id`
  - `createId`
  - `updateId`
  - `createdAt`
  - `updatedAt`
  - `deleteAt`
- 雪花算法成为统一主键生成方式。
- Prisma 扩展层统一注入 create/update/delete 语义：
  - 创建时自动补齐 `id/createId/updateId`
  - 更新时自动补齐 `updateId`
  - 删除时映射为 `deleteAt`
  - 查询默认过滤逻辑删除记录

## 5. 上传链路生产化

- Web 端头像上传改为直传 S3 兼容对象存储。
- 支持本地降级、单片上传和分片上传。
- 上传回调负责落库完成状态与 URL。
- 未完成单片直传会进入后台补偿流程。

## 6. 定时任务从独立 worker 合并到 backend timers

- 原先独立的后台 jobs 目录被移除。
- 统一在 `apps/backend/src/timers` 内建立 timer 注册中心。
- 基于 `toad-scheduler` 封装可复用 interval timer。
- 上传巡检已迁入 backend 主进程，在启动与关闭阶段统一纳管。

## 7. 菜单树与控制台路由体系重构

- 后端菜单表成为导航事实来源。
- 菜单节点明确区分：
  - directory
  - page
  - action
- 页面路由从“静态前端主导”收敛为“后端菜单 + 前端页面注册”协作模式。
- 控制台页面统一迁到 `/console/**`。
- 公共介绍页独立为 `/` 命名空间，对外展示项目能力而不是直接暴露后台壳子。

## 8. Web 前端工作台与页面规范收敛

- 建立统一的 ConsoleLayout / FrontendLayout 分层。
- 后台页面陆续按统一目录规范重构：
  - 搜索表单
  - 列表
  - 详情
  - 编辑
  - 页面局部组件
- 页面目录内新增 `components` 子目录，用于拆出细节组件。
- `PageScaffold`、工作台标签、菜单注入和页面元信息继续作为控制台体验基石。

## 9. 菜单管理与右键菜单完善

- 菜单结构管理页从原先难维护的交互模式重构为更明确的树面板 + 检查面板 + 弹窗编辑模式。
- 解决了树节点区域留白过大、展开/收起不顺手等问题。
- 为菜单页补齐右键菜单能力，统一结构性操作入口。
- 共享右键菜单抽象也应用于控制台其他区域。

## 10. 前端权限裁剪能力落地

- 新增 `v-permission` 与 `v-role` 指令。
- 支持 `and` / `or` 运算语义。
- 指令基于登录后拿到的角色列表和权限列表决定元素是否展示。
- 这是一层展示优化，不替代后端真实鉴权。

## 11. 公共前台与登录页视觉升级

- 公共前台新增项目首页、系统架构页、认证策略页。
- Header / Footer 统一由布局管理。
- 登录页重构为更正式的展示型布局，兼顾策略切换、验证码发送和项目价值表达。

## 12. 当前结果

到目前为止，这个仓库已经不是一个“登录 + 用户表 + 菜单页”的基础示例，而是一套具备以下特征的工程底座：

- 真正数据库驱动的 RBAC
- 多客户端、多策略认证
- 前台与控制台双命名空间
- 审计字段、软删除、雪花 ID 的数据层基线
- S3 兼容上传与补偿 timer
- 统一页面规范、右键菜单和展示层权限指令
- 可继续向更复杂业务系统演进的 Monorepo 结构

## 13. OAuth 授权页迁移到 Web 前端

- OAuth2 授权确认页与授权错误页从 backend 的 HTML 模板渲染迁移到 `apps/web-frontend`。
- `/oauth2/authorize` 在需要用户确认授权时，不再由 backend 输出页面，而是重定向到 web 前端路由：
  - `/oauth/authorize`
  - `/oauth/error`
- backend 新增授权会话 API，用于前端渲染和提交授权决策：
  - `GET /api/oauth/authorize-sessions/:sessionState`
  - `POST /api/oauth/authorize-sessions/:sessionState/decision`
- `packages/api-common` 新增授权会话与决策类型，并在 API factory 中补充对应客户端调用。
- web 前端新增 OAuth 授权确认页与错误页，实现会话加载、同意/拒绝提交和错误兜底跳转。
- backend 旧的 OAuth 页面模板与 EJS 依赖已移除，授权流程职责收敛为“协议处理 + API 提供”。
