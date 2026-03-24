<template>
  <section class="table-panel surface-card">
    <header class="table-panel__header">
      <div>
        <p class="panel-caption">审计记录</p>
        <h3 class="panel-heading panel-heading--md">审计记录</h3>
      </div>
      <div class="table-panel__meta">
        <span>共 {{ total }} 条记录</span>
        <span>第 {{ page }} 页</span>
      </div>
    </header>

    <el-table :data="logs" stripe v-loading="loading">
      <el-table-column prop="actorName" label="操作者" width="180" />
      <el-table-column label="请求" min-width="280">
        <template #default="{ row }">
          <div>
            <strong>{{ row.method }}</strong>
            <div class="muted">{{ row.path }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="结果" width="120">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" round>
            {{ row.statusCode }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="数据库操作" min-width="220">
        <template #default="{ row }">
          {{ summarizeOperations(row.operations) }}
        </template>
      </el-table-column>
      <el-table-column label="耗时" width="100">
        <template #default="{ row }">
          {{ row.durationMs }}ms
        </template>
      </el-table-column>
      <el-table-column label="时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.startedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="详情" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link @click="emit('detail', row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      background
      layout="prev, pager, next, total"
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      @current-change="(value) => emit('page-change', value)"
    />
  </section>
</template>

<script setup lang="ts">
import type { RequestAuditRecord } from '@rbac/api-common';

defineProps<{
  logs: RequestAuditRecord[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  summarizeOperations: (operations: RequestAuditRecord['operations']) => string;
}>();

const emit = defineEmits<{
  detail: [row: RequestAuditRecord];
  'page-change': [value: number];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
</script>

