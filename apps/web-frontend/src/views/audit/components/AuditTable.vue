<template>
  <section class="table-panel surface-card">
    <header class="table-panel__header">
      <div>
        <p class="panel-caption">Trace Records</p>
        <h3 class="panel-heading panel-heading--md">审计流</h3>
      </div>
      <div class="table-panel__meta">
        <span>共 {{ total }} 条记录</span>
        <span>第 {{ page }} 页</span>
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
import type { ActivityLogRecord } from '@rbac/api-common';

defineProps<{
  logs: ActivityLogRecord[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  summarizeDetail: (detail: unknown) => string;
}>();

const emit = defineEmits<{
  detail: [row: ActivityLogRecord];
  'page-change': [value: number];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
</script>
