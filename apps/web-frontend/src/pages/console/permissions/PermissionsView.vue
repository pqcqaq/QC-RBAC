<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadData">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出权限失败" />
        <el-button v-permission="'permission.create'" type="primary" @click="openCreate">新增权限</el-button>
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
      :permissions="permissions"
      :loading="loading"
      :seed-count="seedCount"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :context-menu-items="permissionContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removePermission"
      @page-change="changePage"
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
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { PermissionFormPayload, PermissionRecord } from '@rbac/api-common';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PermissionEditorDialog from '@/components/permissions/PermissionEditorDialog.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { usePageState } from '@/composables/use-page-state';
import { useResourceDetail, useResourceEditor, useResourceRemoval } from '@/composables/use-resource-crud';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import PermissionDetailDrawer from './components/PermissionDetailDrawer.vue';
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
  page: number;
};

const auth = useAuthStore();
const permissions = ref<PermissionRecord[]>([]);
const moduleOptions = ref<string[]>([]);
const seedPermissionLocked = ref(false);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;

const { state: pageState } = usePageState<PermissionsPageState>('page:permissions', {
  filters: {
    q: '',
    module: '',
    sourceType: '',
  },
  page: 1,
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

const canEdit = computed(() => auth.hasPermission('permission.update'));
const canDelete = computed(() => auth.hasPermission('permission.delete'));
const seedCount = computed(() => permissions.value.filter((item) => item.isSystem).length);
const customCount = computed(() => permissions.value.length - seedCount.value);

const stats = computed(() => [
  { label: '权限总数', value: total.value },
  { label: '当前页系统种子', value: seedCount.value },
  { label: '当前页自定义', value: customCount.value },
  { label: '模块目录', value: moduleOptions.value.length },
]);

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  module: pageState.filters.module || undefined,
  sourceType: pageState.filters.sourceType || undefined,
});

const buildExportRequest = () => api.permissions.export(buildFilterParams());

const loadData = async () => {
  try {
    loading.value = true;
    const response = await api.permissions.list({
      page: pageState.page,
      pageSize,
      ...buildFilterParams(),
    });
    const totalPages = Math.max(Math.ceil(response.meta.total / pageSize), 1);
    if (pageState.page > totalPages) {
      pageState.page = totalPages;
      await loadData();
      return;
    }
    permissions.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载权限列表失败'));
  } finally {
    loading.value = false;
  }
};

const loadModuleOptions = async () => {
  try {
    moduleOptions.value = await api.permissions.modules();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载模块选项失败'));
  }
};

const refreshPageData = async () => {
  await Promise.all([loadData(), loadModuleOptions()]);
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadData();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.module = '';
  pageState.filters.sourceType = '';
  pageState.page = 1;
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
    seedPermissionLocked.value = row.isSystem;
  },
  afterSaved: refreshPageData,
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
  afterRemoved: refreshPageData,
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
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除权限',
    hidden: (row) => !canDelete.value || row.isSystem,
    danger: true,
    onSelect: (row) => removePermission(row),
  },
] satisfies ContextMenuItem<PermissionRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadData();
};

onMounted(async () => {
  await Promise.all([loadData(), loadModuleOptions()]);
});
</script>
