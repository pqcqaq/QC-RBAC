<template>
  <section class="table-panel surface-card">
    <header class="table-panel__header">
      <div>
        <p class="panel-caption">Capability Ledger</p>
        <h3 class="panel-heading panel-heading--md">权限目录</h3>
      </div>
      <div class="table-panel__meta">
        <span>支持行右键快捷操作</span>
        <span>共 {{ total }} 项能力</span>
        <span>第 {{ page }} 页</span>
        <span>当前页 {{ seedCount }} 项系统种子</span>
      </div>
    </header>

    <ContextMenuHost :items="contextMenuSourceItems" manual>
      <template #default="{ open }">
        <el-table
          :data="permissions"
          class="table-context-menu"
          stripe
          v-loading="loading"
          @row-contextmenu="(row, _column, event) => open(event, row)"
        >
          <el-table-column prop="code" label="权限码" min-width="220" />
          <el-table-column prop="name" label="名称" min-width="160" />
          <el-table-column prop="module" label="模块" width="140" />
          <el-table-column prop="action" label="动作" width="120" />
          <el-table-column label="来源" width="120">
            <template #default="{ row }">
              <el-tag :type="isSeedPermission(row.code) ? 'warning' : 'info'" effect="light" round>
                {{ isSeedPermission(row.code) ? '系统种子' : '自定义' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="240" />
          <el-table-column label="更新时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.updatedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-space>
                <el-button link @click="emit('detail', row)">详情</el-button>
                <el-button v-permission="'permission.update'" link @click="emit('edit', row)">编辑</el-button>
                <el-button
                  v-if="!isSeedPermission(row.code)"
                  v-permission="'permission.delete'"
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
import type { PermissionRecord } from '@rbac/api-common';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import type { ContextMenuItem } from '@/components/common/context-menu';

type HostContextMenuItem = ContextMenuItem<never>;

const props = defineProps<{
  permissions: PermissionRecord[];
  loading: boolean;
  seedCount: number;
  total: number;
  page: number;
  pageSize: number;
  contextMenuItems: ContextMenuItem<PermissionRecord>[];
  isSeedPermission: (code: string) => boolean;
}>();

const emit = defineEmits<{
  detail: [row: PermissionRecord];
  edit: [row: PermissionRecord];
  delete: [row: PermissionRecord];
  'page-change': [value: number];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
const contextMenuSourceItems = computed(() => props.contextMenuItems as unknown as HostContextMenuItem[]);
</script>
