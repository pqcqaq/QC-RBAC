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
        <h4>{{ title }}</h4>
        <p>{{ description }}</p>
      </div>
    </div>

    <el-form label-position="top" class="page-form-grid">
      <el-form-item label="类型">
        <el-select v-model="form.type" :disabled="lockType">
          <el-option
            v-for="option in typeOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="父级">
        <el-select v-model="form.parentId" clearable placeholder="根级">
          <el-option
            v-for="option in parentOptions"
            :key="option.id"
            :label="option.label"
            :value="option.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="排序">
        <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
      </el-form-item>

      <el-form-item v-if="form.type !== 'ACTION'" :label="codeFieldLabel">
        <el-input v-model="form.code" :placeholder="codePlaceholder" />
      </el-form-item>

      <el-form-item :label="nameFieldLabel">
        <el-input v-model="form.title" :placeholder="namePlaceholder" />
      </el-form-item>

      <el-form-item v-if="form.type !== 'ACTION'" label="图标">
        <UnoIconPicker v-model="form.icon" :fallback="previewIcon" />
      </el-form-item>

      <el-form-item v-if="form.type !== 'ACTION'" label="副标题">
        <el-input v-model="form.caption" placeholder="可选，建议控制在一行内" />
      </el-form-item>

      <el-form-item label="说明" class="page-form-grid__full">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          :placeholder="descriptionPlaceholder"
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
        :label="permissionFieldLabel"
        class="page-form-grid__full"
        v-model="form.permissionId"
        :disabled="!canAssignPermission"
        :dialog-title="permissionDialogTitle"
        trigger-text="选择权限"
        :request="loadPermissionOptions"
        :search-defaults="{ q: '' }"
        :show-selected-preview="form.type !== 'ACTION'"
      >
        <template v-if="form.type === 'ACTION'" #trigger="{ open, clear, selectedRows, selectedCount, disabled }">
          <div class="menu-action-permission-trigger">
            <button
              type="button"
              class="menu-action-permission-trigger__selector"
              :class="{ 'is-disabled': disabled, 'is-active': selectedCount > 0 }"
              :disabled="disabled"
              @click="open"
            >
              <span class="menu-action-permission-trigger__copy">
                <strong>
                  {{ selectedRows[0]?.name ?? '关联权限' }}
                </strong>
                <span>
                  {{
                    selectedRows[0]?.code ??
                      '选择一个权限作为当前行为的控制点'
                  }}
                </span>
              </span>

              <span class="menu-action-permission-trigger__meta">
                <span
                  v-if="selectedCount"
                  class="menu-action-permission-trigger__badge"
                >
                  已关联
                </span>
                <span class="menu-action-permission-trigger__arrow" aria-hidden="true" />
              </span>
            </button>

            <button
              v-if="selectedCount"
              type="button"
              class="menu-action-permission-trigger__clear"
              :disabled="disabled"
              @click.stop="clear"
            >
              清空
            </button>

            <el-button
              v-if="canCreatePermission"
              plain
              type="primary"
              :disabled="disabled"
              @click="emit('open-create-permission')"
            >
              新增权限
            </el-button>
          </div>
        </template>

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

      <p
        v-if="form.type === 'ACTION'"
        class="menu-dialog__field-note page-form-grid__full"
      >
        行为节点建议直接关联一个权限；没有现成权限时先新建，再自动回填到当前行为。
      </p>

      <p
        v-if="form.type !== 'DIRECTORY' && !canAssignPermission"
        class="menu-dialog__field-note page-form-grid__full"
      >
        当前账号缺少 `menu.assign-permission`，这里只能查看已绑定权限，不能修改。
      </p>
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
import { computed } from 'vue';
import type { MenuNodeFormPayload } from '@rbac/api-common';
import { api } from '@/api/client';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';
import UnoIconPicker from '@/components/common/UnoIconPicker.vue';
import {
  resolveEntityLabel,
  resolveNameFieldLabel,
  resolveCodeFieldLabel,
  resolveCodePlaceholder,
  typeOptions,
  type EditorMode,
} from '../menu-management';

const loadPermissionOptions = api.menus.permissions;

