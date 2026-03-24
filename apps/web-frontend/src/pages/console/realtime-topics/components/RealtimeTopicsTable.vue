<template>
  <section class="table-panel surface-card">
    <header class="table-panel__header">
      <div>
        <p class="panel-caption">Realtime Topic Bindings</p>
        <h3 class="panel-heading panel-heading--md">订阅授权目录</h3>
      </div>
      <div class="table-panel__meta">
        <span>支持右键快捷操作</span>
        <span>共 {{ total }} 条绑定</span>
        <span>第 {{ page }} 页</span>
        <span>当前页系统注册 {{ seedCount }} 条</span>
      </div>
    </header>

    <ContextMenuHost :items="contextMenuSourceItems" manual>
      <template #default="{ open }">
        <el-table
          :data="topics"
          row-key="id"
          class="table-context-menu"
          stripe
          v-loading="loading"
          empty-text="暂无订阅授权"
          @row-contextmenu="(row, _column, event) => open(event, row)"
        >
          <el-table-column prop="code" label="编码" min-width="180" />
          <el-table-column prop="name" label="名称" min-width="160" />
          <el-table-column label="Topic Pattern" min-width="260">
            <template #default="{ row }">
              <code class="topic-pattern-chip">{{ row.topicPattern }}</code>
            </template>
          </el-table-column>
          <el-table-column label="绑定权限" min-width="240">
            <template #default="{ row }">
              <div class="table-stack table-stack--compact">
                <strong>{{ row.permission.name }}</strong>
                <span>{{ row.permission.code }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="120">
            <template #default="{ row }">
              <el-tag :type="row.isSystem ? 'warning' : 'info'" effect="light" round>
                {{ resolveRealtimeTopicSourceLabel(row.isSystem) }}
              </el-tag>
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
                <el-button
                  v-if="!row.isSystem"
                  v-permission="'realtime-topic.update'"
                  link
                  @click="emit('edit', row)"
                >
                  编辑
                </el-button>
                <el-button
                  v-if="!row.isSystem"
                  v-permission="'realtime-topic.delete'"
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
import type { RealtimeTopicRecord } from '@rbac/api-common';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import type { ContextMenuItem } from '@/components/common/context-menu';
import { resolveRealtimeTopicSourceLabel } from '../realtime-topic-management';

type HostContextMenuItem = ContextMenuItem<never>;

const props = defineProps<{
  topics: RealtimeTopicRecord[];
  loading: boolean;
  seedCount: number;
  total: number;
  page: number;
  pageSize: number;
  contextMenuItems: ContextMenuItem<RealtimeTopicRecord>[];
}>();

const emit = defineEmits<{
  detail: [row: RealtimeTopicRecord];
  edit: [row: RealtimeTopicRecord];
  delete: [row: RealtimeTopicRecord];
  'page-change': [value: number];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
const contextMenuSourceItems = computed(() => props.contextMenuItems as unknown as HostContextMenuItem[]);
</script>

<style scoped>
.topic-pattern-chip {
  display: inline-flex;
  max-width: 100%;
  padding: 4px 10px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-1);
  color: var(--ink-2);
  font-size: 12px;
  line-height: 1.4;
  word-break: break-all;
}

.table-stack--compact {
  gap: 4px;
}
</style>
