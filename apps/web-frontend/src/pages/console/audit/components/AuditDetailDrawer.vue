<template>
  <el-drawer
    :model-value="visible"
    :title="log ? `${log.method} ${log.path}` : '审计详情'"
    size="48%"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="log" class="detail-stack">
      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Request</p>
            <h3 class="panel-heading panel-heading--md">{{ log.method }} {{ log.path }}</h3>
          </div>
          <el-tag :type="log.success ? 'success' : 'danger'" round>
            {{ log.statusCode }}
          </el-tag>
        </div>

        <div class="detail-kv-grid">
          <div class="detail-kv">
            <span>操作者</span>
            <strong>{{ log.actorName }}</strong>
          </div>
          <div class="detail-kv">
            <span>开始时间</span>
            <strong>{{ formatTime(log.startedAt) }}</strong>
          </div>
          <div class="detail-kv">
            <span>耗时</span>
            <strong>{{ log.durationMs }}ms</strong>
          </div>
          <div class="detail-kv">
            <span>认证模式</span>
            <strong>{{ log.authMode }}</strong>
          </div>
          <div class="detail-kv">
            <span>数据库操作</span>
            <strong>{{ log.operationCount }} 次</strong>
          </div>
          <div class="detail-kv">
            <span>读/写</span>
            <strong>{{ log.readCount }} / {{ log.writeCount }}</strong>
          </div>
          <div class="detail-kv detail-kv--full" v-if="log.errorMessage">
            <span>错误</span>
            <strong>{{ log.errorMessage }}</strong>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Request Payload</p>
            <h3 class="panel-heading panel-heading--md">请求上下文</h3>
          </div>
        </div>
        <pre class="audit-json">{{ requestJson }}</pre>
      </section>

      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Operations</p>
            <h3 class="panel-heading panel-heading--md">数据库操作明细</h3>
          </div>
        </div>
        <pre class="audit-json">{{ operationJson }}</pre>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RequestAuditRecord } from '@rbac/api-common';

const props = defineProps<{
  visible: boolean;
  log: RequestAuditRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const requestJson = computed(() =>
  JSON.stringify({
    query: props.log?.requestQuery ?? null,
    params: props.log?.requestParams ?? null,
    body: props.log?.requestBody ?? null,
  }, null, 2));
const operationJson = computed(() => JSON.stringify(props.log?.operations ?? [], null, 2));
const formatTime = (value: string) => new Date(value).toLocaleString();
</script>
