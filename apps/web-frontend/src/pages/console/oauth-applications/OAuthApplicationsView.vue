<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadData">刷新</el-button>
        <el-button
          v-permission="'oauth-application.create'"
          type="primary"
          @click="handleOpenCreate"
        >
          新增应用
        </el-button>
      </el-space>
    </template>

    <template #toolbar>
      <OAuthApplicationToolbar
        :filters="pageState.filters"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <OAuthApplicationsTable
      :applications="pagedApplications"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :confidential-count="confidentialCount"
      :context-menu-items="applicationContextMenuItems"
      @detail="openDetail"
      @edit="handleOpenEdit"
      @delete="removeApplication"
      @page-change="changePage"
    />

    <OAuthApplicationEditorDialog
      v-model:visible="dialogVisible"
      :title="editingId ? '编辑 OAuth 应用' : '新增 OAuth 应用'"
      :is-editing="Boolean(editingId)"
      :form="form"
      @save="saveApplication"
    />

    <OAuthApplicationDetailDrawer
      v-model:visible="detailVisible"
      :application="detailApplication"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { OAuthApplicationFormPayload, OAuthApplicationRecord } from '@rbac/api-common';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import {
  useResourceDetail,
  useResourceEditor,
  useResourceRemoval,
} from '@/composables/use-resource-crud';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { formatTime } from '../oauth/oauth-management';
import OAuthApplicationDetailDrawer from './components/OAuthApplicationDetailDrawer.vue';
import OAuthApplicationEditorDialog from './components/OAuthApplicationEditorDialog.vue';
import OAuthApplicationsTable from './components/OAuthApplicationsTable.vue';
import OAuthApplicationToolbar from './components/OAuthApplicationToolbar.vue';
import {
  assignOAuthApplicationEditorForm,
  buildOAuthApplicationPayload,
  createEmptyOAuthApplicationEditorForm,
  formatOAuthApplicationPermissionSummary,
  formatOAuthApplicationScopeSummary,
  resolveOAuthApplicationClientTypeLabel,
  type OAuthApplicationEditorForm,
  validateOAuthApplicationForm,
} from './application-management';

defineOptions({ name: 'OAuthApplicationsView' });

definePage({
  viewKey: 'oauthApplications',
  keepAlive: true,
});

type OAuthApplicationsPageState = {
  filters: {
    q: string;
    enabled: '' | 'enabled' | 'disabled';
  };
  page: number;
};

const auth = useAuthStore();
const applications = ref<OAuthApplicationRecord[]>([]);
const loading = ref(false);
const pageSize = 10;

const { state: pageState } = usePageState<OAuthApplicationsPageState>('page:oauth-applications', {
  filters: {
    q: '',
    enabled: '',
  },
  page: 1,
});

const total = computed(() => applications.value.length);
const totalPages = computed(() => Math.max(Math.ceil(total.value / pageSize), 1));
const pagedApplications = computed(() => {
  const start = (pageState.page - 1) * pageSize;
  return applications.value.slice(start, start + pageSize);
});
const enabledCount = computed(() => applications.value.filter((item) => item.enabled).length);
const confidentialCount = computed(
  () => applications.value.filter((item) => item.clientType === 'CONFIDENTIAL').length,
);
const permissionScopeCount = computed(() =>
  applications.value.reduce((count, item) => count + item.permissions.length, 0),
);

const stats = computed(() => [
  { label: '应用总数', value: total.value },
  { label: '启用应用', value: enabledCount.value },
  { label: 'Confidential', value: confidentialCount.value },
  { label: '权限 Scope 数', value: permissionScopeCount.value },
]);

const loadData = async () => {
  try {
    loading.value = true;
    applications.value = await api.oauth.applications.list({
      q: pageState.filters.q || undefined,
      enabled: pageState.filters.enabled || undefined,
    });

    if (pageState.page > totalPages.value) {
      pageState.page = totalPages.value;
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载 OAuth 应用失败'));
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
  save: saveApplication,
} = useResourceEditor<
  OAuthApplicationRecord,
  OAuthApplicationEditorForm,
  OAuthApplicationFormPayload
>({
  createEmptyForm: createEmptyOAuthApplicationEditorForm,
  getId: (row) => row.id,
  assignForm: assignOAuthApplicationEditorForm,
  buildPayload: (currentForm) => buildOAuthApplicationPayload(currentForm),
  create: (payload) => api.oauth.applications.create(payload),
  update: (id, payload) => api.oauth.applications.update(id, payload),
  validate: (currentForm, currentEditingId) =>
    validateOAuthApplicationForm(currentForm, currentEditingId),
  afterSaved: loadData,
  messages: {
    createSuccess: 'OAuth 应用已创建',
    updateSuccess: 'OAuth 应用已更新',
    saveError: '保存 OAuth 应用失败',
  },
});

const {
  detailVisible,
  detail: detailApplication,
  openDetail,
} = useResourceDetail<OAuthApplicationRecord, OAuthApplicationRecord>({
  getId: (row) => row.id,
  loadDetail: (id) => api.oauth.applications.detail(id),
  errorMessage: '加载 OAuth 应用详情失败',
});

const { removeRecord: removeApplication } = useResourceRemoval<OAuthApplicationRecord>({
  getId: (row) => row.id,
  remove: (id) => api.oauth.applications.remove(id),
  confirmTitle: '删除 OAuth 应用',
  confirmMessage: (row) => `确定删除应用“${row.name}（${row.code}）”吗？`,
  successMessage: 'OAuth 应用已删除',
  errorMessage: '删除 OAuth 应用失败',
  afterRemoved: loadData,
});

const handleOpenCreate = async () => {
  openCreate();
};

const handleOpenEdit = async (row: OAuthApplicationRecord) => {
  openEdit(row);
};

const copyApplicationSummary = async (row: OAuthApplicationRecord) => {
  try {
    await navigator.clipboard.writeText(
      [
        row.name,
        row.clientId,
        formatOAuthApplicationScopeSummary(row),
        formatOAuthApplicationPermissionSummary(row),
      ].join('\n'),
    );
    ElMessage.success('摘要已复制');
  } catch {
    ElMessage.warning('当前环境不支持复制');
  }
};

const applicationContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'copy',
    label: '复制摘要',
    onSelect: (row) => {
      void copyApplicationSummary(row);
    },
  },
  {
    key: 'permissions',
    label: '查看权限 Scope',
    onSelect: (row) => {
      ElMessage.info(formatOAuthApplicationPermissionSummary(row));
    },
  },
  {
    key: 'divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑应用',
    hidden: () => !auth.hasPermission('oauth-application.update'),
    onSelect: (row) => {
      void handleOpenEdit(row);
    },
  },
  {
    key: 'delete',
    label: '删除应用',
    hidden: () => !auth.hasPermission('oauth-application.delete'),
    danger: true,
    onSelect: (row) => removeApplication(row),
  },
  {
    key: 'timestamp',
    label: '查看更新时间',
    onSelect: (row) => {
      ElMessage.info(`最近更新时间：${formatTime(row.updatedAt)}`);
    },
  },
] satisfies ContextMenuItem<OAuthApplicationRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
};

onMounted(async () => {
  await loadData();
});
</script>
