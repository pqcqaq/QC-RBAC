<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadData">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出客户端失败" />
        <el-button v-permission="'client.create'" type="primary" @click="openCreate">新增客户端</el-button>
      </el-space>
    </template>

    <template #toolbar>
      <ClientToolbar
        :filters="pageState.filters"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <ClientsTable
      :clients="clients"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :enabled-count="enabledCount"
      :disabled-count="disabledCount"
      :context-menu-items="clientContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removeClient"
      @page-change="changePage"
    />

    <ClientEditorDialog
      v-model:visible="dialogVisible"
      :title="editingId ? '编辑客户端' : '新增客户端'"
      :is-editing="Boolean(editingId)"
      :form="form"
      @save="saveClient"
    />

    <ClientDetailDrawer
      v-model:visible="detailVisible"
      :client="detailClient"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { AuthClientType, type AuthClientFormPayload, type AuthClientRecord } from '@rbac/api-common';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import { useResourceDetail, useResourceEditor, useResourceRemoval } from '@/composables/use-resource-crud';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import {
  assignClientEditorForm,
  buildClientPayload,
  createEmptyClientEditorForm,
  type ClientEditorForm,
  formatClientConfigSummary,
  resolveClientTypeLabel,
  validateClientForm,
} from './client-management';
import ClientDetailDrawer from './components/ClientDetailDrawer.vue';
import ClientEditorDialog from './components/ClientEditorDialog.vue';
import ClientsTable from './components/ClientsTable.vue';
import ClientToolbar from './components/ClientToolbar.vue';

defineOptions({ name: 'ClientsView' });

definePage({
  viewKey: 'clients',
  keepAlive: true,
});

type ClientsPageState = {
  filters: {
    q: string;
    type: '' | AuthClientType;
    enabled: '' | 'enabled' | 'disabled';
  };
  page: number;
};

const auth = useAuthStore();
const clients = ref<AuthClientRecord[]>([]);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;

const { state: pageState } = usePageState<ClientsPageState>('page:clients', {
  filters: {
    q: '',
    type: '',
    enabled: '',
  },
  page: 1,
});

const canEdit = computed(() => auth.hasPermission('client.update'));
const canDelete = computed(() => auth.hasPermission('client.delete'));
const enabledCount = computed(() => clients.value.filter((item) => item.enabled).length);
const disabledCount = computed(() => clients.value.filter((item) => !item.enabled).length);
const miniappCount = computed(() => clients.value.filter((item) => item.type === AuthClientType.UNI_WECHAT_MINIAPP).length);

const stats = computed(() => [
  { label: '客户端总数', value: total.value },
  { label: '当前页启用', value: enabledCount.value },
  { label: '当前页禁用', value: disabledCount.value },
  { label: '当前页小程序', value: miniappCount.value },
]);

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  type: pageState.filters.type || undefined,
  enabled: pageState.filters.enabled || undefined,
});

const buildExportRequest = () => api.clients.export(buildFilterParams());

const loadData = async () => {
  try {
    loading.value = true;
    const response = await api.clients.list({
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

    clients.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载客户端列表失败'));
  } finally {
    loading.value = false;
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadData();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.type = '';
  pageState.filters.enabled = '';
  pageState.page = 1;
  await loadData();
};

const {
  dialogVisible,
  editingId,
  form,
  openCreate,
  openEdit,
  save: saveClient,
} = useResourceEditor<AuthClientRecord, ClientEditorForm, AuthClientFormPayload>({
  createEmptyForm: createEmptyClientEditorForm,
  getId: (row) => row.id,
  assignForm: assignClientEditorForm,
  buildPayload: (currentForm) => buildClientPayload(currentForm),
  create: (payload) => api.clients.create(payload),
  update: (id, payload) => api.clients.update(id, payload),
  validate: (currentForm, currentEditingId) => validateClientForm(currentForm, currentEditingId),
  afterSaved: loadData,
  messages: {
    createSuccess: '客户端已创建',
    updateSuccess: '客户端已更新',
    saveError: '保存客户端失败',
  },
});

const {
  detailVisible,
  detail: detailClient,
  openDetail,
} = useResourceDetail<AuthClientRecord, AuthClientRecord>({
  getId: (row) => row.id,
  loadDetail: (id) => api.clients.detail(id),
  errorMessage: '加载客户端详情失败',
});

const { removeRecord: removeClient } = useResourceRemoval<AuthClientRecord>({
  getId: (row) => row.id,
  remove: (id) => api.clients.remove(id),
  confirmTitle: '删除客户端',
  confirmMessage: (row) => `确定删除客户端“${row.name}（${row.code}）”吗？`,
  successMessage: '客户端已删除',
  errorMessage: '删除客户端失败',
  afterRemoved: loadData,
});

const clientContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'summary',
    label: '复制配置摘要',
    onSelect: async (row) => {
      try {
        await navigator.clipboard.writeText(formatClientConfigSummary(row));
        ElMessage.success('配置摘要已复制');
      } catch {
        ElMessage.warning('当前环境不支持复制');
      }
    },
  },
  {
    key: 'divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑客户端',
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除客户端',
    hidden: () => !canDelete.value,
    danger: true,
    onSelect: (row) => removeClient(row),
  },
  {
    key: 'type',
    label: '查看类型',
    onSelect: (row) => {
      ElMessage.info(`客户端类型：${resolveClientTypeLabel(row.type)}`);
    },
  },
  {
    key: 'config',
    label: '查看配置摘要',
    onSelect: (row) => {
      ElMessage.info(formatClientConfigSummary(row));
    },
  },
] satisfies ContextMenuItem<AuthClientRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadData();
};

onMounted(async () => {
  await loadData();
});
</script>
