<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadData">刷新</el-button>
        <el-button v-permission="'oauth-provider.create'" type="primary" @click="openCreate">
          新增供应商
        </el-button>
      </el-space>
    </template>

    <template #toolbar>
      <OAuthProviderToolbar
        :filters="pageState.filters"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <OAuthProvidersTable
      :providers="pagedProviders"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :login-enabled-count="loginEnabledCount"
      :context-menu-items="providerContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removeProvider"
      @page-change="changePage"
    />

    <OAuthProviderEditorDialog
      v-model:visible="dialogVisible"
      :title="editingId ? '编辑 OAuth 供应商' : '新增 OAuth 供应商'"
      :is-editing="Boolean(editingId)"
      :form="form"
      @save="saveProvider"
    />

    <OAuthProviderDetailDrawer
      v-model:visible="detailVisible"
      :provider="detailProvider"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { OAuthProviderFormPayload, OAuthProviderRecord } from '@rbac/api-common';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import { useResourceDetail, useResourceEditor, useResourceRemoval } from '@/composables/use-resource-crud';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { formatTime } from '../oauth/oauth-management';
import OAuthProviderDetailDrawer from './components/OAuthProviderDetailDrawer.vue';
import OAuthProviderEditorDialog from './components/OAuthProviderEditorDialog.vue';
import OAuthProvidersTable from './components/OAuthProvidersTable.vue';
import OAuthProviderToolbar from './components/OAuthProviderToolbar.vue';
import {
  assignOAuthProviderEditorForm,
  buildOAuthProviderPayload,
  createEmptyOAuthProviderEditorForm,
  formatOAuthProviderEndpointSummary,
  formatOAuthProviderScopeSummary,
  resolveOAuthProviderProtocolLabel,
  type OAuthProviderEditorForm,
  validateOAuthProviderForm,
} from './provider-management';

defineOptions({ name: 'OAuthProvidersView' });

definePage({
  viewKey: 'oauthProviders',
  keepAlive: true,
});

type OAuthProvidersPageState = {
  filters: {
    q: string;
    enabled: '' | 'enabled' | 'disabled';
  };
  page: number;
};

const auth = useAuthStore();
const providers = ref<OAuthProviderRecord[]>([]);
const loading = ref(false);
const pageSize = 10;

const { state: pageState } = usePageState<OAuthProvidersPageState>('page:oauth-providers', {
  filters: {
    q: '',
    enabled: '',
  },
  page: 1,
});

const total = computed(() => providers.value.length);
const totalPages = computed(() => Math.max(Math.ceil(total.value / pageSize), 1));
const pagedProviders = computed(() => {
  const start = (pageState.page - 1) * pageSize;
  return providers.value.slice(start, start + pageSize);
});
const enabledCount = computed(() => providers.value.filter((item) => item.enabled).length);
const loginEnabledCount = computed(() => providers.value.filter((item) => item.enabled && item.allowLogin).length);
const oidcCount = computed(() => providers.value.filter((item) => item.protocol === 'OIDC').length);

const stats = computed(() => [
  { label: '供应商总数', value: total.value },
  { label: '启用供应商', value: enabledCount.value },
  { label: '允许登录', value: loginEnabledCount.value },
  { label: 'OIDC 协议', value: oidcCount.value },
]);

const loadData = async () => {
  try {
    loading.value = true;
    providers.value = await api.oauth.providers.list({
      q: pageState.filters.q || undefined,
      enabled: pageState.filters.enabled || undefined,
    });

    if (pageState.page > totalPages.value) {
      pageState.page = totalPages.value;
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载 OAuth 供应商失败'));
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
  save: saveProvider,
} = useResourceEditor<OAuthProviderRecord, OAuthProviderEditorForm, OAuthProviderFormPayload>({
  createEmptyForm: createEmptyOAuthProviderEditorForm,
  getId: (row) => row.id,
  assignForm: assignOAuthProviderEditorForm,
  buildPayload: (currentForm) => buildOAuthProviderPayload(currentForm),
  create: (payload) => api.oauth.providers.create(payload),
  update: (id, payload) => api.oauth.providers.update(id, payload),
  validate: (currentForm, currentEditingId) => validateOAuthProviderForm(currentForm, currentEditingId),
  afterSaved: loadData,
  messages: {
    createSuccess: 'OAuth 供应商已创建',
    updateSuccess: 'OAuth 供应商已更新',
    saveError: '保存 OAuth 供应商失败',
  },
});

const {
  detailVisible,
  detail: detailProvider,
  openDetail,
} = useResourceDetail<OAuthProviderRecord, OAuthProviderRecord>({
  getId: (row) => row.id,
  loadDetail: (id) => api.oauth.providers.detail(id),
  errorMessage: '加载 OAuth 供应商详情失败',
});

const { removeRecord: removeProvider } = useResourceRemoval<OAuthProviderRecord>({
  getId: (row) => row.id,
  remove: (id) => api.oauth.providers.remove(id),
  confirmTitle: '删除 OAuth 供应商',
  confirmMessage: (row) => `确定删除供应商“${row.name}（${row.code}）”吗？`,
  successMessage: 'OAuth 供应商已删除',
  errorMessage: '删除 OAuth 供应商失败',
  afterRemoved: loadData,
});

const copyProviderSummary = async (row: OAuthProviderRecord) => {
  try {
    await navigator.clipboard.writeText(`${row.name}\n${formatOAuthProviderEndpointSummary(row)}\n${formatOAuthProviderScopeSummary(row)}`);
    ElMessage.success('摘要已复制');
  } catch {
    ElMessage.warning('当前环境不支持复制');
  }
};

const providerContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'copy',
    label: '复制摘要',
    onSelect: (row) => {
      void copyProviderSummary(row);
    },
  },
  {
    key: 'protocol',
    label: '查看协议',
    onSelect: (row) => {
      ElMessage.info(`协议：${resolveOAuthProviderProtocolLabel(row.protocol)}`);
    },
  },
  {
    key: 'divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑供应商',
    hidden: () => !auth.hasPermission('oauth-provider.update'),
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除供应商',
    hidden: () => !auth.hasPermission('oauth-provider.delete'),
    danger: true,
    onSelect: (row) => removeProvider(row),
  },
  {
    key: 'timestamp',
    label: '查看更新时间',
    onSelect: (row) => {
      ElMessage.info(`最近更新时间：${formatTime(row.updatedAt)}`);
    },
  },
] satisfies ContextMenuItem<OAuthProviderRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
};

onMounted(async () => {
  await loadData();
});
</script>
