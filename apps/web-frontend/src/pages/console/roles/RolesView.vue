<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadRoles">刷新</el-button>
        <el-button
          v-permission:and="['role.create', 'role.assign-permission']"
          type="primary"
          @click="openCreate"
        >
          新建角色
        </el-button>
      </el-space>
    </template>

    <template #toolbar>
      <RolesToolbar
        :filters="pageState.filters"
        :permission-options="permissionOptions"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <RolesTable
      :roles="roles"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :context-menu-items="roleContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removeRole"
      @page-change="changePage"
    />

    <RoleEditorDialog
      v-model:visible="dialogVisible"
      :title="editingId ? '编辑角色' : '新建角色'"
      :form="form"
      :permission-options="permissionOptions"
      :system-role-locked="systemRoleLocked"
      @save="saveRole"
    />

    <RoleDetailDrawer
      v-model:visible="detailVisible"
      :role="detailRole"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { PermissionSummary, RoleFormPayload, RoleRecord } from '@rbac/api-common';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { useResourceDetail, useResourceEditor, useResourceRemoval } from '@/composables/use-resource-crud';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import RoleDetailDrawer from './components/RoleDetailDrawer.vue';
import RoleEditorDialog from './components/RoleEditorDialog.vue';
import RolesTable from './components/RolesTable.vue';
import RolesToolbar from './components/RolesToolbar.vue';

defineOptions({ name: 'RolesView' });

definePage({
  viewKey: 'roles',
  keepAlive: true,
});

type RolesPageState = {
  filters: {
    q: string;
    permissionId: string;
    roleType: '' | 'system' | 'custom';
  };
  page: number;
};

const auth = useAuthStore();
const roles = ref<RoleRecord[]>([]);
const permissionOptions = ref<PermissionSummary[]>([]);
const loading = ref(false);
const systemRoleLocked = ref(false);
const total = ref(0);
const pageSize = 10;

const { state: pageState } = usePageState<RolesPageState>('page:roles', {
  filters: {
    q: '',
    permissionId: '',
    roleType: '',
  },
  page: 1,
});

type RoleEditorForm = {
  code: string;
  name: string;
  description: string;
  permissionIds: string[];
};

const createEmptyForm = (): RoleEditorForm => ({
  code: '',
  name: '',
  description: '',
  permissionIds: [],
});

const canEdit = computed(() => auth.hasPermission('role.update'));
const canDelete = computed(() => auth.hasPermission('role.delete'));

const stats = computed(() => {
  const systemRoleCount = roles.value.filter((item) => item.isSystem).length;
  const memberCount = roles.value.reduce((sum, item) => sum + item.userCount, 0);
  const permissionLinks = roles.value.reduce((sum, item) => sum + item.permissionCount, 0);

  return [
    { label: '角色总数', value: total.value },
    { label: '当前页系统角色', value: systemRoleCount },
    { label: '当前页成员', value: memberCount },
    { label: '当前页权限映射', value: permissionLinks },
  ];
});

const loadRoles = async () => {
  try {
    loading.value = true;
    const response = await api.roles.list({
      page: pageState.page,
      pageSize,
      q: pageState.filters.q || undefined,
      permissionId: pageState.filters.permissionId || undefined,
      roleType: pageState.filters.roleType || undefined,
    });
    const totalPages = Math.max(Math.ceil(response.meta.total / pageSize), 1);
    if (pageState.page > totalPages) {
      pageState.page = totalPages;
      await loadRoles();
      return;
    }
    roles.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载角色列表失败'));
  } finally {
    loading.value = false;
  }
};

const loadPermissionOptions = async () => {
  try {
    permissionOptions.value = await api.roles.permissions();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载权限选项失败'));
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadRoles();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.permissionId = '';
  pageState.filters.roleType = '';
  pageState.page = 1;
  await loadRoles();
};

const {
  dialogVisible,
  editingId,
  form,
  openCreate,
  openEdit,
  save: saveRole,
} = useResourceEditor<RoleRecord, RoleEditorForm, RoleFormPayload>({
  createEmptyForm,
  getId: (row) => row.id,
  assignForm: (currentForm, row) => {
    currentForm.code = row.code;
    currentForm.name = row.name;
    currentForm.description = row.description ?? '';
    currentForm.permissionIds = row.permissions.map((permission) => permission.id);
  },
  buildPayload: (currentForm) => ({
    code: currentForm.code,
    name: currentForm.name,
    description: currentForm.description,
    permissionIds: currentForm.permissionIds,
  }),
  create: (payload) => api.roles.create(payload),
  update: (id, payload) => api.roles.update(id, payload),
  validate: (currentForm) => {
    if (!currentForm.code || !currentForm.name) {
      return '请完整填写角色编码和角色名称';
    }

    if (!currentForm.permissionIds.length) {
      return '至少为角色分配一项权限';
    }

    return undefined;
  },
  afterOpenCreate: () => {
    systemRoleLocked.value = false;
  },
  afterOpenEdit: (row) => {
    systemRoleLocked.value = row.isSystem;
  },
  afterSaved: loadRoles,
  messages: {
    createSuccess: '角色已创建',
    updateSuccess: '角色已更新',
    saveError: '保存角色失败',
  },
});

const {
  detailVisible,
  detail: detailRole,
  openDetail,
} = useResourceDetail<RoleRecord, RoleRecord>({
  getId: (row) => row.id,
  loadDetail: (id) => api.roles.detail(id),
  errorMessage: '加载角色详情失败',
});

const { removeRecord: removeRole } = useResourceRemoval<RoleRecord>({
  getId: (row) => row.id,
  remove: (id) => api.roles.remove(id),
  confirmTitle: '删除角色',
  confirmMessage: (row) => `确定删除角色“${row.name}”吗？`,
  successMessage: '角色已删除',
  errorMessage: '删除角色失败',
  afterRemoved: loadRoles,
});

const roleContextMenuItems = [
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
    label: '编辑角色',
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除角色',
    hidden: (row) => !canDelete.value || row.isSystem,
    danger: true,
    onSelect: (row) => removeRole(row),
  },
] satisfies ContextMenuItem<RoleRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadRoles();
};

onMounted(async () => {
  await Promise.all([loadRoles(), loadPermissionOptions()]);
});
</script>
