<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="840px"
    top="6vh"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="menu-dialog__intro">
      <div class="menu-dialog__intro-copy">
        <p class="panel-caption">{{ mode === 'edit' ? 'Edit Node' : 'Create Node' }}</p>
        <h4>{{ title }}</h4>
        <p>{{ description }}</p>
      </div>

      <el-tag round>{{ mode === 'edit' ? '编辑模式' : '新建模式' }}</el-tag>
    </div>

    <el-form label-position="top" class="page-form-grid">
      <el-form-item label="节点类型">
        <el-select v-model="form.type" :disabled="lockType">
          <el-option
            v-for="option in typeOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="父节点">
        <el-select v-model="form.parentId" clearable placeholder="根节点">
          <el-option
            v-for="option in parentOptions"
            :key="option.id"
            :label="option.label"
            :value="option.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="排序值">
        <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
      </el-form-item>

      <el-form-item label="节点编码">
        <el-input v-model="form.code" placeholder="如 users / menus-create" />
      </el-form-item>

      <el-form-item label="标题">
        <el-input v-model="form.title" placeholder="菜单展示标题" />
      </el-form-item>

      <el-form-item label="菜单图标">
        <UnoIconPicker v-model="form.icon" :fallback="previewIcon" />
      </el-form-item>

      <el-form-item label="副标题">
        <el-input v-model="form.caption" placeholder="菜单第二行的简短说明，建议少于 16 个字" />
      </el-form-item>

      <el-form-item label="描述" class="page-form-grid__full">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="节点说明，可选"
        />
      </el-form-item>

      <el-form-item v-if="form.type === 'PAGE'" label="页面路径">
        <el-input v-model="form.path" placeholder="/menus" />
      </el-form-item>

      <el-form-item v-if="form.type === 'PAGE'" label="页面视图">
        <el-select v-model="form.viewKey" filterable placeholder="选择前端页面视图">
          <el-option
            v-for="option in pageViewOptions"
            :key="option.viewKey"
            :label="option.label"
            :value="option.viewKey"
            :disabled="option.disabled"
          />
        </el-select>
      </el-form-item>

      <RelationSelectFormItem
        v-if="form.type !== 'DIRECTORY'"
        v-permission="'menu.assign-permission'"
        label="权限绑定"
        class="page-form-grid__full"
        v-model="form.permissionId"
        :disabled="!canAssignPermission"
        dialog-title="选择权限绑定"
        trigger-text="选择权限"
        :request="loadPermissionOptions"
        :search-defaults="{ q: '' }"
      >
        <template #search="{ params, search, reset }">
          <div class="relation-search-bar">
            <el-input
              v-model="params.q"
              clearable
              placeholder="搜索权限名称、编码或模块"
              @keyup.enter="search"
            />
            <el-button @click="search">搜索</el-button>
            <el-button @click="reset">重置</el-button>
          </div>
        </template>

        <template #row="{ row, selected }">
          <div
            class="menu-permission-option"
            :class="{ 'menu-permission-option--selected': selected }"
          >
            <div class="menu-permission-option__header">
              <strong>{{ row.name }}</strong>
              <span class="menu-permission-option__badge">
                {{ selected ? '已选' : '使用' }}
              </span>
            </div>
            <span>{{ row.code }}</span>
            <p>{{ row.module }} · {{ row.action }}</p>
          </div>
        </template>
      </RelationSelectFormItem>
    </el-form>

    <div class="menu-editor__hint">
      <strong>结构约束</strong>
      <span>{{ structureHint }}</span>
    </div>

    <template #footer>
      <el-button @click="emit('reset')">恢复初始值</el-button>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button
        v-permission="mode === 'edit' ? 'menu.update' : 'menu.create'"
        type="primary"
        :loading="saving"
        :disabled="!canSubmit"
        @click="emit('save')"
      >
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { MenuNodeFormPayload } from '@rbac/api-common';
import { api } from '@/api/client';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';
import UnoIconPicker from '@/components/common/UnoIconPicker.vue';
import { typeOptions, type EditorMode } from '../menu-management';

const loadPermissionOptions = api.menus.permissions;

defineProps<{
  visible: boolean;
  title: string;
  mode: EditorMode;
  description: string;
  form: MenuNodeFormPayload;
  lockType: boolean;
  previewIcon: string;
  structureHint: string;
  parentOptions: Array<{ id: string; label: string }>;
  pageViewOptions: Array<{ viewKey: string; label: string; disabled: boolean }>;
  canAssignPermission: boolean;
  saving: boolean;
  canSubmit: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  reset: [];
  save: [];
}>();
</script>

<style scoped lang="scss">
.menu-dialog__intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  padding: 16px 18px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: color-mix(in srgb, white 94%, var(--surface-2));
}

.menu-dialog__intro-copy {
  display: grid;
  gap: 6px;
}

.menu-dialog__intro-copy h4 {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.15;
}

.menu-dialog__intro-copy p:last-child {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.55;
}

.menu-editor__hint {
  display: grid;
  gap: 6px;
  margin-top: 8px;
  padding: 14px 16px;
  border: 1px dashed var(--line-strong);
  border-radius: 16px;
  background: color-mix(in srgb, white 84%, var(--surface-2));
  color: var(--ink-2);
}

.menu-editor__hint strong {
  color: var(--ink-1);
  font-size: 13px;
}

.menu-permission-option {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: var(--surface-1);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}

.menu-permission-option--selected {
  border-color: color-mix(in srgb, var(--accent) 58%, white);
  background: color-mix(in srgb, var(--accent) 8%, white);
  box-shadow: 0 10px 24px rgba(11, 26, 41, 0.07);
}

.menu-permission-option__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.menu-permission-option__badge {
  flex: 0 0 auto;
  min-width: 44px;
  padding: 4px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: color-mix(in srgb, var(--accent) 76%, #0f1822);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  text-align: center;
}

.relation-search-bar {
  display: flex;
  gap: 10px;
}

.relation-search-bar :deep(.el-input) {
  flex: 1;
}

.menu-permission-option strong {
  font-size: 14px;
  line-height: 1.4;
}

.menu-permission-option span,
.menu-permission-option p {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 860px) {
  .menu-dialog__intro {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
