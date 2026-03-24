<template>
  <el-drawer
    :model-value="visible"
    :title="topic ? `${topic.code} · 订阅授权详情` : '订阅授权详情'"
    size="620px"
    @update:model-value="emit('update:visible', $event)"
  >
    <template v-if="topic">
      <section class="surface-card topic-detail-card">
        <p class="panel-caption">Binding</p>
        <h3 class="panel-heading panel-heading--md">{{ topic.name }}</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="编码">{{ topic.code }}</el-descriptions-item>
          <el-descriptions-item label="来源">
            <el-tag :type="topic.isSystem ? 'warning' : 'info'" effect="light" round>
              {{ resolveRealtimeTopicSourceLabel(topic.isSystem) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="描述">{{ topic.description || '未填写' }}</el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="surface-card topic-detail-card">
        <p class="panel-caption">Authorization</p>
        <h3 class="panel-heading panel-heading--md">Topic 与权限</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item
            v-for="item in detailEntries"
            :key="item.label"
            :label="item.label"
          >
            <span class="topic-detail-value">{{ item.value }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="surface-card topic-detail-card">
        <p class="panel-caption">Pattern Rules</p>
        <h3 class="panel-heading panel-heading--md">匹配约束</h3>
        <div class="topic-rule-list">
          <span>`+` 只匹配单层。</span>
          <span>`#` 只能在最后一层，表示后续所有层级。</span>
          <span>订阅时会先找能覆盖目标 topic 的 pattern，再校验对应权限。</span>
        </div>
      </section>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RealtimeTopicRecord } from '@rbac/api-common';
import {
  buildRealtimeTopicDetailEntries,
  resolveRealtimeTopicSourceLabel,
} from '../realtime-topic-management';

const props = defineProps<{
  visible: boolean;
  topic: RealtimeTopicRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const detailEntries = computed(() =>
  props.topic ? buildRealtimeTopicDetailEntries(props.topic) : [],
);
</script>

<style scoped>
.topic-detail-card + .topic-detail-card {
  margin-top: 16px;
}

.topic-detail-value {
  white-space: pre-wrap;
  word-break: break-word;
}

.topic-rule-list {
  display: grid;
  gap: 8px;
  color: var(--ink-3);
  font-size: 13px;
  line-height: 1.6;
}
</style>
