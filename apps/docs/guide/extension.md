---
title: 扩展指南
description: 新增模块、新增客户端类型、新增列表页和测试时的具体步骤。
---

## 新增一个业务模块

推荐按下面顺序做。

### 1. 数据模型

- 在 `apps/backend/prisma/schema.prisma` 增加模型和关系。
- 如果模型需要统一审计、Snowflake ID、软删除，把模型名加入 `apps/backend/src/lib/prisma.ts`。

### 2. 删除保护

如果模型和其他模型存在 Prisma 关系，删除保护会自动识别。

原因：

- `apps/backend/src/lib/delete-reference-checker.ts` 会从 `Prisma.dmmf.datamodel.models` 读取关系。
- 不需要手写 refs 映射。

你只需要保证：

- Prisma schema 关系正确
- 模型处于受管删除路径中

### 3. 后端接口

- 在 `apps/backend/src/routes` 增加路由文件。
- 复杂逻辑放进 `apps/backend/src/services`。
- 如果是列表接口，统一返回：

```ts
{
  items: [],
  meta: { page, pageSize, total }
}
```

### 4. 权限与菜单

- 在 `packages/api-common/src/constants/permissions.ts` 增加权限码。
- 在 `apps/backend/src/services/system-rbac.ts` 中决定是否把页面和行为挂到菜单树。
- 如果需要默认角色拥有权限，也在 seed 流程中同步。

### 5. 共享类型和 API

- 在 `packages/api-common/src/types` 增加类型。
- 在 `packages/api-common/src/api/factory.ts` 增加 API 方法。

### 6. Web 控制台页面

按既有模式新增：

```text
pages/console/<module>
├─ components/
├─ <Module>View.vue
└─ <module>-management.ts
```

推荐直接复用：

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

测试不要再堆到一个总文件里，按职责拆分到：

- `apps/backend/test/framework`
- `apps/backend/test/integration`

至少覆盖：

- 授权是否生效
- 列表查询是否可用
- 新增 / 更新 / 删除是否正常
- 删除保护是否符合预期

如果改动的是：

- 框架能力：补 `framework/*.test.ts`
- 业务 API：补 `integration/*.test.ts`

### 9. 文档

功能落地后，同步更新 `apps/docs`：

- 新增页面或菜单，更新 `guide/web-frontend.md` 或 `guide/uni-frontend.md`
- 新增接口、实体、后台能力，更新 `guide/backend.md`
- 新增共享类型或 API，更新 `guide/shared.md`
- 新增或重构内置组件，更新 `components/**`
- 新增测试或测试拆分，更新 `guide/testing.md`

## 新增一个列表页并支持导出

后端：

1. 写分页查询接口。
2. 使用 `createExcelExportHandler(...)` 增加 `/export`。
3. 如果要给表单里的关联选择器复用，再单独提供 options 接口。

前端：

1. 列表页正常调用分页接口。
2. 导出按钮传入 `api.<module>.export(...)`。
3. 如果后端暂时返回完整数组，前端可以在筛选结果上做本地分页，但要在文档里明确说明。

这样导出和列表会天然共享同一套筛选条件。

如果这个列表还会被表单里的关联选择器复用，额外遵守：

1. options 接口统一用 `POST`。
2. 查询参数放在 body，至少包含 `page`、`pageSize`。
3. 业务过滤字段直接平铺，不再包一层 `search`。
4. 返回值统一为 `items + meta`。

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

1. 在 Prisma schema 建关系。
2. 删除实体时按业务需要决定是否先断开关系。
3. 删除附件时，删除保护会自动阻止仍被引用的记录被删掉。

如果业务允许删除，那就应该在业务逻辑里先删关联记录，而不是在删除接口里绕过保护。
