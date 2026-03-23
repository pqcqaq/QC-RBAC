<template>
  <el-form-item v-bind="attrs" :label="label" class="relation-select-form-item">
    <div class="relation-select-form-item__trigger-row">
      <slot
        name="trigger"
        :open="openDialog"
        :clear="clearSelection"
        :selected-count="selectedCount"
        :selected-rows="selectedRows"
        :selection-text="selectionText"
        :disabled="disabled"
      >
        <div
          class="relation-select-form-item__trigger-control"
          :class="{
            'relation-select-form-item__trigger-control--active': hasSelection,
            'relation-select-form-item__trigger-control--disabled': disabled,
          }"
          role="group"
          :aria-disabled="disabled ? 'true' : 'false'"
        >
          <button
            type="button"
            class="relation-select-form-item__trigger-main"
            :disabled="disabled"
            @click="openDialog"
          >
            <span class="relation-select-form-item__trigger-copy">
              <span class="relation-select-form-item__trigger-title">
                {{ defaultTriggerTitle }}
              </span>
              <span class="relation-select-form-item__trigger-description">
                {{ defaultTriggerDescription }}
              </span>
            </span>

            <span class="relation-select-form-item__trigger-meta">
              <span
                v-if="defaultTriggerBadgeText"
                class="relation-select-form-item__trigger-badge"
              >
                {{ defaultTriggerBadgeText }}
              </span>
              <span
                class="relation-select-form-item__trigger-arrow"
                aria-hidden="true"
              />
            </span>
          </button>

          <button
            v-if="showClearAction"
            type="button"
            class="relation-select-form-item__trigger-clear"
            :disabled="disabled"
            :title="clearButtonTitle"
            :aria-label="clearButtonTitle"
            @click.stop="clearSelection"
          >
            <span
              class="relation-select-form-item__trigger-clear-icon"
              aria-hidden="true"
            />
          </button>
        </div>
      </slot>
    </div>

    <div
      v-if="showSelectedPreview && selectedRows.length"
      class="relation-select-form-item__preview"
    >
      <el-tag
        v-for="row in selectedRows.slice(0, previewTagLimit)"
        :key="getRowId(row)"
        effect="plain"
        round
      >
        {{ resolveRowLabel(row) }}
      </el-tag>

      <span v-if="selectedCount > selectedRows.length" class="muted">
        已选 {{ selectedCount }} 项
      </span>
    </div>

    <el-dialog
      :model-value="dialogVisible"
      :title="resolvedDialogTitle"
      :width="dialogWidth"
      destroy-on-close
      @update:model-value="handleDialogVisibleChange"
    >
      <div class="relation-select-dialog">
        <div v-if="hasSearchSlot" class="relation-select-dialog__toolbar">
          <div class="relation-select-dialog__search">
            <slot
              name="search"
              :params="searchParams"
              :search="applySearch"
              :reset="resetSearch"
              :loading="loading"
            />
          </div>

          <div class="relation-select-dialog__toolbar-meta">
            <span class="muted">
              {{ stagedSelectionText }}
            </span>
          </div>
        </div>

        <div
          v-else
          class="relation-select-dialog__toolbar-meta relation-select-dialog__toolbar-meta--standalone"
        >
          <span class="muted">
            {{ stagedSelectionText }}
          </span>
        </div>

        <div v-loading="loading" class="relation-select-dialog__body">
          <div
            v-if="rows.length"
            :class="[
              'relation-select-dialog__options',
              layout === 'card'
                ? 'relation-select-dialog__options--card'
                : 'relation-select-dialog__options--list',
            ]"
          >
            <button
              v-for="row in rows"
              :key="getRowId(row)"
              type="button"
              class="relation-select-dialog__option"
              :class="{
                'relation-select-dialog__option--active': isRowSelected(row),
                'relation-select-dialog__option--disabled': isRowDisabled(row),
                'relation-select-dialog__option--card': layout === 'card',
              }"
              :disabled="isRowDisabled(row)"
              @click="selectRow(row)"
            >
              <div class="relation-select-dialog__option-content">
                <slot
                  name="row"
                  :row="row"
                  :selected="isRowSelected(row)"
                  :toggle="() => selectRow(row)"
                >
                  <div class="relation-select-dialog__fallback">
                    <strong>{{ resolveRowLabel(row) }}</strong>
                    <span v-if="resolveRowMeta(row)">
                      {{ resolveRowMeta(row) }}
                    </span>
                  </div>
                </slot>
              </div>

              <span class="relation-select-dialog__option-indicator">
                {{ isRowSelected(row) ? '已选' : multiple ? '选择' : '使用' }}
              </span>
            </button>
          </div>

          <el-empty v-else :description="emptyText" />
        </div>

        <div v-if="total > pageSize" class="relation-select-dialog__pagination">
          <el-pagination
            background
            layout="prev, pager, next"
            :current-page="page"
            :page-size="pageSize"
            :total="total"
            @current-change="changePage"
          />
        </div>
      </div>

      <template #footer>
        <el-button @click="closeDialog">取消</el-button>
        <el-button v-if="multiple" type="primary" @click="confirmSelection">确定</el-button>
      </template>
    </el-dialog>
  </el-form-item>
