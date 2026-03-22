---
title: 技术选型
description: 当前工程为什么选择这组技术，以及这些技术如何形成清晰边界。
---

## 选型原则

这套工程的技术选择并不追求“堆最流行的名词”，而是围绕三个目标展开：

1. 让身份与权限边界尽可能显式。
2. 让 Web、移动端与后端共享协议，而不是共享 UI。
3. 让系统能力可以持续往上叠，而不是下一轮重写。

所以你会看到项目刻意保持后端模块清晰、前端路由数据化、移动端组件自定义、共享包边界明确。

## 选型总览

| 层级 | 当前技术 | 选择原因 |
| --- | --- | --- |
| Backend | Express 5 + Zod | 路由与中间件足够直接，协议边界清楚，便于把鉴权、client 校验和 OAuth 流程写成显式代码 |
| ORM / 数据 | Prisma + PostgreSQL | 迁移、类型安全和数据模型表达足够清晰，便于在 Prisma 扩展层统一软删除与审计字段 |
| Cache / Session | Redis | refresh token 与权限缓存有自然落点 |
| 实时能力 | Socket.io | 实时协作与通知接入成本低 |
| Timer | toad-scheduler | 上传补偿与 OAuth 上游 token 刷新都可以正式纳入服务进程 |
| Web | Vue 3 + Vite + Pinia + Vue Router + Element Plus | 管理台开发效率高，路由与状态组合也便于菜单驱动 |
| Mobile | uni-app + 自定义组件 | 兼顾 App / 小程序，多端复用协议但保留原生化 UI 调整空间 |
| Shared | `packages/api-common` | 统一 client 类型、权限常量、请求配置与跨端类型定义 |
| Docs | VitePress + Mermaid | 文档即站点，内容轻量、结构明确、适合展示实现逻辑与架构图 |

## 为什么后端保持“轻框架”

当前后端没有再包一层更重的企业框架，而是选择 Express + service 分层。这种方式更适合这个仓库的目标：

- OAuth2 / OIDC、PKCE、第三方登录回跳这类协议逻辑本身就需要显式控制。
- Client + Strategy 双层认证更适合以 middleware + service 的形式组合。
- Prisma 扩展层已经承接了数据治理能力，没必要再让业务逻辑被框架生命周期包裹得更深。

简单说，这个仓库想优先保证“读源码就知道系统怎么工作”。

## 为什么要单独抽 `api-common`

`packages/api-common` 不只是类型包，它承担的是跨端协议边界：

- 权限常量来自这里，后端 seed 与前端权限判断共同依赖它。
- client 类型、公开配置与下载请求定义都在这里统一。
- Web、移动端都通过共享配置发请求，而不是各自复制 headers、query 和下载逻辑。

这样改一处协议定义，能同时影响三端。

<MermaidDiagram
  label="Dependency Direction"
  :code="[
    'flowchart TD',
    '  COMMON[packages/api-common]',
    '  BACKEND[apps/backend]',
    '  WEB[apps/web-frontend]',
    '  APP[apps/app-frontend]',
    '',
    '  BACKEND --> COMMON',
    '  WEB --> COMMON',
    '  APP --> COMMON',
  ].join('\n')"
/>

## 为什么移动端是自定义组件

项目之前已经经历过一轮 UI 收敛，现在移动端明确选择“自定义组件 + 统一 layout + 自己处理安全区”，理由也很现实：

- 需要同时适配 App 与微信小程序，细节往往超出第三方 UI 库默认假设。
- 原生风格的简洁布局，往往不适合大面积圆角容器与重包装表单。
- 统一的 Header、Tabbar、Safe Area 逻辑应该由项目自己掌控，避免被第三方库样式绑架。

所以在当前仓库里，Web 与移动端并不追求同一套组件，而是追求同一套协议。

## 为什么文档站也放在 `apps`

把文档放进 `apps/docs` 而不是顶层零散 Markdown，有几个直接收益：

- 文档可以跟着 monorepo 一起构建、一起 lint、一起发布。
- 文档可以引用真实目录、真实模块和真实运行命令，不会慢慢和代码脱节。
- 需要 Mermaid、组件增强、站点首页时，不必额外再起一个官网仓库。

这也是为什么当前 docs 站点会专门讲“现有功能是如何实现的”，而不是只做一层浅介绍。

## 未来仍然可替换的部分

当前选型并不是封死未来演进。相反，它保留了几个明显可替换点：

- 文件存储后端可以继续扩展 OSS / S3 兼容实现。
- Web 控制台 UI 可以继续替换局部组件体系，但路由与权限边界不需要重做。
- 移动端可以继续按平台差异扩展 Header / Tabbar / Login 组件，而不会影响认证协议。
- OAuth Provider / Application 的数量可继续增长，client 配置模型也已支持差异化字段。

技术选型在这里的目的，不是一次选对，而是让后续更换成本可控。
