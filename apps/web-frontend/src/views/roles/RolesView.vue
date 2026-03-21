<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadRoles">刷新</el-button>
        <el-button type="primary" :disabled="!canCreate" @click="openCreate">新建角色</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <el-form label-position="top" class="page-toolbar">
        <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
          <el-input
            v-model="pageState.filters.q"
            clearable
            placeholder="角色名称 / 角色编码"
            @keyup.enter="applyFilters"
          />
        </el-form-item>

        <el-form-item label="包含权限" class="page-toolbar__field">
          <el-select v-model="pageState.filters.permissionId" clearable filterable placeholder="全部权限">
            <el-option
              v-for="permission in permissionOptions"
              :key="permission.id"
              :label="permission.name"
              :value="permission.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="角色类型" class="page-toolbar__field">
          <el-select v-model="pageState.filters.roleType" clearable placeholder="全部类型">
            <el-option label="系统角色" value="system" />
            <el-option label="自定义角色" value="custom" />
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
          <p class="panel-caption">Role Matrix</p>
          <h3 class="panel-heading panel-heading--md">角色矩阵</h3>
        </div>
        <div class="table-panel__meta">
          <span>支持行右键快捷操作</span>
          <span>共 {{ filteredRoles.length }} 个角色</span>
          <span>{{ filteredRoles.filter((item) => item.isSystem).length }} 个系统角色</span>
        </div>
      </header>

      <ContextMenuHost :items="roleContextMenuItems" manual>
        <template #default="{ open }">
          <el-table
            :data="filteredRoles"
            class="table-context-menu"
            stripe
            v-loading="loading"
            @row-contextmenu="(row, _column, event) => open(event, row)"
          >
            <el-table-column label="角色" min-width="240">
              <template #default="{ row }">
                <div class="table-stack">
                  <strong>{{ row.name }}</strong>
                  <span>{{ row.code }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="description" label="描述" min-width="240" />

            <el-table-column label="权限数" width="120">
              <template #default="{ row }">
                {{ row.permissionCount }}
              </template>
            </el-table-column>

            <el-table-column label="成员数" width="120">
              <template #default="{ row }">
                {{ row.userCount }}
              </template>
            </el-table-column>

            <el-table-column label="类型" width="120">
              <template #default="{ row }">
                <el-tag :type="row.isSystem ? 'warning' : 'info'" effect="light" round>
                  {{ row.isSystem ? '系统角色' : '自定义' }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="更新时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.updatedAt) }}
              </template>
            </el-table-column>

            <el-table-column label="操作" width="240" fixed="right">
              <template #default="{ row }">
                <el-space>
                  <el-button link @click="openDetail(row)">详情</el-button>
                  <el-button link :disabled="!canEdit" @click="openEdit(row)">编辑</el-button>
                  <el-button link type="danger" :disabled="!canDelete || row.isSystem" @click="removeRole(row)">
                    删除
                  </el-button>
                </el-space>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </ContextMenuHost>
    </section>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑角色' : '新建角色'" width="760px">
      <el-form label-position="top" class="page-form-grid">
        <el-form-item label="角色编码">
          <el-input v-model="form.code" :disabled="systemRoleLocked" />
        </el-form-item>
        <el-form-item label="角色名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="角色描述" class="page-form-grid__full">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="分配权限" class="page-form-grid__full">
          <el-select v-model="form.permissionIds" multiple filterable collapse-tags collapse-tags-tooltip>
            <el-option
              v-for="permission in permissionOptions"
              :key="permission.id"
              :label="`${permission.name} (${permission.code})`"
              :value="permission.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" :title="detailRole ? `${detailRole.name} · 角色详情` : '角色详情'" size="40%">
      <div v-if="detailRole" class="detail-stack">
        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Role Profile</p>
              <h3 class="panel-heading panel-heading--md">{{ detailRole.name }}</h3>
            </div>
            <el-tag :type="detailRole.isSystem ? 'warning' : 'info'" round>
              {{ detailRole.isSystem ? '系统角色' : '自定义角色' }}
            </el-tag>
          </div>

          <div class="detail-kv-grid">
            <div class="detail-kv">
              <span>角色编码</span>
              <strong>{{ detailRole.code }}</strong>
            </div>
            <div class="detail-kv">
              <span>绑定成员</span>
              <strong>{{ detailRole.userCount }}</strong>
            </div>
            <div class="detail-kv">
              <span>权限数量</span>
              <strong>{{ detailRole.permissionCount }}</strong>
            </div>
            <div class="detail-kv">
              <span>更新时间</span>
              <strong>{{ formatTime(detailRole.updatedAt) }}</strong>
            </div>
            <div class="detail-kv detail-kv--full">
              <span>角色描述</span>
              <strong>{{ detailRole.description || '该角色未填写描述。' }}</strong>
            </div>
          </div>
        </section>

        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Attached Permissions</p>
              <h3 class="panel-heading panel-heading--md">权限构成</h3>
            </div>
            <el-tag type="info" round>{{ detailRole.permissions.length }} 项权限</el-tag>
          </div>
          <div class="detail-chip-list">
            <span v-for="permission in detailRole.permissions" :key="permission.id" class="permission-tag">
              {{ permission.code }}
            </span>
          </div>
        </section>
      </div>
    </el-drawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { PermissionSummary, RoleRecord } from '@rbac/api-common';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

defineOptions({ name: 'RolesView' });

type RolesPageState = {
  filters: {
    q: string;
    permissionId: string;
    roleType: '' | 'system' | 'custom';
  };
};

const auth = useAuthStore();
const roles = ref<RoleRecord[]>([]);
const permissionOptions = ref<PermissionSummary[]>([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const detailRole = ref<RoleRecord | null>(null);
const editingId = ref<string | null>(null);
const loading = ref(false);
const systemRoleLocked = ref(false);

const { state: pageState } = usePageState<RolesPageState>('page:roles', {
  filters: {
    q: '',
    permissionId: '',
    roleType: '',
  },
});

const form = reactive({
  code: '',
  name: '',
  description: '',
  permissionIds: [] as string[],
});

const canCreate = computed(() => auth.hasPermission('role.create'));
const canEdit = computed(() => auth.hasPermission('role.update'));
const canDelete = computed(() => auth.hasPermission('role.delete'));
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
    disabled: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除角色',
    disabled: (row) => !canDelete.value || row.isSystem,
    danger: true,
    onSelect: (row) => removeRole(row),
  },
] satisfies ContextMenuItem<RoleRecord>[];

const filteredRoles = computed(() => {
  const keyword = pageState.filters.q.trim().toLowerCase();

  return roles.value.filter((role) => {
    const matchKeyword = !keyword
      || role.name.toLowerCase().includes(keyword)
      || role.code.toLowerCase().includes(keyword);
    const matchPermission = !pageState.filters.permissionId
      || role.permissions.some((permission) => permission.id === pageState.filters.permissionId);
    const matchRoleType = !pageState.filters.roleType
      || (pageState.filters.roleType === 'system' ? role.isSystem : !role.isSystem);

    return matchKeyword && matchPermission && matchRoleType;
  });
});

const stats = computed(() => {
  const roleCount = roles.value.length;
  const systemRoleCount = roles.value.filter((item) => item.isSystem).length;
  const memberCount = roles.value.reduce((sum, item) => sum + item.userCount, 0);
  const permissionLinks = roles.value.reduce((sum, item) => sum + item.permissionCount, 0);

  return [
    { label: '角色总数', value: roleCount },
    { label: '系统角色', value: systemRoleCount },
    { label: '角色成员', value: memberCount },
    { label: '权限映射', value: permissionLinks },
  ];
});

const formatTime = (value: string) => new Date(value).toLocaleString();

const sortRoles = (items: RoleRecord[]) => [...items].sort((left, right) => {
  if (left.isSystem !== right.isSystem) {
    return left.isSystem ? -1 : 1;
  }
  return left.name.localeCompare(right.name, 'zh-CN');
});

const resetForm = () => {
  form.code = '';
  form.name = '';
  form.description = '';
  form.permissionIds = [];
};

const loadRoles = async () => {
  try {
    loading.value = true;
    roles.value = sortRoles(await api.roles.list());
  } catch (error: any) {
    ElMessage.error(error?.message ?? '加载角色列表失败');
  } finally {
    loading.value = false;
  }
};

const loadPermissionOptions = async () => {
  try {
    permissionOptions.value = await api.roles.permissions();
  } catch (error: any) {
    ElMessage.error(error?.message ?? '加载权限选项失败');
  }
};

const applyFilters = async () => {
  await loadRoles();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.permissionId = '';
  pageState.filters.roleType = '';
  await loadRoles();
};

const openCreate = () => {
  editingId.value = null;
  systemRoleLocked.value = false;
  resetForm();
  dialogVisible.value = true;
};

const openEdit = (row: RoleRecord) => {
  editingId.value = row.id;
  systemRoleLocked.value = row.isSystem;
  form.code = row.code;
  form.name = row.name;
  form.description = row.description ?? '';
  form.permissionIds = row.permissions.map((permission) => permission.id);
  dialogVisible.value = true;
};

const saveRole = async () => {
  try {
    if (!form.code || !form.name) {
      ElMessage.warning('请完整填写角色编码和角色名称');
      return;
    }

    if (!form.permissionIds.length) {
      ElMessage.warning('至少为角色分配一项权限');
      return;
    }

    const payload = {
      code: form.code,
      name: form.name,
      description: form.description,
      permissionIds: form.permissionIds,
    };

    if (editingId.value) {
      await api.roles.update(editingId.value, payload);
      ElMessage.success('角色已更新');
    } else {
      await api.roles.create(payload);
      ElMessage.success('角色已创建');
    }

    dialogVisible.value = false;
    await loadRoles();
  } catch (error: any) {
    ElMessage.error(error?.message ?? '保存角色失败');
  }
};

const openDetail = async (row: RoleRecord) => {
  try {
    detailRole.value = await api.roles.detail(row.id);
    detailVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error?.message ?? '加载角色详情失败');
  }
};

const removeRole = async (row: RoleRecord) => {
  try {
    await ElMessageBox.confirm(`确定删除角色“${row.name}”吗？`, '删除角色', { type: 'warning' });
    await api.roles.remove(row.id);
    ElMessage.success('角色已删除');
    await loadRoles();
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(error?.message ?? '删除角色失败');
  }
};

onMounted(async () => {
  await Promise.all([loadRoles(), loadPermissionOptions()]);
});
</script>
