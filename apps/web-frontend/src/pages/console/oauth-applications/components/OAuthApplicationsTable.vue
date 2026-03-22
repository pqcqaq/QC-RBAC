<template>
  <section class="table-panel surface-card">
    <header class="table-panel__header">
      <div>
        <p class="panel-caption">OAuth Applications</p>
        <h3 class="panel-heading panel-heading--md">应用目录</h3>
      </div>
      <div class="table-panel__meta">
        <span>支持右键快捷操作</span>
        <span>共 {{ total }} 个应用</span>
        <span>第 {{ page }} 页</span>
        <span>Confidential {{ confidentialCount }} 个</span>
      </div>
    </header>

    <ContextMenuHost :items="contextMenuSourceItems" manual>
      <template #default="{ open }">
        <el-table
          :data="applications"
          row-key="id"
          class="table-context-menu"
          stripe
          v-loading="loading"
          empty-text="暂无 OAuth 应用"
          @row-contextmenu="(row, _column, event) => open(event, row)"
        >
          <el-table-column label="应用" min-width="240">
            <template #default="{ row }">
              <div class="table-identity">
                <div v-if="row.logoUrl" class="table-identity__logo table-identity__logo--image">
                  <img :src="row.logoUrl" :alt="row.name" />
                </div>
                <div v-else class="table-identity__logo">
                  {{ row.name.slice(0, 1).toUpperCase() }}
                </div>
                <div class="table-stack">
                  <strong>{{ row.name }}</strong>
                  <span>{{ row.code }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="clientId" label="Client ID" min-width="220" />

          <el-table-column label="类型" width="140">
            <template #default="{ row }">
              <el-tag effect="light" round>
                {{ resolveOAuthApplicationClientTypeLabel(row.clientType) }}
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

          <el-table-column label="权限 Scope" min-width="220">
            <template #default="{ row }">
              {{ formatOAuthApplicationPermissionSummary(row) }}
            </template>
          </el-table-column>

          <el-table-column label="回调数" width="120">
            <template #default="{ row }">
              {{ row.redirectUris.length }}
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
                <el-button v-permission="'oauth-application.update'" link @click="emit('edit', row)">编辑</el-button>
                <el-button v-permission="'oauth-application.delete'" link type="danger" @click="emit('delete', row)">
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
import type { OAuthApplicationRecord } from '@rbac/api-common';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import type { ContextMenuItem } from '@/components/common/context-menu';
import { formatTime } from '../../oauth/oauth-management';
import {
  formatOAuthApplicationPermissionSummary,
  resolveOAuthApplicationClientTypeLabel,
} from '../application-management';

type HostContextMenuItem = ContextMenuItem<never>;

const props = defineProps<{
  applications: OAuthApplicationRecord[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  confidentialCount: number;
  contextMenuItems: ContextMenuItem<OAuthApplicationRecord>[];
}>();

const emit = defineEmits<{
  detail: [row: OAuthApplicationRecord];
  edit: [row: OAuthApplicationRecord];
  delete: [row: OAuthApplicationRecord];
  'page-change': [value: number];
}>();

const contextMenuSourceItems = computed(() => props.contextMenuItems as unknown as HostContextMenuItem[]);
</script>

<style scoped>
.table-identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-identity__logo {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #f3f4f6;
  color: #1f2937;
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
}

.table-identity__logo--image {
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.table-identity__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
