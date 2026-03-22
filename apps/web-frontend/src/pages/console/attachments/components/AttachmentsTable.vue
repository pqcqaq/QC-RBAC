<template>
  <section class="table-panel surface-card">
    <header class="table-panel__header">
      <div>
        <p class="panel-caption">Attachments</p>
        <h3 class="panel-heading panel-heading--md">附件目录</h3>
      </div>
      <div class="table-panel__meta">
        <span>共 {{ total }} 个附件</span>
        <span>第 {{ page }} 页</span>
      </div>
    </header>

    <ContextMenuHost :items="contextMenuSourceItems" manual>
      <template #default="{ open }">
        <el-table
          :data="attachments"
          class="table-context-menu"
          stripe
          v-loading="loading"
          @row-contextmenu="(row, _column, event) => open(event, row)"
        >
          <el-table-column prop="originalName" label="文件名" min-width="220" />
          <el-table-column label="类型" width="120">
            <template #default="{ row }">
              <el-tag effect="light" round>
                {{ resolveAttachmentKindLabel(row.kind) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="标签" min-width="180">
            <template #default="{ row }">
              <div class="attachment-tag-stack">
                <el-tag v-if="row.tag1" size="small" effect="light">{{ row.tag1 }}</el-tag>
                <el-tag v-if="row.tag2" size="small" effect="light" type="info">{{ row.tag2 }}</el-tag>
                <span v-if="!row.tag1 && !row.tag2" class="attachment-tag-stack__empty">未设置</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="上传人" min-width="160">
            <template #default="{ row }">
              <div class="attachment-owner">
                <strong>{{ row.owner.nickname }}</strong>
                <span>{{ row.owner.username }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="resolveAttachmentStatusType(row.uploadStatus)" effect="light" round>
                {{ resolveAttachmentStatusLabel(row.uploadStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="120">
            <template #default="{ row }">
              {{ formatAttachmentSize(row.size) }}
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.updatedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <el-space>
                <el-button link @click="emit('detail', row)">详情</el-button>
                <el-button link @click="emit('open-link', row)" :disabled="!row.url">打开</el-button>
                <el-button v-permission="'file.update'" link @click="emit('edit', row)">编辑</el-button>
                <el-button
                  v-permission="'file.delete'"
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
import type { MediaAssetRecord } from '@rbac/api-common';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import type { ContextMenuItem } from '@/components/common/context-menu';
import {
  formatAttachmentSize,
  resolveAttachmentKindLabel,
  resolveAttachmentStatusLabel,
  resolveAttachmentStatusType,
} from '../attachment-management';

type HostContextMenuItem = ContextMenuItem<never>;

const props = defineProps<{
  attachments: MediaAssetRecord[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  contextMenuItems: ContextMenuItem<MediaAssetRecord>[];
}>();

const emit = defineEmits<{
  detail: [row: MediaAssetRecord];
  edit: [row: MediaAssetRecord];
  delete: [row: MediaAssetRecord];
  'open-link': [row: MediaAssetRecord];
  'page-change': [value: number];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
const contextMenuSourceItems = computed(() => props.contextMenuItems as unknown as HostContextMenuItem[]);
</script>

<style scoped>
.attachment-tag-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.attachment-tag-stack__empty {
  color: var(--el-text-color-secondary);
}

.attachment-owner {
  display: grid;
  gap: 2px;
}

.attachment-owner span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
