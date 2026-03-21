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
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="节点说明，可选" />
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

      <el-form-item
        v-if="form.type !== 'DIRECTORY'"
        v-permission="'menu.assign-permission'"
        label="权限绑定"
        class="page-form-grid__full"
      >
        <el-select
          v-model="form.permissionId"
          clearable
          filterable
          :disabled="!canAssignPermission"
          placeholder="页面与行为节点可绑定权限"
        >
          <el-option-group
            v-for="group in permissionGroups"
            :key="group.module"
            :label="group.module"
          >
            <el-option
              v-for="permission in group.items"
              :key="permission.id"
              :label="`${permission.name} (${permission.code})`"
              :value="permission.id"
            />
          </el-option-group>
        </el-select>
      </el-form-item>
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
import type { MenuNodeFormPayload, PermissionSummary } from '@rbac/api-common';
import UnoIconPicker from '@/components/common/UnoIconPicker.vue';
import { typeOptions, type EditorMode } from '../menu-management';

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
  permissionGroups: Array<{ module: string; items: PermissionSummary[] }>;
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

@media (max-width: 860px) {
  .menu-dialog__intro {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
