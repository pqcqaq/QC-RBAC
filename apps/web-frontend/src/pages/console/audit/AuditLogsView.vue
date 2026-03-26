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
        :loading="loading"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <div class="audit-workbench">
      <AuditTable
        :logs="logs"
        :loading="loading"
        :total="total"
        :page="pageState.page"
        :page-size="pageSize"
        :selected-id="selectedLog?.id ?? null"
        @detail="openDetail"
        @page-change="changePage"
        @select="selectLog"
      />

      <AuditWorkbenchSidebar
        :log="selectedLog"
        :page-signals="pageSignals"
        :hot-models="hotModels"
        @detail="openDetail"
      />
    </div>

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
import type { AuditFilters, AuditSignalItem } from './audit-display';
import {
  compareRequestAuditRecency,
  formatAuditDuration,
  getActiveAuditFilterTokens,
} from './audit-display';
import AuditDetailDrawer from './components/AuditDetailDrawer.vue';
import AuditTable from './components/AuditTable.vue';
import AuditToolbar from './components/AuditToolbar.vue';
import AuditWorkbenchSidebar from './components/AuditWorkbenchSidebar.vue';

defineOptions({ name: 'AuditView' });

definePage({
  viewKey: 'audit',
  keepAlive: true,
});

type AuditPageState = {
  filters: AuditFilters;
  page: number;
};

const logs = ref<RequestAuditRecord[]>([]);
const selectedLogId = ref<string | null>(null);
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

const selectedLog = computed(() =>
  logs.value.find(item => item.id === selectedLogId.value)
  ?? logs.value[0]
  ?? null);
const failedCount = computed(() => logs.value.filter(item => !item.success).length);
const readOnlyCount = computed(() => logs.value.filter(item => item.writeCount === 0).length);
const writeRequestCount = computed(() => logs.value.filter(item => item.writeCount > 0).length);
const rolledBackRequestCount = computed(() =>
  logs.value.filter(item => item.operations.some(operation =>
    operation.effectKind === 'WRITE' && !operation.committed,
  )).length);
const pageOperationTotal = computed(() =>
  logs.value.reduce((sum, item) => sum + item.operationCount, 0));
const pageWriteOperationTotal = computed(() =>
  logs.value.reduce((sum, item) => sum + item.writeCount, 0));
const averageDurationMs = computed(() =>
  logs.value.length
    ? Math.round(logs.value.reduce((sum, item) => sum + item.durationMs, 0) / logs.value.length)
    : 0);
const hotModels = computed(() => {
  const counts = new Map<string, number>();

  logs.value.forEach((item) => {
    item.operations.forEach((operation) => {
      counts.set(operation.model, (counts.get(operation.model) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([model, count]) => ({ model, count }));
});
const activeKeyword = computed(() => {
  const filters = getActiveAuditFilterTokens(pageState.filters);
  return filters.length
    ? filters.map(item => `${item.label}:${item.value}`).join(' / ')
    : '全部请求';
});
const stats = computed(() => [
  { label: '请求总量', value: total.value },
  { label: '当前页操作', value: pageOperationTotal.value },
  { label: '写入请求', value: writeRequestCount.value },
  { label: '平均耗时', value: formatAuditDuration(averageDurationMs.value) },
  { label: '当前过滤', value: activeKeyword.value },
]);
const pageSignals = computed<AuditSignalItem[]>(() => [
  {
    label: '失败请求',
    value: failedCount.value,
    tone: failedCount.value ? 'danger' : 'neutral',
  },
  {
    label: '回滚请求',
    value: rolledBackRequestCount.value,
    tone: rolledBackRequestCount.value ? 'danger' : 'neutral',
  },
  {
    label: '只读请求',
    value: readOnlyCount.value,
    tone: 'neutral',
  },
  {
    label: '写入密度',
    value: `${pageOperationTotal.value
      ? Math.round((pageWriteOperationTotal.value / pageOperationTotal.value) * 100)
      : 0}%`,
    tone: 'accent',
  },
]);

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  method: pageState.filters.method || undefined,
  model: pageState.filters.model || undefined,
  operation: pageState.filters.operation || undefined,
  status: pageState.filters.status || undefined,
});

const buildExportRequest = () => api.audit.export(buildFilterParams());

const syncSelectedLog = () => {
  if (!logs.value.length) {
    selectedLogId.value = null;
    return;
  }

  const keepSelected = selectedLogId.value
    && logs.value.some(item => item.id === selectedLogId.value);

  if (!keepSelected) {
    selectedLogId.value = logs.value[0]?.id ?? null;
  }
};

const loadLogs = async () => {
  try {
    loading.value = true;
    const response = await api.audit.list({
      page: pageState.page,
      pageSize,
      ...buildFilterParams(),
    });

    logs.value = [...response.items].sort(compareRequestAuditRecency);
    total.value = response.meta.total;
    syncSelectedLog();
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

const selectLog = (row: RequestAuditRecord) => {
  selectedLogId.value = row.id;
};

const openDetail = (row: RequestAuditRecord) => {
  selectedLogId.value = row.id;
  drawerVisible.value = true;
};

onMounted(loadLogs);
</script>

<style scoped lang="scss">
.audit-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.95fr);
  gap: 14px;
  align-items: start;
}

@media (max-width: 1180px) {
  .audit-workbench {
    grid-template-columns: 1fr;
  }
}
</style>
