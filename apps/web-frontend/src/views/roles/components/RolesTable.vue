<template>
  <section class="table-panel surface-card">
    <header class="table-panel__header">
      <div>
        <p class="panel-caption">Role Matrix</p>
        <h3 class="panel-heading panel-heading--md">角色矩阵</h3>
      </div>
      <div class="table-panel__meta">
        <span>支持行右键快捷操作</span>
        <span>共 {{ roles.length }} 个角色</span>
        <span>{{ roles.filter((item) => item.isSystem).length }} 个系统角色</span>
      </div>
    </header>

    <ContextMenuHost :items="contextMenuSourceItems" manual>
      <template #default="{ open }">
        <el-table
          :data="roles"
          class="table-context-menu"
          stripe
          v-loading="loading"
          @row-contextmenu="(row, _column, event) => open(event, row)"
        >
          <el-table-column label="角色" min-width="240">
            <template #default="{ row }">
              <div class="table-stack">
                <strong>{{ row.name }}</strong>
                <span>{{ row.code }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="description" label="描述" min-width="240" />

          <el-table-column label="权限数" width="120">
            <template #default="{ row }">
              {{ row.permissionCount }}
            </template>
          </el-table-column>

          <el-table-column label="成员数" width="120">
            <template #default="{ row }">
              {{ row.userCount }}
            </template>
          </el-table-column>

          <el-table-column label="类型" width="120">
            <template #default="{ row }">
              <el-tag :type="row.isSystem ? 'warning' : 'info'" effect="light" round>
                {{ row.isSystem ? '系统角色' : '自定义' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="更新时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.updatedAt) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <el-space>
                <el-button link @click="emit('detail', row)">详情</el-button>
                <el-button link :disabled="!canEdit" @click="emit('edit', row)">编辑</el-button>
                <el-button link type="danger" :disabled="!canDelete || row.isSystem" @click="emit('delete', row)">
                  删除
                </el-button>
              </el-space>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </ContextMenuHost>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RoleRecord } from '@rbac/api-common';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import type { ContextMenuItem } from '@/components/common/context-menu';

type HostContextMenuItem = ContextMenuItem<never>;

const props = defineProps<{
  roles: RoleRecord[];
  loading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  contextMenuItems: ContextMenuItem<RoleRecord>[];
}>();

const emit = defineEmits<{
  detail: [row: RoleRecord];
  edit: [row: RoleRecord];
  delete: [row: RoleRecord];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
const contextMenuSourceItems = computed(() => props.contextMenuItems as unknown as HostContextMenuItem[]);
</script>
