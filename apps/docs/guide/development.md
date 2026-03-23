---
title: 开发指南
description: QC-RBAC 的实现地图，先看整体，再进入后端、Web、Uni 和共享层。
---

这页只做实现导航，不展开概念。

## 整体调用链

<MermaidDiagram
  label="QC-RBAC runtime flow"
  :code="[
    'flowchart LR',
    '  subgraph Clients',
    '    WEB[Web Console]',
    '    UNI[Uni Frontend]',
    '    APP[OAuth Test Application]',
    '  end',
    '  SHARED[packages/api-common]',
    '  API[apps/backend /api]',
    '  OAUTH[apps/backend /oauth2]',
    '  DB[(PostgreSQL)]',
    '  REDIS[(Redis)]',
    '  TIMER[Timers]',
    '',
    '  WEB --> SHARED',
    '  UNI --> SHARED',
    '  SHARED --> API',
    '  API --> DB',
    '  API --> REDIS',
    '  APP --> OAUTH',
    '  OAUTH --> DB',
    '  TIMER --> DB',
  ].join('\n')"
/>

## 先看哪一页

| 页面 | 你会看到什么 | 核心文件 |
| --- | --- | --- |
| [后端实现](/guide/backend) | 路由、service、Prisma 扩展、OAuth、上传、导出、timer | `apps/backend/src/**` |
| [Web 前端](/guide/web-frontend) | 登录、动态菜单路由、工作台状态、分页列表、导出 | `apps/web-frontend/src/**` |
| [Uni 前端](/guide/uni-frontend) | 登录注册、门户、个人页、设置页、自定义 Header / Tabbar / Safe Area | `apps/app-frontend/src/**` |
| [共享抽象](/guide/shared) | 权限常量、客户端枚举、请求客户端、适配器、API 工厂 | `packages/api-common/src/**` |
| [内置组件](/components/) | 当前已经稳定复用的组件、参数、插槽和使用示例 | `apps/web-frontend/src/components/**` |
| [测试用例](/guide/testing) | framework / integration 测试文件、覆盖点、运行方式 | `apps/backend/test/**` |
| [扩展指南](/guide/extension) | 新增模块、新增客户端类型、新增列表页与测试的具体步骤 | 跨端操作说明 |

## 当前统一约定

- 权限码由 `packages/api-common/src/constants/permissions.ts` 统一维护，后端 seed 和前端权限判断都依赖它。
- 后端列表接口统一使用分页，前端列表页统一通过 `page` / `pageSize` 请求并保留筛选状态。
- 列表导出统一走后端 `createExcelExportHandler` 和前端 `useDownload` / `ListExportButton`。
- 表单里的关联选择统一使用 `RelationSelectFormItem`，搜索区走插槽，选项接口统一走 `POST + body`，并且后端必须同时提供 `resolve(ids)` 回显接口。
- Web 控制台页面默认采用 `View.vue + components/ + *-management.ts` 的结构。
- Uni 页面统一使用自定义组件和 `navigationStyle: 'custom'`，不显示原生 Header。
- 受管模型删除时会自动做引用检查，引用关系来自 Prisma DMMF，不需要手填 refs 映射。
- TypeScript 源码禁止显式 `any`；动态边界必须补窄类型、声明类型或 `unknown` + 明确收敛，不能用 `as any` 或 `: any` 跳过。
- 如果第三方插件会生成带 `any` 的声明文件，优先关闭它的 dts 产出并改为仓库内手写声明，避免每次构建把 `any` 写回源码。
- 测试按 `framework` 和 `integration` 拆分，文档也要同步反映新的测试入口和覆盖范围。

## 建议阅读顺序

1. 先读 [后端实现](/guide/backend)，理解数据模型和 API 是怎么工作的。
2. 再读 [Web 前端](/guide/web-frontend)，理解控制台页面是如何接后端能力的。
3. 如果要复用现成组件，直接读 [内置组件](/components/)。
4. 如果要改移动端，再读 [Uni 前端](/guide/uni-frontend)。
5. 如果要补测试、查覆盖面或定位回归，直接读 [测试用例](/guide/testing)。
6. 如果要动共享协议或新增客户端类型，直接读 [共享抽象](/guide/shared) 和 [扩展指南](/guide/extension)。
