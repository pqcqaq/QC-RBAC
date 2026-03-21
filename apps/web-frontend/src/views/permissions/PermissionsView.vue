<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadData">刷新</el-button>
        <el-button type="primary" :disabled="!canCreate" @click="openCreate">新增权限</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <PermissionsToolbar
        :filters="pageState.filters"
        :module-options="moduleOptions"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <PermissionsTable
      :permissions="filteredPermissions"
      :loading="loading"
      :seed-count="seedCount"
      :can-edit="canEdit"
      :can-delete="canDelete"
      :context-menu-items="permissionContextMenuItems"
      :is-seed-permission="isSeedPermission"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removePermission"
    />

    <PermissionEditorDialog
      v-model:visible="dialogVisible"
      :title="editingId ? '编辑权限' : '新增权限'"
      :form="form"
      :seed-permission-locked="seedPermissionLocked"
      @save="savePermission"
    />

    <PermissionDetailDrawer
      v-model:visible="detailVisible"
      :permission="detailPermission"
      :is-seed-permission="isSeedPermission"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { permissionCatalog } from '@rbac/api-common';
import type { PermissionFormPayload, PermissionRecord } from '@rbac/api-common';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { useResourceDetail, useResourceEditor, useResourceRemoval } from '@/composables/use-resource-crud';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import PermissionDetailDrawer from './components/PermissionDetailDrawer.vue';
import PermissionEditorDialog from './components/PermissionEditorDialog.vue';
import PermissionsTable from './components/PermissionsTable.vue';
import PermissionsToolbar from './components/PermissionsToolbar.vue';

defineOptions({ name: 'PermissionsView' });

definePage({
  viewKey: 'permissions',
  keepAlive: true,
});

type PermissionsPageState = {
  filters: {
    q: string;
    module: string;
    sourceType: '' | 'seed' | 'custom';
  };
};

const auth = useAuthStore();
const permissions = ref<PermissionRecord[]>([]);
const seedPermissionLocked = ref(false);
const loading = ref(false);

const { state: pageState } = usePageState<PermissionsPageState>('page:permissions', {
  filters: {
    q: '',
    module: '',
    sourceType: '',
  },
});

type PermissionEditorForm = {
  code: string;
  name: string;
  module: string;
  action: string;
  description: string;
};

const createEmptyForm = (): PermissionEditorForm => ({
  code: '',
  name: '',
  module: '',
  action: '',
  description: '',
});

const canCreate = computed(() => auth.hasPermission('permission.create'));
const canEdit = computed(() => auth.hasPermission('permission.update'));
const canDelete = computed(() => auth.hasPermission('permission.delete'));
const seedCount = computed(() => permissions.value.filter((item) => isSeedPermission(item.code)).length);
const customCount = computed(() => permissions.value.length - seedCount.value);
const moduleOptions = computed(() => Array.from(new Set(permissions.value.map((item) => item.module))).sort((left, right) => left.localeCompare(right, 'zh-CN')));

const filteredPermissions = computed(() => {
  const keyword = pageState.filters.q.trim().toLowerCase();

  return permissions.value.filter((permission) => {
    const isSeed = isSeedPermission(permission.code);
    const matchKeyword = !keyword
      || permission.code.toLowerCase().includes(keyword)
      || permission.name.toLowerCase().includes(keyword)
      || permission.description?.toLowerCase().includes(keyword);
    const matchModule = !pageState.filters.module || permission.module === pageState.filters.module;
    const matchSource = !pageState.filters.sourceType
      || (pageState.filters.sourceType === 'seed' ? isSeed : !isSeed);

    return matchKeyword && matchModule && matchSource;
  });
});

const stats = computed(() => [
  { label: '权限总数', value: permissions.value.length },
  { label: '系统种子', value: seedCount.value },
  { label: '自定义权限', value: customCount.value },
  { label: '覆盖模块', value: moduleOptions.value.length },
]);

const isSeedPermission = (code: string) => permissionCatalog.some((item) => item.code === code);

const loadData = async () => {
  try {
    loading.value = true;
    permissions.value = [...await api.permissions.list()].sort((left, right) => left.code.localeCompare(right.code, 'zh-CN'));
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载权限列表失败'));
  } finally {
    loading.value = false;
  }
};

const applyFilters = async () => {
  await loadData();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.module = '';
  pageState.filters.sourceType = '';
  await loadData();
};

const {
  dialogVisible,
  editingId,
  form,
  openCreate,
  openEdit,
  save: savePermission,
} = useResourceEditor<PermissionRecord, PermissionEditorForm, PermissionFormPayload>({
  createEmptyForm,
  getId: (row) => row.id,
  assignForm: (currentForm, row) => {
    currentForm.code = row.code;
    currentForm.name = row.name;
    currentForm.module = row.module;
    currentForm.action = row.action;
    currentForm.description = row.description ?? '';
  },
  buildPayload: (currentForm) => ({
    code: currentForm.code,
    name: currentForm.name,
    module: currentForm.module,
    action: currentForm.action,
    description: currentForm.description,
  }),
  create: (payload) => api.permissions.create(payload),
  update: (id, payload) => api.permissions.update(id, payload),
  validate: (currentForm) => {
    if (!currentForm.code || !currentForm.name || !currentForm.module || !currentForm.action) {
      return '请完整填写权限码、名称、模块和动作';
    }

    return undefined;
  },
  afterOpenCreate: () => {
    seedPermissionLocked.value = false;
  },
  afterOpenEdit: (row) => {
    seedPermissionLocked.value = isSeedPermission(row.code);
  },
  afterSaved: loadData,
  messages: {
    createSuccess: '权限已新增',
    updateSuccess: '权限已更新',
    saveError: '保存权限失败',
  },
});

const {
  detailVisible,
  detail: detailPermission,
  openDetail,
} = useResourceDetail<PermissionRecord, PermissionRecord>({
  getId: (row) => row.id,
  loadDetail: (id) => api.permissions.detail(id),
  errorMessage: '加载权限详情失败',
});

const { removeRecord: removePermission } = useResourceRemoval<PermissionRecord>({
  getId: (row) => row.id,
  remove: (id) => api.permissions.remove(id),
  confirmTitle: '删除权限',
  confirmMessage: (row) => `确定删除权限“${row.code}”吗？`,
  successMessage: '权限已删除',
  errorMessage: '删除权限失败',
  afterRemoved: loadData,
});

const permissionContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'edit-divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑权限',
    disabled: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除权限',
    disabled: (row) => !canDelete.value || isSeedPermission(row.code),
    danger: true,
    onSelect: (row) => removePermission(row),
  },
] satisfies ContextMenuItem<PermissionRecord>[];

onMounted(loadData);
</script>