const props = defineProps<{
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
  canCreatePermission: boolean;
  saving: boolean;
  canSubmit: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  reset: [];
  save: [];
  'open-create-permission': [];
}>();

const entityLabel = computed(() => resolveEntityLabel(props.form.type));
const nameFieldLabel = computed(() => resolveNameFieldLabel(props.form.type));
const namePlaceholder = computed(() =>
  props.form.type === 'ACTION'
    ? '如 导出数据 / 审核通过'
    : props.form.type === 'PAGE'
      ? '用于页面导航展示'
      : '用于目录导航展示',
);
const codeFieldLabel = computed(() =>
  props.form.type === 'ACTION' ? '' : resolveCodeFieldLabel(props.form.type),
);
const codePlaceholder = computed(() =>
  props.form.type === 'ACTION' ? '' : resolveCodePlaceholder(props.form.type),
);
const descriptionPlaceholder = computed(() =>
  props.form.type === 'ACTION'
    ? '可选，补充这个行为的用途或边界'
    : `可选，补充这个${entityLabel.value}的用途说明`,
);
const permissionFieldLabel = computed(() =>
  props.form.type === 'ACTION' ? '关联权限' : '页面权限',
);
const permissionDialogTitle = computed(() =>
  props.form.type === 'ACTION' ? '选择行为权限' : '选择页面权限',
);
</script>

<style scoped lang="scss">
.menu-dialog__intro {
  margin-bottom: 18px;
  padding: 16px 18px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: color-mix(in srgb, white 94%, var(--surface-2));
}

.menu-dialog__intro-copy {
  display: grid;
  gap: 8px;
}

.menu-dialog__intro-copy h4 {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.15;
}

.menu-dialog__intro-copy p {
  margin: 0;
  color: var(--ink-3);
  font-size: 13px;
  line-height: 1.6;
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

.menu-dialog__field-note {
  margin: -4px 0 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}

.menu-action-permission-trigger {
  display: flex;
  align-items: stretch;
  gap: 10px;
  width: 100%;
}

.menu-action-permission-trigger__selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  flex: 1;
  padding: 13px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, white 90%, var(--accent) 4%),
    var(--surface-1)
  );
  box-shadow:
    0 12px 30px rgba(11, 26, 41, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.menu-action-permission-trigger__selector:hover:not(.is-disabled) {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--line-strong));
  box-shadow:
    0 16px 34px rgba(11, 26, 41, 0.08),
    0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent);
  transform: translateY(-1px);
}

.menu-action-permission-trigger__selector.is-active {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--line-strong));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, white 86%, var(--accent) 8%),
    color-mix(in srgb, var(--surface-1) 96%, var(--accent) 4%)
  );
}

.menu-action-permission-trigger__selector.is-disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.menu-action-permission-trigger__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.menu-action-permission-trigger__copy strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.menu-action-permission-trigger__copy span {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.menu-action-permission-trigger__meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.menu-action-permission-trigger__badge {
  min-width: 44px;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: color-mix(in srgb, var(--accent) 78%, #0f1822);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  text-align: center;
}

.menu-action-permission-trigger__arrow {
  width: 9px;
  height: 9px;
  margin-right: 2px;
  border-top: 1.5px solid var(--ink-3);
  border-right: 1.5px solid var(--ink-3);
  transform: rotate(45deg);
  opacity: 0.7;
}

.menu-action-permission-trigger__clear {
  flex: 0 0 auto;
  padding: 0 14px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: color-mix(in srgb, white 90%, var(--surface-2));
  color: var(--ink-3);
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease, background-color 0.18s ease;
}

.menu-action-permission-trigger__clear:hover:not(:disabled) {
  border-color: color-mix(in srgb, #ff6b57 28%, var(--line-strong));
  background: color-mix(in srgb, #ff6b57 8%, white);
  color: #c94a37;
}

.menu-action-permission-trigger__clear:disabled {
  cursor: not-allowed;
  opacity: 0.62;
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
  .menu-action-permission-trigger {
    flex-direction: column;
  }

  .menu-action-permission-trigger__clear {
    min-height: 40px;
  }
}
</style>
