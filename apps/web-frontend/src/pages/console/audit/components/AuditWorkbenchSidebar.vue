<template>
  <div class="audit-sidebar">
    <SurfacePanel
      caption="Focus"
      title="选中请求速览"
      description="左侧按请求收敛范围，这里聚焦当前上下文和核心数据库动作。"
    >
      <div v-if="log" class="audit-focus">
        <div class="audit-focus__hero">
          <div class="audit-focus__headline">
            <span class="audit-method" :class="methodClass(log.method)">{{ log.method }}</span>
            <div>
              <strong>{{ log.path }}</strong>
              <p class="muted">
                {{ log.actorName }} · {{ formatAuditTime(log.startedAt) }} · 请求 {{ shortenAuditId(log.id) }}
              </p>
            </div>
          </div>

          <el-tag :type="log.success ? 'success' : 'danger'" round>
            {{ log.statusCode }}
          </el-tag>
        </div>

        <div class="audit-focus__grid">
          <article class="audit-focus__metric">
            <span>耗时</span>
            <strong>{{ formatAuditDuration(log.durationMs) }}</strong>
          </article>
          <article class="audit-focus__metric">
            <span>数据库操作</span>
            <strong>{{ log.operationCount }} 次</strong>
          </article>
          <article class="audit-focus__metric">
            <span>读 / 写</span>
            <strong>{{ log.readCount }} / {{ log.writeCount }}</strong>
          </article>
          <article class="audit-focus__metric">
            <span>认证</span>
            <strong>{{ formatAuditAuthMode(log.authMode) }}</strong>
          </article>
        </div>

        <div v-if="highlightedOperations.length" class="audit-focus__operations">
          <article
            v-for="operation in highlightedOperations"
            :key="operation.id"
            class="audit-focus__operation"
          >
            <div>
              <strong>{{ getOperationLabel(operation) }}</strong>
              <p class="muted">
                {{ formatOperationEffectKind(operation.effectKind) }} · {{ formatOperationAccessKind(operation.accessKind) }}
              </p>
            </div>

            <div class="detail-chip-list audit-focus__operation-tags">
              <span class="audit-mini-tag">{{ formatAuditDuration(operation.durationMs) }}</span>
              <span
                class="audit-mini-tag"
                :class="{ 'audit-mini-tag--danger': operation.effectKind === 'WRITE' && !operation.committed }"
              >
                {{ commitLabel(operation) }}
              </span>
            </div>
          </article>
        </div>

        <div class="audit-focus__footer">
          <span class="muted">{{ getPrimaryOperationLabel(log.operations) || '无数据库操作' }}</span>
          <el-button type="primary" plain @click="emit('detail', log)">查看完整详情</el-button>
        </div>
      </div>

      <el-empty v-else description="当前页没有可预览的请求" />
    </SurfacePanel>

    <SurfacePanel
      caption="Signals"
      title="当前页信号"
      description="帮助快速判断失败、回滚和热点模型，减少来回切页。"
    >
      <div class="audit-signal-grid">
        <article
          v-for="signal in pageSignals"
          :key="signal.label"
          class="audit-signal-card"
          :class="{
            'audit-signal-card--accent': signal.tone === 'accent',
            'audit-signal-card--danger': signal.tone === 'danger',
          }"
        >
          <span>{{ signal.label }}</span>
          <strong>{{ signal.value }}</strong>
        </article>
      </div>

      <div class="audit-hot-models">
        <div class="audit-hot-models__header">
          <div>
            <p class="panel-caption">Models</p>
            <h4 class="panel-heading panel-heading--md">本页热点模型</h4>
          </div>
          <span class="muted">按数据库操作次数排序</span>
        </div>

        <div v-if="hotModels.length" class="audit-hot-models__list">
          <div v-for="item in hotModels" :key="item.model" class="audit-hot-model">
            <strong>{{ item.model }}</strong>
            <span>{{ item.count }} 次</span>
          </div>
        </div>

        <p v-else class="muted">当前页没有数据库操作。</p>
      </div>
    </SurfacePanel>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RequestAuditOperationRecord, RequestAuditRecord } from '@rbac/api-common';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import type { AuditModelCount, AuditSignalItem } from '../audit-display';
