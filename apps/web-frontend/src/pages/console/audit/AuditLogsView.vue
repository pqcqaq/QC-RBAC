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
      :summarize-detail="summarizeDetail"
      @detail="openDetail"
      @page-change="changePage"
    />

    <AuditDetailDrawer
      v-model:visible="drawerVisible"
      :log="selectedLog"
      :summarize-detail="summarizeDetail"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { ActivityLogRecord } from '@rbac/api-common';
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
    action: string;
  };
  page: number;
};

const logs = ref<ActivityLogRecord[]>([]);
const selectedLog = ref<ActivityLogRecord | null>(null);
const drawerVisible = ref(false);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;

const { state: pageState } = usePageState<AuditPageState>('page:audit', {
  filters: {
    q: '',
    action: '',
  },
  page: 1,
});

const uniqueActors = computed(() => new Set(logs.value.map((item) => item.actorName)).size);
const activeKeyword = computed(() => pageState.filters.q || pageState.filters.action || '无');
const stats = computed(() => [
  { label: '日志总量', value: total.value },
  { label: '当前页记录', value: logs.value.length },
  { label: '当前页操作者', value: uniqueActors.value },
  { label: '当前过滤', value: activeKeyword.value },
]);

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  action: pageState.filters.action || undefined,
});

const buildExportRequest = () => api.audit.export(buildFilterParams());

const summarizeDetail = (detail: unknown) => {
  if (!detail || typeof detail !== 'object') {
    return '无';
  }

  const keys = Object.keys(detail as Record<string, unknown>);
  return keys.length ? `${keys.length} 个字段` : '空对象';
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
  pageState.filters.action = '';
  pageState.page = 1;
  await loadLogs();
};

const changePage = async (value: number) => {
  pageState.page = value;
  await loadLogs();
};

const openDetail = (row: ActivityLogRecord) => {
  selectedLog.value = row;
  drawerVisible.value = true;
};

onMounted(loadLogs);
</script>
