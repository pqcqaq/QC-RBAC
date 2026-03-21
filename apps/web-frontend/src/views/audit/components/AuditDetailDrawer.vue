<template>
  <el-drawer
    :model-value="visible"
    :title="log ? `${log.action} · 审计详情` : '审计详情'"
    size="42%"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="log" class="detail-stack">
      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Event</p>
            <h3 class="panel-heading panel-heading--md">{{ log.action }}</h3>
          </div>
          <el-tag type="info" round>{{ formatTime(log.createdAt) }}</el-tag>
        </div>

        <div class="detail-kv-grid">
          <div class="detail-kv">
            <span>操作者</span>
            <strong>{{ log.actorName }}</strong>
          </div>
          <div class="detail-kv">
            <span>目标</span>
            <strong>{{ log.target }}</strong>
          </div>
          <div class="detail-kv detail-kv--full">
            <span>上下文摘要</span>
            <strong>{{ summarizeDetail(log.detail) }}</strong>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Payload</p>
            <h3 class="panel-heading panel-heading--md">事件载荷</h3>
          </div>
        </div>
        <pre class="audit-json">{{ detailJson }}</pre>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ActivityLogRecord } from '@rbac/api-common';

const props = defineProps<{
  visible: boolean;
  log: ActivityLogRecord | null;
  summarizeDetail: (detail: unknown) => string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const detailJson = computed(() => JSON.stringify(props.log?.detail ?? {}, null, 2));
const formatTime = (value: string) => new Date(value).toLocaleString();
</script>
