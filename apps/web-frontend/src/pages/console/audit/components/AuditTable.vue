<template>
  <section class="surface-card audit-feed-panel">
    <header class="table-panel__header audit-feed-panel__header">
      <div>
        <p class="panel-caption">Audit Requests</p>
        <h3 class="panel-heading panel-heading--md">请求流</h3>
        <p class="muted">按开始时间倒序展示，最新请求固定在最上方；先选中一条，再在右侧和详情抽屉里深挖。</p>
      </div>
      <div class="table-panel__meta">
        <span>显示 {{ rangeStart }} - {{ rangeEnd }}</span>
        <span>共 {{ total }} 条请求</span>
        <span>第 {{ page }} 页</span>
      </div>
    </header>

    <div class="audit-feed-panel__body" v-loading="loading">
      <div v-if="logs.length" class="audit-feed-list">
        <article
          v-for="row in logs"
          :key="row.id"
          class="audit-request-card"
          :class="{ 'audit-request-card--active': row.id === selectedId }"
          @click="emit('select', row)"
        >
          <div class="audit-request-card__top">
            <div class="audit-request-card__headline">
              <span class="audit-request-method" :class="methodClass(row.method)">
                {{ row.method }}
              </span>

              <div class="audit-request-card__copy">
                <strong>{{ row.path }}</strong>
                <span class="muted">
                  {{ row.actorName }} · {{ formatAuditTime(row.startedAt) }} · 请求 {{ shortenAuditId(row.id) }}
                </span>
              </div>
            </div>

            <div class="audit-request-card__status">
              <el-tag :type="row.success ? 'success' : 'danger'" round>
                {{ row.success ? '成功' : '失败' }}
              </el-tag>
              <span class="audit-request-card__code">{{ row.statusCode }}</span>
            </div>
          </div>

          <div class="detail-chip-list audit-request-card__signals">
            <span class="audit-mini-tag">
              主操作 {{ getPrimaryOperationLabel(row.operations) || '无数据库操作' }}
            </span>
            <span class="audit-mini-tag">数据库 {{ row.operationCount }} 次</span>
            <span class="audit-mini-tag">读 {{ row.readCount }} / 写 {{ row.writeCount }}</span>
            <span class="audit-mini-tag">耗时 {{ formatAuditDuration(row.durationMs) }}</span>
            <span v-if="row.errorCode" class="audit-mini-tag audit-mini-tag--danger">
              {{ row.errorCode }}
            </span>
          </div>

          <div v-if="row.operations.length" class="audit-request-card__operations">
            <span
              v-for="operation in previewOperations(row.operations)"
              :key="operation.id"
              class="audit-operation-pill"
            >
              {{ getOperationLabel(operation) }}
            </span>
            <span v-if="row.operations.length > 3" class="audit-operation-pill audit-operation-pill--muted">
              +{{ row.operations.length - 3 }}
            </span>
          </div>

          <div class="audit-request-card__footer">
            <span class="muted">
              {{ formatAuditAuthMode(row.authMode) }}
              <template v-if="row.authClientCode"> · {{ row.authClientCode }}</template>
            </span>
            <el-button link type="primary" @click.stop="emit('detail', row)">完整详情</el-button>
          </div>
        </article>
      </div>

      <el-empty v-else description="没有匹配的审计记录" />
    </div>

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
import type { RequestAuditRecord } from '@rbac/api-common';
import {
  formatAuditAuthMode,
  formatAuditDuration,
  formatAuditTime,
  getOperationLabel,
  getPrimaryOperationLabel,
  shortenAuditId,
} from '../audit-display';

const props = defineProps<{
  logs: RequestAuditRecord[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  selectedId: string | null;
}>();

const emit = defineEmits<{
  detail: [row: RequestAuditRecord];
  select: [row: RequestAuditRecord];
  'page-change': [value: number];
}>();

const rangeStart = computed(() => (
  props.total === 0
    ? 0
    : (props.page - 1) * props.pageSize + 1
));
const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.total));

const previewOperations = (operations: RequestAuditRecord['operations']) => operations.slice(0, 3);

const methodClass = (method: string) => ({
  'audit-request-method--get': method === 'GET',
  'audit-request-method--post': method === 'POST',
  'audit-request-method--put': method === 'PUT',
  'audit-request-method--delete': method === 'DELETE',
});
</script>

<style scoped lang="scss">
.audit-feed-panel {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.audit-feed-panel__header {
  align-items: flex-start;
}

.audit-feed-panel__body {
  min-height: 320px;
}

.audit-feed-list {
  display: grid;
  gap: 12px;
}

.audit-request-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, var(--surface-card-bg), var(--surface-card-muted-bg));
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.audit-request-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--line-soft));
  box-shadow: var(--shadow-panel);
}

.audit-request-card--active {
  border-color: color-mix(in srgb, var(--accent) 56%, var(--line-soft));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent);
  background: linear-gradient(180deg, var(--surface-card-bg), color-mix(in srgb, var(--accent) 8%, var(--surface-card-muted-bg)));
}

.audit-request-card__top,
.audit-request-card__footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.audit-request-card__headline {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.audit-request-card__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.audit-request-card__copy strong {
  font-size: 15px;
  word-break: break-all;
}

.audit-request-card__status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audit-request-card__code {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
}

.audit-request-card__signals {
  gap: 10px;
}

.audit-request-card__operations {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.audit-request-method,
.audit-mini-tag,
.audit-operation-pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.audit-request-method {
  min-width: 60px;
  justify-content: center;
  padding: 5px 10px;
  background: var(--surface-card-strong-bg);
  color: var(--ink-2);
}

.audit-request-method--get {
  background: color-mix(in srgb, #1d7a53 16%, var(--surface-card-bg));
  color: #166846;
}

.audit-request-method--post {
  background: color-mix(in srgb, #1f74c9 18%, var(--surface-card-bg));
  color: #175da3;
}

.audit-request-method--put {
  background: color-mix(in srgb, #a05b18 18%, var(--surface-card-bg));
  color: #8a4d11;
}

.audit-request-method--delete {
  background: color-mix(in srgb, #b64343 18%, var(--surface-card-bg));
  color: #9f3030;
}

.audit-mini-tag,
.audit-operation-pill {
  padding: 5px 10px;
  border: 1px solid var(--line-soft);
  background: var(--surface-card-bg);
  color: var(--ink-2);
}

.audit-mini-tag--danger {
  color: #b42318;
  border-color: color-mix(in srgb, #b42318 24%, var(--line-soft));
  background: color-mix(in srgb, #b42318 8%, var(--surface-card-bg));
}

.audit-operation-pill--muted {
  color: var(--ink-3);
}

@media (max-width: 860px) {
  .audit-request-card__top,
  .audit-request-card__footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .audit-request-card__status {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