</template>

<script setup lang="ts">
import { computed, reactive, ref, shallowRef, useAttrs, useSlots, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { QueryParams } from '@rbac/api-common';
import { getErrorMessage } from '@/utils/errors';
import {
  normalizeRelationSelectValue,
  resolveRelationRowLabel,
  resolveRelationRowMeta,
  type RelationSelectModelValue,
  type RelationSelectRequest,
  type RelationSelectRow,
} from './relation-select';

type RelationSelectSearchParams = Record<string, string | number | null | undefined>;

defineOptions({
  name: 'RelationSelectFormItem',
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: RelationSelectModelValue;
    request: RelationSelectRequest;
    requestParams?: QueryParams;
    searchDefaults?: RelationSelectSearchParams;
    dialogTitle?: string;
    triggerText?: string;
    emptyText?: string;
    dialogWidth?: string | number;
    pageSize?: number;
    multiple?: boolean;
    allowClear?: boolean;
    showSelectedPreview?: boolean;
    previewTagLimit?: number;
    layout?: 'list' | 'card';
    disabled?: boolean;
    getRowId?: (row: RelationSelectRow) => string;
    getRowLabel?: (row: RelationSelectRow) => string;
    getRowMeta?: (row: RelationSelectRow) => string;
    isOptionDisabled?: (row: RelationSelectRow) => boolean;
  }>(),
  {
    requestParams: () => ({}),
    searchDefaults: () => ({}),
    dialogTitle: undefined,
    triggerText: '',
    emptyText: '暂无可选项',
    dialogWidth: '880px',
    pageSize: 10,
    multiple: false,
    allowClear: true,
    showSelectedPreview: true,
    previewTagLimit: 3,
    layout: 'list',
    disabled: false,
    getRowId: undefined,
    getRowLabel: undefined,
    getRowMeta: undefined,
    isOptionDisabled: undefined,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | null];
}>();

const attrs = useAttrs();
const slots = useSlots();
const dialogVisible = ref(false);
const loading = ref(false);
const page = ref(1);
const rows = ref<RelationSelectRow[]>([]);
const total = ref(0);
const stagedSelection = ref<string[]>([]);
const selectedRowMap = shallowRef(new Map<string, RelationSelectRow>());
const searchParams = reactive<RelationSelectSearchParams>({ ...(props.searchDefaults ?? {}) });

let requestVersion = 0;

const normalizedModelValue = computed(() =>
  normalizeRelationSelectValue(props.modelValue, props.multiple),
);
const hasSelection = computed(() => normalizedModelValue.value.length > 0);
const selectedCount = computed(() => normalizedModelValue.value.length);
const selectedRows = computed(() =>
  normalizedModelValue.value
    .map((id) => selectedRowMap.value.get(id))
    .filter((row): row is RelationSelectRow => Boolean(row)),
);
const showClearAction = computed(() => props.allowClear && hasSelection.value);
const hasSearchSlot = computed(() => Boolean(slots.search));
const resolvedDialogTitle = computed(() => props.dialogTitle ?? `选择${props.label}`);
const selectionText = computed(() => {
  if (!selectedCount.value) {
    return props.triggerText || `选择${props.label}`;
  }

  if (props.triggerText) {
    return `${props.triggerText}（已选 ${selectedCount.value} 项）`;
  }

  if (selectedRows.value.length === 1 && !props.multiple) {
    return resolveRowLabel(selectedRows.value[0]);
  }

  return `已选 ${selectedCount.value} 项`;
});
const defaultTriggerTitle = computed(() => {
  if (!selectedCount.value) {
    return props.triggerText || `选择${props.label}`;
  }

  if (!props.multiple && selectedRows.value.length === 1) {
    return resolveRowLabel(selectedRows.value[0]);
  }

  return props.triggerText || `已选择 ${selectedCount.value} 项`;
});
const defaultTriggerDescription = computed(() => {
  if (!selectedCount.value) {
    return props.multiple ? '支持分页搜索与多项选择' : '点击打开后选择关联项';
  }

  return props.multiple
    ? `当前已选 ${selectedCount.value} 项，可继续调整`
    : '当前已选择，点击后可重新指定';
});
const defaultTriggerBadgeText = computed(() => {
  if (!selectedCount.value) {
    return '';
  }

  return props.multiple ? `${selectedCount.value}` : '已选';
});
const clearButtonTitle = computed(() =>
  props.multiple ? `清空已选 ${selectedCount.value} 项` : '清空当前选择',
);
const stagedSelectionText = computed(() => {
  if (!stagedSelection.value.length) {
    return '当前未选择';
  }

  return props.multiple ? `已勾选 ${stagedSelection.value.length} 项` : '已选中 1 项';
});

const getRowId = (row: RelationSelectRow) => props.getRowId?.(row) ?? row.id;
const resolveRowLabel = (row: RelationSelectRow) =>
  props.getRowLabel?.(row) ?? resolveRelationRowLabel(row);
const resolveRowMeta = (row: RelationSelectRow) =>
  props.getRowMeta?.(row) ?? resolveRelationRowMeta(row);
const isRowDisabled = (row: RelationSelectRow) => props.isOptionDisabled?.(row) ?? false;
const isRowSelected = (row: RelationSelectRow) => stagedSelection.value.includes(getRowId(row));

const syncSelectedRowMap = (activeIds: string[]) => {
  const next = new Map<string, RelationSelectRow>();

  activeIds.forEach((id) => {
    const row = selectedRowMap.value.get(id);
    if (row) {
      next.set(id, row);
    }
  });

  selectedRowMap.value = next;
};

const cacheRows = (items: RelationSelectRow[]) => {
  if (!items.length) {
    return;
  }

  const activeIds = new Set([...normalizedModelValue.value, ...stagedSelection.value]);
  if (!activeIds.size) {
    return;
  }

  const next = new Map(selectedRowMap.value);
  items.forEach((row) => {
    const rowId = getRowId(row);
    if (activeIds.has(rowId)) {
      next.set(rowId, row);
    }
  });
  selectedRowMap.value = next;
};

const resetSearchParams = () => {
  const defaults = props.searchDefaults ?? {};

  Object.keys(searchParams).forEach((key) => {
    if (!(key in defaults)) {
      delete searchParams[key];
    }
  });

  Object.entries(defaults).forEach(([key, value]) => {
    searchParams[key] = value;
  });
};

const buildRequestParams = () => ({
  ...(props.requestParams ?? {}),
  ...searchParams,
  page: page.value,
  pageSize: props.pageSize,
});

const loadRows = async () => {
  const currentRequest = ++requestVersion;

  try {
    loading.value = true;
    const response = await props.request(buildRequestParams());

    if (currentRequest !== requestVersion) {
      return;
    }

    rows.value = response.items;
    total.value = response.meta.total;
    cacheRows(response.items);

    const totalPages = Math.max(Math.ceil(response.meta.total / props.pageSize), 1);
    if (page.value > totalPages) {
      page.value = totalPages;
      void loadRows();
    }
  } catch (error: unknown) {
    if (currentRequest !== requestVersion) {
      return;
    }

    ElMessage.error(getErrorMessage(error, `加载${props.label}失败`));
  } finally {
    if (currentRequest === requestVersion) {
      loading.value = false;
    }
  }
};

const openDialog = () => {
  if (props.disabled) {
    return;
  }

  stagedSelection.value = [...normalizedModelValue.value];
  resetSearchParams();
  page.value = 1;
  dialogVisible.value = true;
  void loadRows();
};

const closeDialog = () => {
  dialogVisible.value = false;
};

const handleDialogVisibleChange = (value: boolean) => {
  if (!value) {
    closeDialog();
    return;
  }

  openDialog();
};

const changePage = (value: number) => {
  page.value = value;
  void loadRows();
};

const applySearch = () => {
  page.value = 1;
  void loadRows();
};

const resetSearch = () => {
  resetSearchParams();
  page.value = 1;
  void loadRows();
};

const clearSelection = () => {
  emit('update:modelValue', props.multiple ? [] : null);
  syncSelectedRowMap([]);
};

const confirmSelection = () => {
  emit('update:modelValue', [...stagedSelection.value]);
  closeDialog();
};

const selectRow = (row: RelationSelectRow) => {
  if (isRowDisabled(row)) {
    return;
  }

  const rowId = getRowId(row);
  const next = new Map(selectedRowMap.value);
  next.set(rowId, row);
  selectedRowMap.value = next;

  if (props.multiple) {
    stagedSelection.value = stagedSelection.value.includes(rowId)
      ? stagedSelection.value.filter((item) => item !== rowId)
      : [...stagedSelection.value, rowId];
    return;
  }

  emit('update:modelValue', rowId);
  closeDialog();
};

watch(
  normalizedModelValue,
  (value) => {
    syncSelectedRowMap(value);
  },
  { immediate: true },
);

watch(
  () => props.searchDefaults,
  () => {
    if (!dialogVisible.value) {
      resetSearchParams();
    }
  },
  { deep: true, immediate: true },
);

watch(
  () => props.requestParams,
  () => {
    if (!dialogVisible.value) {
      return;
    }

    page.value = 1;
    void loadRows();
  },
  { deep: true },
);
</script>

<style scoped lang="scss">
.relation-select-form-item {
  width: 100%;
}

.relation-select-form-item__trigger-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.relation-select-form-item__trigger-control {
  display: flex;
  align-items: stretch;
  width: min(100%, 460px);
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
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease,
    background-color 0.18s ease;
}

.relation-select-form-item__trigger-control:hover:not(
    .relation-select-form-item__trigger-control--disabled
  ) {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--line-strong));
  box-shadow:
    0 16px 34px rgba(11, 26, 41, 0.08),
    0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent);
  transform: translateY(-1px);
}

