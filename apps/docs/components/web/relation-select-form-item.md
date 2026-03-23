---
title: RelationSelectFormItem
description: Web 表单里的关联选择组件，适合外键和多对多关系选择。
---

## 作用

`RelationSelectFormItem` 用来处理 Web 控制台表单里的关联选择场景，例如：

- 用户选择角色
- 角色选择权限
- OAuth 应用选择权限 scope
- 菜单绑定权限

组件本身只负责：

- 弹窗开关
- 分页请求
- 单选 / 多选
- 已选值回填
- 已选项预览

搜索区和每一行的渲染都通过插槽交给业务页面。

默认触发区已经内置成一体化选择控件：

- 主区负责打开选择弹窗
- 右侧清空操作内嵌在同一个控件里
- 不再渲染分裂的独立清空链接按钮

## 对应源码

- `apps/web-frontend/src/components/form/RelationSelectFormItem.vue`
- `apps/web-frontend/src/components/form/relation-select.ts`

## 请求约定

`request` 不是普通数组加载器，而是一个分页请求函数：

```ts
type RelationSelectRequestParams = OptionSearchPayload & {
  page: number
  pageSize: number
}

type RelationSelectRequest = (
  params: RelationSelectRequestParams,
) => Promise<PaginatedResult<RelationSelectRow>>
```

当前项目里的标准用法：

- 前端通过 `api.users.roles`、`api.roles.permissions`、`api.menus.permissions`、`api.oauth.applications.permissions` 传入。
- 后端选项接口统一走 `POST + body`。
- body 中固定字段是 `page`、`pageSize`。
- 其他过滤字段直接平铺，例如 `q`、`code`、`name`、`module`、`action`。

这也是为什么搜索区应该放在插槽里，而不是写死在组件内部。

## 基本示例

单选示例：

```vue
<RelationSelectFormItem
  v-model="form.permissionId"
  label="权限绑定"
  dialog-title="选择权限"
  trigger-text="选择权限"
  :request="api.menus.permissions"
  :search-defaults="{ q: '' }"
>
  <template #search="{ params, search, reset }">
    <div class="relation-search-bar">
      <el-input
        v-model="params.q"
        clearable
        placeholder="搜索权限名称或编码"
        @keyup.enter="search"
      />
      <el-button @click="search">搜索</el-button>
      <el-button @click="reset">重置</el-button>
    </div>
  </template>

  <template #row="{ row }">
    <div class="relation-option-list">
      <strong>{{ row.name }}</strong>
      <span>{{ row.code }}</span>
      <p>{{ row.module }} · {{ row.action }}</p>
    </div>
  </template>
</RelationSelectFormItem>
```

多选示例：

```vue
<RelationSelectFormItem
  v-model="form.permissionIds"
  label="分配权限"
  trigger-text="选择权限"
  :request="api.roles.permissions"
  :search-defaults="{ module: '', action: '' }"
  multiple
>
  <template #search="{ params, search, reset }">
    <div class="relation-search-bar">
      <el-input v-model="params.module" placeholder="模块" @keyup.enter="search" />
      <el-input v-model="params.action" placeholder="动作" @keyup.enter="search" />
      <el-button @click="search">搜索</el-button>
      <el-button @click="reset">重置</el-button>
    </div>
  </template>

  <template #row="{ row, selected }">
    <div class="relation-option-list">
      <strong>{{ row.name }} <span v-if="selected">已选</span></strong>
      <span>{{ row.code }}</span>
    </div>
  </template>
</RelationSelectFormItem>
```