import {
  formatAuditAuthMode,
  formatAuditDuration,
  formatAuditTime,
  formatOperationAccessKind,
  formatOperationEffectKind,
  getOperationLabel,
  getPrimaryOperationLabel,
  shortenAuditId,
} from '../audit-display';

const props = defineProps<{
  log: RequestAuditRecord | null;
  pageSignals: AuditSignalItem[];
  hotModels: AuditModelCount[];
}>();

const emit = defineEmits<{
  detail: [row: RequestAuditRecord];
}>();

const highlightedOperations = computed(() => props.log?.operations.slice(0, 4) ?? []);

const methodClass = (method: string) => ({
  'audit-method--get': method === 'GET',
  'audit-method--post': method === 'POST',
  'audit-method--put': method === 'PUT',
  'audit-method--delete': method === 'DELETE',
});

const commitLabel = (operation: RequestAuditOperationRecord) => {
  if (operation.effectKind === 'READ') {
    return '只读';
  }

  return operation.committed ? '已提交' : '已回滚';
};
</script>

<style scoped lang="scss">
.audit-sidebar {
  display: grid;
  gap: 14px;
}

.audit-focus,
.audit-hot-models {
  display: grid;
  gap: 14px;
}

.audit-focus__hero,
.audit-focus__footer,
.audit-hot-models__header,
.audit-hot-model {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.audit-focus__headline {
  display: flex;
  gap: 12px;
  min-width: 0;
}

.audit-focus__headline strong {
  display: block;
  margin-bottom: 4px;
  word-break: break-all;
}

.audit-focus__grid,
.audit-signal-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.audit-focus__metric,
.audit-signal-card {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
  background: var(--surface-card-muted-bg);
}

.audit-focus__metric span,
.audit-signal-card span {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.audit-focus__metric strong,
.audit-signal-card strong {
  font-size: 18px;
  line-height: 1.2;
}

.audit-signal-card--accent {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-card-muted-bg));
}

.audit-signal-card--danger {
  background: color-mix(in srgb, #b42318 8%, var(--surface-card-muted-bg));
  border-color: color-mix(in srgb, #b42318 18%, var(--line-soft));
}

.audit-focus__operations,
.audit-hot-models__list {
  display: grid;
  gap: 10px;
}

.audit-focus__operation {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
  background: var(--surface-card-bg);
}

.audit-focus__operation strong {
  display: block;
  margin-bottom: 4px;
}

.audit-method,
.audit-mini-tag {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.audit-method {
  min-width: 60px;
  justify-content: center;
  padding: 5px 10px;
  background: var(--surface-card-strong-bg);
  color: var(--ink-2);
}

.audit-method--get {
  background: color-mix(in srgb, #1d7a53 16%, var(--surface-card-bg));
  color: #166846;
}

.audit-method--post {
  background: color-mix(in srgb, #1f74c9 18%, var(--surface-card-bg));
  color: #175da3;
}

.audit-method--put {
  background: color-mix(in srgb, #a05b18 18%, var(--surface-card-bg));
  color: #8a4d11;
}

.audit-method--delete {
  background: color-mix(in srgb, #b64343 18%, var(--surface-card-bg));
  color: #9f3030;
}

.audit-mini-tag {
  padding: 5px 10px;
  border: 1px solid var(--line-soft);
  background: var(--surface-card-muted-bg);
  color: var(--ink-2);
}

.audit-mini-tag--danger {
  color: #b42318;
  border-color: color-mix(in srgb, #b42318 24%, var(--line-soft));
  background: color-mix(in srgb, #b42318 8%, var(--surface-card-bg));
}

.audit-hot-model {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line-soft);
}

.audit-hot-model:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

@media (max-width: 860px) {
  .audit-focus__grid,
  .audit-signal-grid {
    grid-template-columns: 1fr;
  }

  .audit-focus__hero,
  .audit-focus__footer,
  .audit-hot-models__header,
  .audit-hot-model,
  .audit-focus__operation {
    flex-direction: column;
    align-items: flex-start;
  }

  .audit-focus__operation-tags {
    justify-content: flex-start;
  }
}
</style>
