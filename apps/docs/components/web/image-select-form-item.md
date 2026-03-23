---
title: ImageSelectFormItem
description: Web 表单里的图片外键选择组件，支持从图片库选择和直接上传。
---

## 作用

`ImageSelectFormItem` 用来处理这种字段：

- 实体里只存一个图片 `id`
- 编辑时需要先回显当前图片
- 用户既可以从已有图片里选，也可以当场上传

组件内部复用了 `RelationSelectFormItem` 的分页选择能力，没有再单独维护一套弹窗、分页和回显逻辑。

## 对应源码

- `apps/web-frontend/src/components/form/ImageSelectFormItem.vue`
- `apps/web-frontend/src/components/form/image-select.ts`

## 对应后端接口

图片列表和回显走统一 option 协议：

- `POST /api/attachments/options/images`
- `POST /api/attachments/options/images/resolve`

上传复用已有分步上传接口：

1. `POST /api/files/presign`
2. 直传分片或单文件
3. `POST /api/files/callback`

因此业务页面只需要关心 `v-model` 里的图片 id，不需要自己拼上传细节。

## 基本示例

```vue
<ImageSelectFormItem
  v-model="form.coverImageId"
  label="封面图"
  dialog-title="选择封面图"
  :request-params="{ tag1: 'article-cover' }"
  :search-defaults="{ q: '', tag2: '' }"
  :max-size="2 * 1024 * 1024"
  accept="image/png,image/jpeg,image/webp"
  upload-tag1="article-cover"
>
  <template #search="{ params, search, reset }">
    <div class="relation-search-bar">
      <el-input
        v-model="params.q"
        clearable
        placeholder="搜索图片名称"
        @keyup.enter="search"
      />
      <el-input
        v-model="params.tag2"
        clearable
        placeholder="业务标签"
        @keyup.enter="search"
      />
      <el-button @click="search">搜索</el-button>
      <el-button @click="reset">重置</el-button>
    </div>
  </template>

  <template #row="{ row, selected }">
    <div class="image-option-card" :class="{ 'image-option-card--selected': selected }">
      <img :src="row.url ?? ''" :alt="row.originalName" />
      <strong>{{ row.originalName }}</strong>
      <span>{{ row.tag1 }} / {{ row.tag2 }}</span>
    </div>
  </template>
</ImageSelectFormItem>
```

## Props

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `label` | `string` | - | 表单项标题 |
| `modelValue` | `string \| null \| undefined` | - | 当前图片 id |
| `requestParams` | `MediaAssetListQuery` | `{}` | 透传给图片 option 接口的固定过滤参数 |
| `searchDefaults` | `Record<string, string \| number \| null \| undefined>` | `{ q: '' }` | 搜索参数初始值和重置值 |
| `dialogTitle` | `string` | `undefined` | 弹窗标题 |
| `triggerText` | `string` | `''` | 未选择时的触发标题 |
| `emptyText` | `string` | `暂无可选图片` | 空状态文案 |
| `dialogWidth` | `string \| number` | `'960px'` | 弹窗宽度 |
| `pageSize` | `number` | `12` | 每页数量 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `allowClear` | `boolean` | `true` | 是否允许清空当前图片 |
| `accept` | `string \| string[]` | `'image/*'` | 上传允许的图片格式 |
| `maxSize` | `number` | `undefined` | 上传大小上限，单位 Byte |
| `uploadEnabled` | `boolean` | `true` | 是否显示上传区 |
| `dragUpload` | `boolean` | `true` | 是否允许拖拽上传 |
| `clickUpload` | `boolean` | `true` | 是否允许点击选择文件 |
| `closeOnUpload` | `boolean` | `true` | 上传成功后是否关闭弹窗 |
| `uploadTag1` | `string \| null` | `null` | 上传时写入附件 `tag1` |
| `uploadTag2` | `string \| null` | `null` | 上传时写入附件 `tag2` |

## 插槽

### `trigger`

自定义触发区。默认实现会直接显示缩略图、当前文件名和清空按钮。

插槽参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `open` | `() => void` | 打开弹窗 |
| `clear` | `() => void` | 清空当前图片 |
| `selectedImage` | `MediaAssetRecord \| null` | 当前已选图片 |
| `selectedCount` | `number` | 已选数量，当前组件固定是 `0 / 1` |
| `selectionText` | `string` | 当前触发文案 |
| `disabled` | `boolean` | 当前是否禁用 |

### `search`

搜索区不写死，完全交给业务侧。`params.xxx` 会直接映射到 `/api/attachments/options/images` 的 body 字段。

插槽参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `params` | `Record<string, string \| number \| null \| undefined>` | 搜索参数对象 |
| `search` | `() => void` | 触发查询 |
| `reset` | `() => void` | 重置到 `searchDefaults` |
| `loading` | `boolean` | 当前是否查询中 |

### `row`

自定义图片卡片。

插槽参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `row` | `MediaAssetRecord` | 当前图片记录 |
| `selected` | `boolean` | 当前是否已选 |
| `disabled` | `boolean` | 当前是否不可选 |
| `toggle` | `() => void` | 选择当前图片 |

## 事件

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `update:modelValue` | `string \| null` | 选择或上传后回填图片 id |

## 使用约定

1. 当前组件面向“单图片外键”，不是多图管理器。
2. 图片列表接口已经固定过滤为附件里的图片文件，不会混进 PDF、Word 之类的普通附件。
3. 编辑态如果已有图片 id，组件会自动调用 `/resolve` 获取回显，不需要用户先打开弹窗。
4. 上传成功后会直接回填新的图片 id；如果 `closeOnUpload = false`，组件还会刷新当前列表。
5. 如果业务要限制图片来源，优先通过 `requestParams.tag1 / tag2` 做业务过滤。

## 后端搜索参数

`/api/attachments/options/images` 当前支持这些字段：

| 字段 | 说明 |
| --- | --- |
| `page` | 页码 |
| `pageSize` | 每页数量 |
| `q` | 搜索文件名、MIME、对象路径、标签、上传人 |
| `tag1` | 精确匹配标签 1 |
| `tag2` | 精确匹配标签 2 |

这个 endpoint 已经固定了：

- `kind = attachment`
- `uploadStatus = COMPLETED`
- `mimePrefix = image/`

也就是说，它只返回已经上传完成、可直接预览的图片附件。
