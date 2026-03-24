---
title: 技术选型
description: 当前技术栈、职责边界和可替换点。
---

## 选型总览

| 层级 | 当前技术 | 当前职责 | 替换边界 |
| --- | --- | --- | --- |
| Backend | Express 5 + Zod | 路由、中间件、参数校验 | 可替换 Web 框架，但 route / service 分层建议保留 |
| ORM / 数据 | Prisma + PostgreSQL | 数据模型、迁移、类型安全、运行时受管数据库访问 | 可替换 ORM，但 `BackendRuntimeContext + 受管 Prisma` 承担的审计 / 软删除 / 事务治理逻辑需要一起迁移 |
| Cache / Session | Redis | refresh token、缓存 | 可替换存储实现，不影响业务路由结构 |
| Timer | toad-scheduler | token 刷新、上传补偿 | 可迁移到任务平台，但 timer registry 的模块边界建议保留 |
| Web | Vue 3 + Vite + Pinia + Vue Router + Element Plus | 控制台、动态路由、工作台状态 | 可替换 UI 组件库，不影响菜单驱动路由模式 |
| Uni | uni-app + 自定义组件 | 小程序 / App 页面与自定义布局 | 组件和样式可以继续调整，协议层不变 |
| Shared | `packages/api-common` | 请求抽象、共享类型、客户端枚举、实时协议、API 工厂 | 这是跨端协议边界，不建议拆散 |
| Testing | `node:test` + `supertest` + `backend-testkit` | framework 抽象验证、API 集成测试、上传/导出/OAuth 测试基建 | 可替换测试工具，但分层思路建议保留 |
| Docs | VitePress + Mermaid | 开发文档与架构图 | 文档站可以替换，但内容组织方式建议保留 |

## 这些选择解决了什么问题

- Express 让 OAuth/OIDC、客户端校验、文件回调这种协议逻辑足够直观。
- Prisma 让 schema、迁移、类型和关系检查能围绕一份模型工作。
- `api-common` 避免 Web 和 Uni 各自维护一套请求规范。
- Uni 端自定义组件可以彻底控制 Header、Tabbar 和安全区，不受第三方 UI 库限制。

## 当前明确保留的边界

- 前后端共享协议，不共享 UI。
- 后端 route 负责协议，service 负责业务，`BackendRuntimeContext + 受管 Prisma` 负责请求上下文与数据治理。
- Web 菜单和路由由后端菜单树驱动，不写死在前端。
- Uni 页面风格由项目自己控制，不依赖外部组件库。

## 后续可替换的部分

- 文件存储可以继续扩展新的 provider。
- Web 组件库可以继续收敛或替换。
- 定时任务可以迁移到外部调度系统。
- 文档站样式可以继续改，但开发者导向的信息结构不应再退回宣传页模式。
