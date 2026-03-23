<template>
  <el-drawer
    :model-value="visible"
    :title="attachment ? `${attachment.originalName} · 附件详情` : '附件详情'"
    size="42%"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="attachment" class="detail-stack">
      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Attachment</p>
            <h3 class="panel-heading panel-heading--md">{{ attachment.originalName }}</h3>
          </div>
          <el-tag :type="resolveAttachmentStatusType(attachment.uploadStatus)" round>
            {{ resolveAttachmentStatusLabel(attachment.uploadStatus) }}
          </el-tag>
        </div>

        <div class="detail-kv-grid">
          <div class="detail-kv">
            <span>类型</span>
            <strong>{{ resolveAttachmentKindLabel(attachment.kind) }}</strong>
          </div>
          <div class="detail-kv">
            <span>大小</span>
            <strong>{{ formatAttachmentSize(attachment.size) }}</strong>
          </div>
          <div class="detail-kv">
            <span>MIME</span>
            <strong>{{ attachment.mimeType }}</strong>
          </div>
          <div class="detail-kv">
            <span>存储</span>
            <strong>{{ attachment.storageProvider.toUpperCase() }}</strong>
          </div>
          <div class="detail-kv">
            <span>Tag1</span>
            <strong>{{ attachment.tag1 || '未设置' }}</strong>
          </div>
          <div class="detail-kv">
            <span>Tag2</span>
            <strong>{{ attachment.tag2 || '未设置' }}</strong>
          </div>
          <div class="detail-kv">
            <span>上传人</span>
            <strong>{{ attachment.owner.nickname }} · {{ attachment.owner.username }}</strong>
          </div>
          <div class="detail-kv">
            <span>上传时间</span>
            <strong>{{ formatTime(attachment.createdAt) }}</strong>
          </div>
          <div class="detail-kv">
            <span>完成时间</span>
            <strong>{{ attachment.completedAt ? formatTime(attachment.completedAt) : '未完成' }}</strong>
          </div>
          <div class="detail-kv">
            <span>对象键</span>
            <strong>{{ attachment.objectKey }}</strong>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Access</p>
            <h3 class="panel-heading panel-heading--md">访问地址</h3>
          </div>
          <el-space>
            <el-button size="small" @click="emit('copy-link', attachment)" :disabled="!attachment.url">复制链接</el-button>
            <el-button size="small" type="primary" plain @click="emit('open-link', attachment)" :disabled="!attachment.url">
              打开附件
            </el-button>
          </el-space>
        </div>
        <div class="detail-link-box">
          {{ attachment.url || '该附件尚未生成可访问地址' }}
        </div>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { MediaAssetRecord } from '@rbac/api-common';
import {
  formatAttachmentSize,
  resolveAttachmentKindLabel,
  resolveAttachmentStatusLabel,
  resolveAttachmentStatusType,
} from '../attachment-management';

defineProps<{
  visible: boolean;
  attachment: MediaAssetRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'open-link': [row: MediaAssetRecord];
  'copy-link': [row: MediaAssetRecord];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
</script>

<style scoped>
.detail-link-box {
  padding: 14px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 14px;
  background: var(--surface-card-bg);
  word-break: break-all;
  color: var(--el-text-color-regular);
}
</style>