## Props

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `label` | `string` | - | 表单项标题 |
| `modelValue` | `string \| string[] \| null \| undefined` | - | 单选传 `string \| null`，多选传 `string[]` |
| `request` | `RelationSelectRequest` | - | 分页加载函数 |
| `requestParams` | `QueryParams` | `{}` | 固定透传给请求函数的参数 |
| `searchDefaults` | `Record<string, string \| number \| null \| undefined>` | `{}` | 搜索表单初始值和重置值 |
| `dialogTitle` | `string` | `选择${label}` | 弹窗标题 |
| `triggerText` | `string` | `''` | 默认触发区主标题，为空时回退为 `选择${label}` |
| `emptyText` | `string` | `暂无可选项` | 空状态文案 |
| `dialogWidth` | `string \| number` | `'880px'` | 弹窗宽度 |
| `pageSize` | `number` | `10` | 每页数量 |
| `multiple` | `boolean` | `false` | 是否多选 |
| `allowClear` | `boolean` | `true` | 默认触发区是否显示右侧内嵌清空操作 |
| `showSelectedPreview` | `boolean` | `true` | 是否显示已选标签预览 |
| `previewTagLimit` | `number` | `3` | 标签预览数量 |
| `layout` | `'list' \| 'card'` | `'list'` | 行布局样式 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `getRowId` | `(row) => string` | `row.id` | 自定义行主键解析 |
| `getRowLabel` | `(row) => string` | 内置回退逻辑 | 自定义标签文本 |
| `getRowMeta` | `(row) => string` | 内置回退逻辑 | 自定义副文本 |
| `isOptionDisabled` | `(row) => boolean` | `false` | 控制某些选项不可选 |

## 插槽

### `trigger`

默认是一个一体化选择控件，左侧打开弹窗，右侧在有值时显示内嵌清空操作。需要自定义触发区时使用。

自定义 `trigger` 后，组件不会再渲染默认触发区和内置清空段。如果你仍然需要清空能力，直接调用插槽参数里的 `clear`。

插槽参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `open` | `() => void` | 打开弹窗 |
| `clear` | `() => void` | 清空当前选择 |
| `selectedCount` | `number` | 已选数量 |
| `selectedRows` | `RelationSelectRow[]` | 已缓存的已选行 |
| `selectionText` | `string` | 当前触发文本 |
| `disabled` | `boolean` | 当前是否禁用 |

### `search`

组件不内置搜索 UI，完全交给这里实现。

插槽参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `params` | `Record<string, string \| number \| null \| undefined>` | 当前搜索参数对象 |
| `search` | `() => void` | 触发查询并回到第一页 |
| `reset` | `() => void` | 重置到 `searchDefaults` 并重新查询 |
| `loading` | `boolean` | 当前是否请求中 |

### `row`

自定义每一行如何显示。

插槽参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `row` | `RelationSelectRow` | 当前行 |
| `selected` | `boolean` | 当前行是否选中 |
| `toggle` | `() => void` | 切换当前行选中状态 |

## 事件

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `update:modelValue` | `string \| string[] \| null` | 选择后回填 |

行为规则：

- 单选时，点击某一行会立即回填并关闭弹窗。
- 多选时，点击只更新暂存选择，点击“确定”后统一回填。
- 点击默认触发区右侧的内嵌清空操作，或在自定义 `trigger` 中调用 `clear`，都会回填 `null` 或 `[]`。

## 行数据约定

`RelationSelectRow` 至少要求有 `id`。

```ts
type RelationSelectRow = {
  id: string
  name?: string
  title?: string
  label?: string
  code?: string
  module?: string
  action?: string
  description?: string
}
```

如果没有自定义 `getRowLabel` / `getRowMeta`，组件会按下面顺序回退：

- label: `name -> title -> label -> code -> id`
- meta: `code / module / action / description`

## 后端配套约定

如果你要新增一个能被这个组件复用的选项接口，后端建议直接遵守当前约定：

1. 路由提供 `POST /api/<resource>/options/...`
2. body 读取 `page`、`pageSize` 和过滤字段
3. 返回格式统一为：

```ts
{
  items: [],
  meta: { page, pageSize, total }
}
```

当前实现可参考：

- `apps/backend/src/services/rbac-options.ts`
- `apps/backend/src/routes/users.ts`
- `apps/backend/src/routes/roles.ts`
- `apps/backend/src/routes/menus.ts`
- `apps/backend/src/routes/oauth.ts`

## 现有使用点

- 用户编辑弹窗：选择角色
- 角色编辑弹窗：选择权限
- OAuth 应用编辑弹窗：选择权限 scope
- 菜单编辑弹窗：绑定权限

这些页面都已经从各自手写的选择逻辑切到了同一个组件。