.relation-select-form-item__trigger-control:focus-within {
  border-color: color-mix(in srgb, var(--accent) 46%, var(--line-strong));
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent),
    0 16px 32px rgba(11, 26, 41, 0.08);
}

.relation-select-form-item__trigger-control--active {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--line-strong));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, white 86%, var(--accent) 8%),
    color-mix(in srgb, var(--surface-1) 96%, var(--accent) 4%)
  );
}

.relation-select-form-item__trigger-control--disabled {
  opacity: 0.62;
  box-shadow: none;
  transform: none;
}

.relation-select-form-item__trigger-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  flex: 1;
  padding: 13px 16px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.relation-select-form-item__trigger-main:disabled {
  cursor: not-allowed;
}

.relation-select-form-item__trigger-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.relation-select-form-item__trigger-title {
  display: block;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.relation-select-form-item__trigger-description {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
}

.relation-select-form-item__trigger-meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.relation-select-form-item__trigger-badge {
  min-width: 38px;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: color-mix(in srgb, var(--accent) 78%, #0f1822);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  text-align: center;
}

.relation-select-form-item__trigger-arrow {
  width: 9px;
  height: 9px;
  margin-right: 2px;
  border-top: 1.5px solid var(--ink-3);
  border-right: 1.5px solid var(--ink-3);
  transform: rotate(45deg);
  opacity: 0.7;
}

.relation-select-form-item__trigger-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 52px;
  padding: 0;
  border: 0;
  border-left: 1px solid color-mix(in srgb, var(--line-soft) 82%, var(--accent) 12%);
  background: color-mix(in srgb, var(--surface-1) 84%, var(--accent) 10%);
  color: var(--ink-3);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.relation-select-form-item__trigger-clear:hover:not(:disabled) {
  background: color-mix(in srgb, #ff6b57 10%, white);
  color: #d1432f;
}

.relation-select-form-item__trigger-clear:disabled {
  cursor: not-allowed;
}

.relation-select-form-item__trigger-clear-icon {
  position: relative;
  display: inline-block;
  width: 14px;
  height: 14px;
}

.relation-select-form-item__trigger-clear-icon::before,
.relation-select-form-item__trigger-clear-icon::after {
  content: '';
  position: absolute;
  top: 6px;
  left: 0;
  width: 14px;
  height: 1.5px;
  border-radius: 999px;
  background: currentColor;
}

.relation-select-form-item__trigger-clear-icon::before {
  transform: rotate(45deg);
}

.relation-select-form-item__trigger-clear-icon::after {
  transform: rotate(-45deg);
}

.relation-select-form-item__preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.relation-select-dialog {
  display: grid;
  gap: 16px;
}

.relation-select-dialog__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.relation-select-dialog__search {
  flex: 1;
  min-width: 0;
}

.relation-select-dialog__toolbar-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.relation-select-dialog__toolbar-meta--standalone {
  justify-content: flex-end;
}

.relation-select-dialog__body {
  min-height: 220px;
}

.relation-select-dialog__options {
  display: grid;
  gap: 12px;
}

.relation-select-dialog__options--card {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.relation-select-dialog__options--list {
  grid-template-columns: 1fr;
}

.relation-select-dialog__option {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: var(--surface-1);
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.relation-select-dialog__option:hover {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--line-strong));
  box-shadow: 0 12px 28px rgba(11, 26, 41, 0.08);
  transform: translateY(-1px);
}

.relation-select-dialog__option--active {
  border-color: color-mix(in srgb, var(--accent) 70%, white);
  background: color-mix(in srgb, var(--accent) 8%, white);
}

.relation-select-dialog__option--disabled {
  opacity: 0.56;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.relation-select-dialog__option-content {
  min-width: 0;
  flex: 1;
}

.relation-select-dialog__option-indicator {
  flex: 0 0 auto;
  align-self: center;
  min-width: 44px;
  padding: 4px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: color-mix(in srgb, var(--accent) 76%, #0f1822);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
}

.relation-select-dialog__fallback {
  display: grid;
  gap: 6px;
}

.relation-select-dialog__fallback strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.relation-select-dialog__fallback span {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.relation-select-dialog__pagination {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 860px) {
  .relation-select-dialog__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .relation-select-dialog__toolbar-meta {
    width: 100%;
  }

  .relation-select-dialog__options--card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .relation-select-form-item__trigger-control {
    width: 100%;
  }
}
</style>
