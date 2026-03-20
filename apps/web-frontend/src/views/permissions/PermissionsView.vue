<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadData">刷新</el-button>
        <el-button type="primary" :disabled="!canCreate" @click="openCreate">新增权限</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <el-form label-position="top" class="page-toolbar">
        <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
          <el-input
            v-model="pageState.filters.q"
            clearable
            placeholder="权限码 / 名称 / 描述"
            @keyup.enter="applyFilters"
          />
        </el-form-item>

        <el-form-item label="模块" class="page-toolbar__field">
          <el-select v-model="pageState.filters.module" clearable placeholder="全部模块">
            <el-option v-for="module in moduleOptions" :key="module" :label="module" :value="module" />
          </el-select>
        </el-form-item>

        <el-form-item label="权限来源" class="page-toolbar__field">
          <el-select v-model="pageState.filters.sourceType" clearable placeholder="全部来源">
            <el-option label="系统种子" value="seed" />
            <el-option label="自定义" value="custom" />
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
          <p class="panel-caption">Capability Ledger</p>
          <h3 class="panel-heading panel-heading--md">权限目录</h3>
        </div>
        <div class="table-panel__meta">
          <span>共 {{ filteredPermissions.length }} 项能力</span>
          <span>{{ seedCount }} 项系统种子</span>
        </div>
      </header>

      <el-table :data="filteredPermissions" stripe v-loading="loading">
        <el-table-column prop="code" label="权限码" min-width="220" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="module" label="模块" width="140" />
        <el-table-column prop="action" label="动作" width="120" />
        <el-table-column label="来源" width="120">
          <template #default="{ row }">
            <el-tag :type="isSeedPermission(row.code) ? 'warning' : 'info'" effect="light" round>
              {{ isSeedPermission(row.code) ? '系统种子' : '自定义' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="240" />
        <el-table-column label="更新时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button link @click="openDetail(row)">详情</el-button>
              <el-button link :disabled="!canEdit" @click="openEdit(row)">编辑</el-button>
              <el-button
                link
                type="danger"
                :disabled="!canDelete || isSeedPermission(row.code)"
                @click="removePermission(row.id, row.code)"
              >
                删除
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑权限' : '新增权限'" width="700px">
      <el-form label-position="top" class="page-form-grid">
        <el-form-item label="权限码" class="page-form-grid__full">
          <el-input v-model="form.code" :disabled="seedPermissionLocked" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="模块">
          <el-input v-model="form.module" :disabled="seedPermissionLocked" />
        </el-form-item>
        <el-form-item label="动作">
          <el-input v-model="form.action" :disabled="seedPermissionLocked" />
        </el-form-item>
        <el-form-item label="描述" class="page-form-grid__full">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePermission">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" :title="detailPermission ? `${detailPermission.code} · 权限详情` : '权限详情'" size="38%">
      <div v-if="detailPermission" class="detail-stack">
        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Permission Profile</p>
              <h3 class="panel-heading panel-heading--md">{{ detailPermission.code }}</h3>
            </div>
            <el-tag :type="isSeedPermission(detailPermission.code) ? 'warning' : 'info'" round>
              {{ isSeedPermission(detailPermission.code) ? '系统种子' : '自定义权限' }}
            </el-tag>
          </div>

          <div class="detail-kv-grid">
            <div class="detail-kv">
              <span>名称</span>
              <strong>{{ detailPermission.name }}</strong>
            </div>
            <div class="detail-kv">
              <span>模块</span>
              <strong>{{ detailPermission.module }}</strong>
            </div>
            <div class="detail-kv">
              <span>动作</span>
              <strong>{{ detailPermission.action }}</strong>
            </div>
            <div class="detail-kv">
              <span>更新时间</span>
              <strong>{{ formatTime(detailPermission.updatedAt) }}</strong>
            </div>
            <div class="detail-kv detail-kv--full">
              <span>描述</span>
              <strong>{{ detailPermission.description || '该权限未填写描述。' }}</strong>
            </div>
          </div>
        </section>
      </div>
    </el-drawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { permissionCatalog } from '@rbac/api-common';
import type { PermissionRecord } from '@rbac/api-common';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

defineOptions({ name: 'PermissionsView' });

type PermissionsPageState = {
  filters: {
    q: string;
    module: string;
    sourceType: '' | 'seed' | 'custom';
  };
};

const auth = useAuthStore();
const permissions = ref<PermissionRecord[]>([]);
const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const detailVisible = ref(false);
const detailPermission = ref<PermissionRecord | null>(null);
const seedPermissionLocked = ref(false);
const loading = ref(false);

const { state: pageState } = usePageState<PermissionsPageState>('page:permissions', {
  filters: {
    q: '',
    module: '',
    sourceType: '',
  },
});

const form = reactive({
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

const formatTime = (value: string) => new Date(value).toLocaleString();
const isSeedPermission = (code: string) => permissionCatalog.some((item) => item.code === code);

const loadData = async () => {
  try {
    loading.value = true;
    permissions.value = [...await api.permissions.list()].sort((left, right) => left.code.localeCompare(right.code, 'zh-CN'));
  } catch (error: any) {
    ElMessage.error(error?.message ?? '加载权限列表失败');
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  form.code = '';
  form.name = '';
  form.module = '';
  form.action = '';
  form.description = '';
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

const openCreate = () => {
  editingId.value = null;
  seedPermissionLocked.value = false;
  resetForm();
  dialogVisible.value = true;
};

const openEdit = (row: PermissionRecord) => {
  editingId.value = row.id;
  seedPermissionLocked.value = isSeedPermission(row.code);
  form.code = row.code;
  form.name = row.name;
  form.module = row.module;
  form.action = row.action;
  form.description = row.description ?? '';
  dialogVisible.value = true;
};

const savePermission = async () => {
  try {
    if (!form.code || !form.name || !form.module || !form.action) {
      ElMessage.warning('请完整填写权限码、名称、模块和动作');
      return;
    }

    if (editingId.value) {
      await api.permissions.update(editingId.value, form);
      ElMessage.success('权限已更新');
    } else {
      await api.permissions.create(form);
      ElMessage.success('权限已新增');
    }

    dialogVisible.value = false;
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message ?? '保存权限失败');
  }
};

const openDetail = async (row: PermissionRecord) => {
  try {
    detailPermission.value = await api.permissions.detail(row.id);
    detailVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error?.message ?? '加载权限详情失败');
  }
};

const removePermission = async (id: string, code: string) => {
  try {
    await ElMessageBox.confirm(`确定删除权限“${code}”吗？`, '删除权限', { type: 'warning' });
    await api.permissions.remove(id);
    ElMessage.success('权限已删除');
    await loadData();
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(error?.message ?? '删除权限失败');
  }
};

onMounted(loadData);
</script>
