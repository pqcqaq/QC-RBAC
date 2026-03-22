<template>
  <section class="table-panel surface-card">
    <header class="table-panel__header">
      <div>
        <p class="panel-caption">Clients</p>
        <h3 class="panel-heading panel-heading--md">客户端目录</h3>
      </div>
      <div class="table-panel__meta">
        <span>共 {{ total }} 个客户端</span>
        <span>第 {{ page }} 页</span>
        <span>启用 {{ enabledCount }} 个</span>
        <span>禁用 {{ disabledCount }} 个</span>
      </div>
    </header>

    <ContextMenuHost :items="contextMenuSourceItems" manual>
      <template #default="{ open }">
        <el-table
          :data="clients"
          class="table-context-menu"
          stripe
          v-loading="loading"
          @row-contextmenu="(row, _column, event) => open(event, row)"
        >
          <el-table-column prop="code" label="编码" min-width="200" />
          <el-table-column prop="name" label="名称" min-width="180" />
          <el-table-column label="类型" width="140">
            <template #default="{ row }">
              <el-tag effect="light" round>
                {{ resolveClientTypeLabel(row.type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'" effect="light" round>
                {{ row.enabled ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="配置摘要" min-width="260">
            <template #default="{ row }">
              {{ formatClientConfigSummary(row) }}
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.updatedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-space>
                <el-button link @click="emit('detail', row)">详情</el-button>
                <el-button v-permission="'client.update'" link @click="emit('edit', row)">编辑</el-button>
                <el-button
                  v-permission="'client.delete'"
                  link
                  type="danger"
                  @click="emit('delete', row)"
                >
                  删除
                </el-button>
              </el-space>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </ContextMenuHost>

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
import { computed } from 'vue';
import type { AuthClientRecord } from '@rbac/api-common';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import type { ContextMenuItem } from '@/components/common/context-menu';
import { formatClientConfigSummary, resolveClientTypeLabel } from '../client-management';

type HostContextMenuItem = ContextMenuItem<never>;

const props = defineProps<{
  clients: AuthClientRecord[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  enabledCount: number;
  disabledCount: number;
  contextMenuItems: ContextMenuItem<AuthClientRecord>[];
}>();

const emit = defineEmits<{
  detail: [row: AuthClientRecord];
  edit: [row: AuthClientRecord];
  delete: [row: AuthClientRecord];
  'page-change': [value: number];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
const contextMenuSourceItems = computed(() => props.contextMenuItems as unknown as HostContextMenuItem[]);
</script>
