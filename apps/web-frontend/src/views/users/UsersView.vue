<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadUsers">刷新</el-button>
        <el-button type="primary" :disabled="!canCreate" @click="openCreate">创建用户</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <el-form label-position="top" class="page-toolbar">
        <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
          <el-input
            v-model="pageState.filters.q"
            clearable
            placeholder="用户名 / 邮箱 / 昵称"
            @keyup.enter="applyFilters"
          />
        </el-form-item>

        <el-form-item label="账号状态" class="page-toolbar__field">
          <el-select v-model="pageState.filters.status" clearable placeholder="全部状态">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="禁用" value="DISABLED" />
          </el-select>
        </el-form-item>

        <el-form-item label="所属角色" class="page-toolbar__field">
          <el-select v-model="pageState.filters.roleId" clearable placeholder="全部角色">
            <el-option v-for="role in roleOptions" :key="role.id" :label="role.name" :value="role.id" />
          </el-select>
        </el-form-item>

        <div class="page-toolbar__actions">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" plain @click="applyFilters">查询</el-button>
        </div>
      </el-form>
    </template>

    <section class="table-panel surface-card">
      <header class="table-panel__header">
        <div>
          <p class="panel-caption">Member Directory</p>
          <h3 class="panel-heading panel-heading--md">用户清单</h3>
        </div>
        <div class="table-panel__meta">
          <span>支持行右键快捷操作</span>
          <span>共 {{ total }} 条记录</span>
          <span>当前第 {{ pageState.page }} 页</span>
        </div>
      </header>

      <ContextMenuHost :items="userContextMenuItems" manual>
        <template #default="{ open }">
          <el-table
            :data="users"
            class="table-context-menu"
            stripe
            v-loading="loading"
            @row-contextmenu="(row, _column, event) => open(event, row)"
          >
            <el-table-column label="成员" min-width="240">
              <template #default="{ row }">
                <div class="table-user">
                  <div v-if="row.avatar" class="table-user__avatar table-user__avatar--image">
                    <img :src="row.avatar" :alt="row.nickname" />
                  </div>
                  <div v-else class="table-user__avatar">
                    {{ row.nickname.slice(0, 1).toUpperCase() }}
                  </div>
                  <div class="table-user__meta">
                    <strong>{{ row.nickname }}</strong>
                    <span>{{ row.email }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="username" label="用户名" min-width="140" />

            <el-table-column label="角色" min-width="260">
              <template #default="{ row }">
                <div class="detail-chip-list">
                  <span v-for="role in row.roles" :key="role.id" class="role-pill">{{ role.name }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" effect="light" round>
                  {{ row.status === 'ACTIVE' ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="更新时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.updatedAt) }}
              </template>
            </el-table-column>

            <el-table-column label="操作" width="290" fixed="right">
              <template #default="{ row }">
                <el-space>
                  <el-button link @click="openDetail(row)">详情</el-button>
                  <el-button link :disabled="!canExplore" @click="showPermissionSource(row.id)">权限来源</el-button>
                  <el-button link :disabled="!canEdit" @click="openEdit(row)">编辑</el-button>
                  <el-button link type="danger" :disabled="!canDelete" @click="removeUser(row)">删除</el-button>
                </el-space>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </ContextMenuHost>

      <el-pagination
        background
        layout="prev, pager, next, total"
        :current-page="pageState.page"
        :page-size="pageSize"
        :total="total"
        @current-change="changePage"
      />
    </section>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑用户' : '创建用户'" width="720px">
      <el-form label-position="top" class="page-form-grid">
        <el-form-item label="用户名">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" />
        </el-form-item>
        <el-form-item label="邮箱" class="page-form-grid__full">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="密码" class="page-form-grid__full">
          <el-input v-model="form.password" show-password placeholder="编辑时留空表示不修改" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="禁用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.roleIds" multiple collapse-tags collapse-tags-tooltip :disabled="!canAssignRoles">
            <el-option v-for="role in roleOptions" :key="role.id" :label="role.name" :value="role.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="drawerVisible" :title="permissionSource ? `${permissionSource.user.nickname} · 权限来源` : '权限来源'" size="42%">
      <div v-if="permissionSource" class="detail-stack">
        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Effective Permissions</p>
              <h3 class="panel-heading panel-heading--md">{{ permissionSource.user.nickname }}</h3>
            </div>
            <el-tag round>{{ permissionSource.effectivePermissions.length }} 项权限</el-tag>
          </div>
          <div class="detail-chip-list">
            <span v-for="permission in permissionSource.effectivePermissions" :key="permission.id" class="permission-tag">
              {{ permission.code }}
            </span>
          </div>
        </section>

        <section v-for="group in permissionSource.groups" :key="group.role.id" class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Role Source</p>
              <h3 class="panel-heading panel-heading--md">{{ group.role.name }}</h3>
              <p class="muted">{{ group.role.description || '该角色未填写描述。' }}</p>
            </div>
            <el-tag type="info" round>{{ group.permissions.length }} 项来源</el-tag>
          </div>
          <div class="detail-chip-list">
            <span v-for="permission in group.permissions" :key="permission.id" class="permission-tag">
              {{ permission.code }}
            </span>
          </div>
        </section>
      </div>
    </el-drawer>

    <el-drawer v-model="detailVisible" :title="detailUser ? `${detailUser.nickname} · 用户详情` : '用户详情'" size="38%">
      <div v-if="detailUser" class="detail-stack">
        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Profile</p>
              <h3 class="panel-heading panel-heading--md">{{ detailUser.nickname }}</h3>
            </div>
            <el-tag :type="detailUser.status === 'ACTIVE' ? 'success' : 'info'" round>
              {{ detailUser.status === 'ACTIVE' ? '启用' : '禁用' }}
            </el-tag>
          </div>

          <div class="detail-kv-grid">
            <div class="detail-kv">
              <span>用户名</span>
              <strong>{{ detailUser.username }}</strong>
            </div>
            <div class="detail-kv">
              <span>邮箱</span>
              <strong>{{ detailUser.email }}</strong>
            </div>
            <div class="detail-kv">
              <span>创建时间</span>
              <strong>{{ formatTime(detailUser.createdAt) }}</strong>
            </div>
            <div class="detail-kv">
              <span>更新时间</span>
              <strong>{{ formatTime(detailUser.updatedAt) }}</strong>
            </div>
          </div>
        </section>

        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Assigned Roles</p>
              <h3 class="panel-heading panel-heading--md">角色绑定</h3>
            </div>
            <el-tag type="info" round>{{ detailUser.roles.length }} 个角色</el-tag>
          </div>
          <div class="detail-chip-list">
            <span v-for="role in detailUser.roles" :key="role.id" class="role-pill">{{ role.name }}</span>
          </div>
        </section>
      </div>
    </el-drawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UserFormPayload, UserPermissionSource, UserRecord } from '@rbac/api-common';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { useResourceDetail, useResourceEditor, useResourceRemoval } from '@/composables/use-resource-crud';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';

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

const canCreate = computed(() => auth.hasPermission('user.create'));
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

const formatTime = (value: string) => new Date(value).toLocaleString();

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
    currentForm.email = row.email;
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
    disabled: () => !canExplore.value,
    onSelect: (row) => showPermissionSource(row.id),
  },
  {
    key: 'edit-divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑用户',
    disabled: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除用户',
    disabled: () => !canDelete.value,
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
