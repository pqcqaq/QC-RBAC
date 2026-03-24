<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadLogs">刷新日志</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出审计日志失败" />
      </el-space>
    </template>

    <template #toolbar>
      <AuditToolbar
        :filters="pageState.filters"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <AuditTable
      :logs="logs"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :summarize-operations="summarizeOperations"
      @detail="openDetail"
      @page-change="changePage"
    />

    <AuditDetailDrawer
      v-model:visible="drawerVisible"
      :log="selectedLog"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { RequestAuditRecord } from '@rbac/api-common';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import AuditDetailDrawer from './components/AuditDetailDrawer.vue';
import AuditTable from './components/AuditTable.vue';
import AuditToolbar from './components/AuditToolbar.vue';

defineOptions({ name: 'AuditView' });

definePage({
  viewKey: 'audit',
  keepAlive: true,
});

type AuditPageState = {
  filters: {
    q: string;
    method: string;
    model: string;
    operation: string;
    status: string;
  };
  page: number;
};

const logs = ref<RequestAuditRecord[]>([]);
const selectedLog = ref<RequestAuditRecord | null>(null);
const drawerVisible = ref(false);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;

const { state: pageState } = usePageState<AuditPageState>('page:audit', {
  filters: {
    q: '',
    method: '',
    model: '',
    operation: '',
    status: '',
  },
  page: 1,
});

const uniqueActors = computed(() => new Set(logs.value.map((item) => item.actorName)).size);
const failedCount = computed(() => logs.value.filter(item => !item.success).length);
const activeKeyword = computed(() =>
  [
    pageState.filters.q,
    pageState.filters.method,
    pageState.filters.model,
    pageState.filters.operation,
    pageState.filters.status,
  ].filter(Boolean).join(' / ') || '无');
const stats = computed(() => [
  { label: '日志总量', value: total.value },
  { label: '当前页记录', value: logs.value.length },
  { label: '当前页操作者', value: uniqueActors.value },
  { label: '当前页失败', value: failedCount.value },
  { label: '当前过滤', value: activeKeyword.value },
]);

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  method: pageState.filters.method || undefined,
  model: pageState.filters.model || undefined,
  operation: pageState.filters.operation || undefined,
  status: pageState.filters.status || undefined,
});

const buildExportRequest = () => api.audit.export(buildFilterParams());

const summarizeOperations = (operations: RequestAuditRecord['operations']) => {
  if (!operations.length) {
    return '无数据库操作';
  }

  const labels = operations
    .slice(0, 2)
    .map(operation => `${operation.model}.${operation.operation}`);

  return operations.length > 2
    ? `${labels.join(' / ')} 等 ${operations.length} 次`
    : labels.join(' / ');
};

const loadLogs = async () => {
  try {
    loading.value = true;
    const response = await api.audit.list({
      page: pageState.page,
      pageSize,
      ...buildFilterParams(),
    });

    logs.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载审计日志失败'));
  } finally {
    loading.value = false;
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadLogs();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.method = '';
  pageState.filters.model = '';
  pageState.filters.operation = '';
  pageState.filters.status = '';
  pageState.page = 1;
  await loadLogs();
};

const changePage = async (value: number) => {
  pageState.page = value;
  await loadLogs();
};

const openDetail = (row: RequestAuditRecord) => {
  selectedLog.value = row;
  drawerVisible.value = true;
};

onMounted(loadLogs);
</script>
