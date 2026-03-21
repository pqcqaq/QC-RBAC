<template>
  <section class="table-panel surface-card">
    <header class="table-panel__header">
      <div>
        <p class="panel-caption">Member Directory</p>
        <h3 class="panel-heading panel-heading--md">用户清单</h3>
      </div>
      <div class="table-panel__meta">
        <span>支持行右键快捷操作</span>
        <span>共 {{ total }} 条记录</span>
        <span>当前第 {{ page }} 页</span>
      </div>
    </header>

    <ContextMenuHost :items="contextMenuSourceItems" manual>
      <template #default="{ open }">
        <el-table
          :data="users"
          class="table-context-menu"
          stripe
          v-loading="loading"
          @row-contextmenu="(row, _column, event) => open(event, row)"
        >
          <el-table-column label="成员" min-width="240">
            <template #default="{ row }">
              <div class="table-user">
                <div v-if="row.avatar" class="table-user__avatar table-user__avatar--image">
                  <img :src="row.avatar" :alt="row.nickname" />
                </div>
                <div v-else class="table-user__avatar">
                  {{ row.nickname.slice(0, 1).toUpperCase() }}
                </div>
                <div class="table-user__meta">
                  <strong>{{ row.nickname }}</strong>
                  <span>{{ row.email || '未设置邮箱' }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="username" label="用户名" min-width="140" />

          <el-table-column label="角色" min-width="260">
            <template #default="{ row }">
              <div class="detail-chip-list">
                <span v-for="role in row.roles" :key="role.id" class="role-pill">{{ role.name }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" effect="light" round>
                {{ row.status === 'ACTIVE' ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="更新时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.updatedAt) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="290" fixed="right">
            <template #default="{ row }">
              <el-space>
                <el-button link @click="emit('detail', row)">详情</el-button>
                <el-button v-permission="'rbac.explorer'" link @click="emit('permission-source', row.id)">权限来源</el-button>
                <el-button v-permission="'user.update'" link @click="emit('edit', row)">编辑</el-button>
                <el-button v-permission="'user.delete'" link type="danger" @click="emit('delete', row)">删除</el-button>
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
import type { UserRecord } from '@rbac/api-common';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import type { ContextMenuItem } from '@/components/common/context-menu';

type HostContextMenuItem = ContextMenuItem<never>;

const props = defineProps<{
  users: UserRecord[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  contextMenuItems: ContextMenuItem<UserRecord>[];
}>();

const emit = defineEmits<{
  detail: [row: UserRecord];
  'permission-source': [id: string];
  edit: [row: UserRecord];
  delete: [row: UserRecord];
  'page-change': [value: number];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
const contextMenuSourceItems = computed(() => props.contextMenuItems as unknown as HostContextMenuItem[]);
</script>
