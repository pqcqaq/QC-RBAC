<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadUsers">刷新</el-button>
        <el-button
          v-permission:and="['user.create', 'user.assign-role']"
          type="primary"
          @click="openCreate"
        >
          创建用户
        </el-button>
      </el-space>
    </template>

    <template #toolbar>
      <UsersToolbar
        :filters="pageState.filters"
        :role-options="roleOptions"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <UsersTable
      :users="users"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :context-menu-items="userContextMenuItems"
      @detail="openDetail"
      @permission-source="showPermissionSource"
      @edit="openEdit"
      @delete="removeUser"
      @page-change="changePage"
    />

    <UserEditorDialog
      v-model:visible="dialogVisible"
      :title="editingId ? '编辑用户' : '创建用户'"
      :form="form"
      :role-options="roleOptions"
      :can-assign-roles="canAssignRoles"
      @save="saveUser"
    />

    <UserPermissionSourceDrawer
      v-model:visible="drawerVisible"
      :source="permissionSource"
    />

    <UserDetailDrawer
      v-model:visible="detailVisible"
      :user="detailUser"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UserFormPayload, UserPermissionSource, UserRecord } from '@rbac/api-common';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { useResourceDetail, useResourceEditor, useResourceRemoval } from '@/composables/use-resource-crud';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import UserDetailDrawer from './components/UserDetailDrawer.vue';
import UserEditorDialog from './components/UserEditorDialog.vue';
import UserPermissionSourceDrawer from './components/UserPermissionSourceDrawer.vue';
import UsersTable from './components/UsersTable.vue';
import UsersToolbar from './components/UsersToolbar.vue';

defineOptions({ name: 'UsersView' });

definePage({
  viewKey: 'users',
  keepAlive: true,
});

type UsersPageState = {
  filters: {
    q: string;
    status: '' | 'ACTIVE' | 'DISABLED';
    roleId: string;
  };
  page: number;
};

const auth = useAuthStore();
const users = ref<UserRecord[]>([]);
const roleOptions = ref<Array<{ id: string; name: string }>>([]);
const permissionSource = ref<UserPermissionSource | null>(null);
const drawerVisible = ref(false);
const total = ref(0);
const loading = ref(false);
const pageSize = 10;

const { state: pageState } = usePageState<UsersPageState>('page:users', {
  filters: {
    q: '',
    status: '',
    roleId: '',
  },
  page: 1,
});

type UserEditorForm = {
  username: string;
  email: string;
  nickname: string;
  password: string;
  status: 'ACTIVE' | 'DISABLED';
  roleIds: string[];
};

const createEmptyForm = (): UserEditorForm => ({
  username: '',
  email: '',
  nickname: '',
  password: '',
  status: 'ACTIVE',
  roleIds: [],
});

const canEdit = computed(() => auth.hasPermission('user.update'));
const canDelete = computed(() => auth.hasPermission('user.delete'));
const canAssignRoles = computed(() => auth.hasPermission('user.assign-role'));
const canExplore = computed(() => auth.hasPermission('rbac.explorer'));

const stats = computed(() => {
  const activeCount = users.value.filter((item) => item.status === 'ACTIVE').length;
  const disabledCount = users.value.filter((item) => item.status === 'DISABLED').length;

  return [
    { label: '成员总数', value: total.value },
    { label: '当前页启用', value: activeCount },
    { label: '当前页禁用', value: disabledCount },
    { label: '角色目录', value: roleOptions.value.length },
  ];
});

const loadUsers = async () => {
  try {
    loading.value = true;
    const response = await api.users.list({
      page: pageState.page,
      pageSize,
      q: pageState.filters.q || undefined,
      status: pageState.filters.status || undefined,
      roleId: pageState.filters.roleId || undefined,
    });

    users.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载用户列表失败'));
  } finally {
    loading.value = false;
  }
};

const loadRoleOptions = async () => {
  try {
    roleOptions.value = await api.users.roles();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载角色选项失败'));
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadUsers();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.status = '';
  pageState.filters.roleId = '';
  pageState.page = 1;
  await loadUsers();
};

const showPermissionSource = async (id: string) => {
  try {
    permissionSource.value = await api.users.permissionSources(id);
    drawerVisible.value = true;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载权限来源失败'));
  }
};

const {
  dialogVisible,
  editingId,
  form,
  openCreate,
  openEdit,
  save: saveUser,
} = useResourceEditor<UserRecord, UserEditorForm, UserFormPayload>({
  createEmptyForm,
  getId: (row) => row.id,
  assignForm: (currentForm, row) => {
    currentForm.username = row.username;
    currentForm.email = row.email ?? '';
    currentForm.nickname = row.nickname;
    currentForm.password = '';
    currentForm.status = row.status;
    currentForm.roleIds = row.roles.map((role) => role.id);
  },
  buildPayload: (currentForm) => ({
    username: currentForm.username,
    email: currentForm.email,
    nickname: currentForm.nickname,
    password: currentForm.password || undefined,
    status: currentForm.status,
    roleIds: currentForm.roleIds,
  }),
  create: (payload) => api.users.create(payload),
  update: (id, payload) => api.users.update(id, payload),
  validate: (currentForm, currentEditingId) => {
    if (!currentForm.username || !currentForm.nickname || !currentForm.email) {
      return '请完整填写用户名、昵称和邮箱';
    }

    if (!currentEditingId && !currentForm.password) {
      return '创建用户时必须填写密码';
    }

    if (!currentForm.roleIds.length) {
      return '至少为用户分配一个角色';
    }

    return undefined;
  },
  afterSaved: loadUsers,
  messages: {
    createSuccess: '用户已创建',
    updateSuccess: '用户已更新',
    saveError: '保存用户失败',
  },
});

const {
  detailVisible,
  detail: detailUser,
  openDetail,
} = useResourceDetail<UserRecord, UserRecord>({
  getId: (row) => row.id,
  loadDetail: (id) => api.users.detail(id),
  errorMessage: '加载用户详情失败',
});

const { removeRecord: removeUser } = useResourceRemoval<UserRecord>({
  getId: (row) => row.id,
  remove: (id) => api.users.remove(id),
  confirmTitle: '删除用户',
  confirmMessage: '删除后不可恢复，是否继续？',
  successMessage: '用户已删除',
  errorMessage: '删除用户失败',
  afterRemoved: loadUsers,
});

const userContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'permission-source',
    label: '查看权限来源',
    hidden: () => !canExplore.value,
    onSelect: (row) => showPermissionSource(row.id),
  },
  {
    key: 'edit-divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑用户',
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除用户',
    hidden: () => !canDelete.value,
    danger: true,
    onSelect: (row) => removeUser(row),
  },
] satisfies ContextMenuItem<UserRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadUsers();
};

onMounted(async () => {
  await Promise.all([loadUsers(), loadRoleOptions()]);
});
</script>
