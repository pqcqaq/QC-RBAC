<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-button @click="loadLogs">刷新日志</el-button>
    </template>

    <template #toolbar>
      <el-form label-position="top" class="page-toolbar">
        <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
          <el-input
            v-model="pageState.filters.q"
            clearable
            placeholder="操作者 / 动作 / 目标"
            @keyup.enter="applyFilters"
          />
        </el-form-item>

        <el-form-item label="动作" class="page-toolbar__field">
          <el-input
            v-model="pageState.filters.action"
            clearable
            placeholder="如 user.update"
            @keyup.enter="applyFilters"
          />
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
          <p class="panel-caption">Trace Records</p>
          <h3 class="panel-heading panel-heading--md">审计流</h3>
        </div>
        <div class="table-panel__meta">
          <span>共 {{ total }} 条记录</span>
          <span>第 {{ pageState.page }} 页</span>
        </div>
      </header>

      <el-table :data="logs" stripe v-loading="loading">
        <el-table-column prop="actorName" label="操作者" width="180" />
        <el-table-column prop="action" label="动作" min-width="180" />
        <el-table-column prop="target" label="目标" min-width="220" />
        <el-table-column label="上下文" width="120">
          <template #default="{ row }">
            {{ summarizeDetail(row.detail) }}
          </template>
        </el-table-column>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="详情" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link @click="openDetail(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        background
        layout="prev, pager, next, total"
        :current-page="pageState.page"
        :page-size="pageSize"
        :total="total"
        @current-change="changePage"
      />
    </section>

    <el-drawer v-model="drawerVisible" :title="selectedLog ? `${selectedLog.action} · 审计详情` : '审计详情'" size="42%">
      <div v-if="selectedLog" class="detail-stack">
        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Event</p>
              <h3 class="panel-heading panel-heading--md">{{ selectedLog.action }}</h3>
            </div>
            <el-tag type="info" round>{{ formatTime(selectedLog.createdAt) }}</el-tag>
          </div>

          <div class="detail-kv-grid">
            <div class="detail-kv">
              <span>操作者</span>
              <strong>{{ selectedLog.actorName }}</strong>
            </div>
            <div class="detail-kv">
              <span>目标</span>
              <strong>{{ selectedLog.target }}</strong>
            </div>
            <div class="detail-kv detail-kv--full">
              <span>上下文摘要</span>
              <strong>{{ summarizeDetail(selectedLog.detail) }}</strong>
            </div>
          </div>
        </section>

        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Payload</p>
              <h3 class="panel-heading panel-heading--md">事件载荷</h3>
            </div>
          </div>
          <pre class="audit-json">{{ detailJson }}</pre>
        </section>
      </div>
    </el-drawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { ActivityLogRecord } from '@rbac/api-common';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';

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

const detailJson = computed(() => JSON.stringify(selectedLog.value?.detail ?? {}, null, 2));
const uniqueActors = computed(() => new Set(logs.value.map((item) => item.actorName)).size);
const activeKeyword = computed(() => pageState.filters.q || pageState.filters.action || '无');
const stats = computed(() => [
  { label: '日志总量', value: total.value },
  { label: '当前页记录', value: logs.value.length },
  { label: '当前页操作者', value: uniqueActors.value },
  { label: '当前过滤', value: activeKeyword.value },
]);

const formatTime = (value: string) => new Date(value).toLocaleString();

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
      q: pageState.filters.q || undefined,
      action: pageState.filters.action || undefined,
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
