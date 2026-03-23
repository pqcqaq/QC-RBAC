---
title: 扩展指南
description: 新增模块、新增客户端类型、新增列表页和测试时的具体步骤。
---

## 推荐扩展顺序

<MermaidDiagram
  label="Feature extension order"
  :code="[
    'flowchart LR',
    '  Schema[Prisma schema]',
    '  Shared[api-common types + api factory]',
    '  Backend[backend routes + services]',
    '  Frontend[web / uni pages]',
    '  Tests[framework / integration tests]',
    '  Docs[apps/docs]',
    '',
    '  Schema --> Shared --> Backend --> Frontend --> Tests --> Docs',
  ].join('\n')"
/>

这个顺序的核心原因是：

- schema 决定数据边界
- `api-common` 决定协议边界
- backend 实现真正行为
- frontend 只消费已经稳定的协议
- tests 和 docs 用来把边界固定下来

## 新增一个业务模块

推荐按下面顺序做。

### 1. 数据模型

- 在 `apps/backend/prisma/schema.prisma` 增加模型和关系
- 如果模型需要统一审计、Snowflake ID、软删除，把模型名加入 `apps/backend/src/lib/prisma.ts`

### 2. 删除保护

如果模型和其他模型存在 Prisma 关系，删除保护会自动识别。

原因：

- `apps/backend/src/lib/delete-reference-checker.ts` 会读取 Prisma 的关系元数据
- 不需要手写 refs 映射

你只需要保证：

- Prisma schema 关系正确
- 模型走受管删除路径

### 3. 后端接口

- 在 `apps/backend/src/routes` 增加路由文件
- 复杂逻辑放进 `apps/backend/src/services`
- 如果是列表接口，统一返回：

```ts
{
  items: [],
  meta: { page, pageSize, total }
}
```

### 4. 权限与菜单

- 在 `packages/api-common/src/constants/permissions.ts` 增加权限码
- 在 `apps/backend/src/services/system-rbac.ts` 中决定是否把页面和行为挂到菜单树
- 如果需要默认角色拥有权限，也在 seed 流程中同步

### 5. 共享类型和 API

- 在 `packages/api-common/src/types` 增加类型
- 在 `packages/api-common/src/api/factory.ts` 增加 API 方法

### 6. Web 控制台页面

按既有模式新增：

```text
pages/console/<module>
├─ components/
├─ <Module>View.vue
└─ <module>-management.ts
```

优先复用：

- `usePageState`
- `useResourceEditor`
- `useResourceDetail`
- `useResourceRemoval`
- `ListExportButton`
- `RelationSelectFormItem`

如果页面里有外键或多对多选择，不要再手写一个新的弹窗选择器，优先复用 `RelationSelectFormItem`，并让搜索表单走 `#search` 插槽。

### 7. Uni 页面

如果模块需要移动端页面：

- 新增 `pages/<module>/<page>.vue`
- 使用 `AppPageShell`
- 请求统一走 `appApi`

### 8. 测试

测试按职责拆分到：

- `apps/backend/test/framework`
- `apps/backend/test/integration`

至少覆盖：

- 授权是否生效
- 列表查询是否可用
- 新增 / 更新 / 删除是否正常
- 删除保护是否符合预期

### 9. 文档

功能落地后，同步更新 `apps/docs`：

- 新增页面或菜单，更新 `guide/web-frontend.md` 或 `guide/uni-frontend.md`
- 新增接口、实体、后台能力，更新 `guide/backend.md`
- 新增共享类型或 API，更新 `guide/shared.md`
- 新增或重构内置组件，更新 `components/**`
- 新增测试或测试拆分，更新 `guide/testing.md`

## 新增一个列表页并支持导出

后端：

1. 写分页查询接口
2. 使用 `createExcelExportHandler(...)` 增加 `/export`
3. 如果列头固定，传 `columns: []`
4. 如果列头要根据导出记录动态展开，传 `columns: ({ query, rows }) => []`
5. 如果还会给表单关系选择复用，再单独提供 `options` 接口

前端：

1. 列表页正常调用分页接口
2. 导出按钮传入 `api.<module>.export(...)`
3. 如果后端暂时返回完整数组，前端可以在筛选结果上做本地分页，但接口目标仍然是标准分页结构

关系选择器额外约定：

1. `options` 接口统一用 `POST`
2. 查询参数放在 body，至少包含 `page`、`pageSize`
3. 业务过滤字段直接平铺，不再包一层 `search`
4. 分页返回值统一为 `items + meta`
5. 同时提供 `POST .../options/.../resolve`
6. `resolve` 的 body 固定为 `{ ids: string[] }`
7. `resolve` 返回值直接是行数组，顺序按 ids 保持

## 新增客户端类型

这是一个跨端改动，建议按这个顺序做。

1. `packages/api-common/src/types/auth-client.ts`
   - 增加 `AuthClientType`
   - 增加 config 类型
   - 扩展 `buildAuthClientHeaders(...)`
2. `apps/backend/src/config/auth-clients.ts`
   - 增加 schema
   - 增加 payload 校验
   - 按需扩展默认 seed
3. `apps/backend/src/services/auth-clients.ts`
   - 增加运行时校验逻辑
4. `apps/web-frontend`
   - 如果控制台需要管理这个类型，补对应表单组件
5. `apps/app-frontend`
   - 如果该类型在移动端使用，补请求头构造逻辑
6. `apps/docs`
   - 补客户端类型说明和快速开始里的环境变量

## 新增一个需要引用附件的实体

如果某个实体引用 `MediaAsset`：

1. 在 Prisma schema 建关系
2. 删除实体时按业务需要决定是否先断开关系
3. 删除附件时，删除保护会自动阻止仍被引用的记录被删掉

如果业务允许删除，那就应该在业务逻辑里先删关联记录，而不是在删除接口里绕过保护。
