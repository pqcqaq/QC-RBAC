<template>
  <el-drawer
    class="audit-detail-drawer"
    :model-value="visible"
    :title="log ? `${log.method} ${log.path}` : '审计详情'"
    size="62%"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="log" class="detail-stack">
      <section class="detail-section audit-request-overview">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Request</p>
            <h3 class="panel-heading panel-heading--md">{{ log.method }} {{ log.path }}</h3>
            <p class="muted">
              {{ log.actorName }} · {{ formatAuditTime(log.startedAt) }} · 请求 {{ shortenAuditId(log.id) }}
            </p>
          </div>
          <el-tag :type="log.success ? 'success' : 'danger'" round>
            {{ log.statusCode }}
          </el-tag>
        </div>

        <div class="detail-chip-list">
          <span class="audit-chip">{{ formatAuditAuthMode(log.authMode) }}</span>
          <span v-if="log.authClientCode" class="audit-chip">{{ log.authClientCode }}</span>
          <span class="audit-chip">{{ log.operationCount }} 次数据库操作</span>
          <span v-if="rolledBackWrites" class="audit-chip audit-chip--warning">
            {{ rolledBackWrites }} 次写操作已回滚
          </span>
        </div>

        <div class="detail-kv-grid">
          <div class="detail-kv">
            <span>操作者</span>
            <strong>{{ log.actorName }}</strong>
          </div>
          <div class="detail-kv">
            <span>开始时间</span>
            <strong>{{ formatAuditTime(log.startedAt) }}</strong>
          </div>
          <div class="detail-kv">
            <span>结束时间</span>
            <strong>{{ formatAuditTime(log.finishedAt) }}</strong>
          </div>
          <div class="detail-kv">
            <span>耗时</span>
            <strong>{{ formatAuditDuration(log.durationMs) }}</strong>
          </div>
          <div class="detail-kv">
            <span>认证模式</span>
            <strong>{{ formatAuditAuthMode(log.authMode) }}</strong>
          </div>
          <div class="detail-kv">
            <span>数据库操作</span>
            <strong>{{ log.operationCount }} 次</strong>
          </div>
          <div class="detail-kv">
            <span>读 / 写</span>
            <strong>{{ log.readCount }} / {{ log.writeCount }}</strong>
          </div>
          <div class="detail-kv" v-if="log.errorCode">
            <span>错误码</span>
            <strong>{{ log.errorCode }}</strong>
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
        <div v-if="requestPayloadBlocks.length" class="audit-json-card-grid">
          <article v-for="block in requestPayloadBlocks" :key="block.key" class="audit-json-card">
            <div class="audit-json-card__header">
              <p class="panel-caption">{{ block.caption }}</p>
              <h4 class="panel-heading panel-heading--md">{{ block.title }}</h4>
            </div>
            <VueJsonPretty
              class="audit-json-viewer"
              :data="block.value"
              :deep="2"
              :show-line="false"
              :show-length="true"
              :show-double-quotes="true"
              :collapsed-on-click-brackets="true"
            />
          </article>
        </div>
        <el-empty v-else description="这次请求没有 query / params / body 载荷" />
      </section>

      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Operations</p>
            <h3 class="panel-heading panel-heading--md">数据库操作明细</h3>
          </div>
        </div>

        <div v-if="log.operations.length" class="audit-operation-list">
          <article v-for="operation in log.operations" :key="operation.id" class="audit-operation-card">
            <header class="audit-operation-card__header">
              <div class="audit-operation-card__copy">
                <div class="audit-operation-card__index">#{{ operation.sequence }}</div>
                <div>
                  <h4 class="panel-heading panel-heading--md">{{ getOperationLabel(operation) }}</h4>
                  <p class="muted">
                    {{ formatAuditTime(operation.startedAt) }} · {{ formatAuditDuration(operation.durationMs) }}
                  </p>
                </div>
              </div>

              <div class="detail-chip-list">
                <span class="audit-chip">{{ formatOperationEffectKind(operation.effectKind) }}</span>
                <span class="audit-chip">{{ formatOperationAccessKind(operation.accessKind) }}</span>
                <span v-if="operation.softDelete" class="audit-chip audit-chip--warning">软删除</span>
                <span
                  class="audit-chip"
                  :class="{ 'audit-chip--warning': operation.effectKind === 'WRITE' && !operation.committed }"
                >
                  {{ commitLabel(operation) }}
                </span>
              </div>
            </header>

            <div class="audit-operation-card__grid">
              <div class="audit-metric-card">
                <span>执行结果</span>
                <strong>{{ operation.succeeded ? '成功' : '失败' }}</strong>
              </div>
              <div class="audit-metric-card">
                <span>主实体 ID</span>
                <strong>{{ operation.primaryEntityId || '无' }}</strong>
              </div>
              <div class="audit-metric-card">
                <span>影响记录</span>
                <strong>{{ operation.affectedCount }}</strong>
              </div>
              <div class="audit-metric-card">
                <span>影响 ID</span>
                <strong>{{ operation.affectedIds.length ? operation.affectedIds.join(', ') : '无' }}</strong>
              </div>
            </div>

            <div v-if="operation.errorMessage" class="audit-alert audit-alert--danger">
              <strong>{{ operation.errorCode || '数据库操作失败' }}</strong>
              <span>{{ operation.errorMessage }}</span>
            </div>

            <div v-if="getReadEffectSummary(operation.effect)" class="audit-effect-grid">
              <article class="audit-metric-card">
                <span>结果类型</span>
                <strong>{{ formatReadResultType(getReadEffectSummary(operation.effect)?.resultType) }}</strong>
              </article>
              <article class="audit-metric-card">
                <span>返回数量</span>
                <strong>{{ getReadEffectSummary(operation.effect)?.resultCount ?? 0 }}</strong>
              </article>
              <article class="audit-metric-card audit-metric-card--full">
                <span>返回 ID</span>
                <strong>
                  {{ getReadEffectSummary(operation.effect)?.returnedIds.length
                    ? getReadEffectSummary(operation.effect)?.returnedIds.join(', ')
                    : '未返回实体 ID' }}
                </strong>
              </article>
            </div>

            <VueJsonPretty
              v-if="getReadEffectPreview(operation.effect) !== undefined"
              class="audit-json-viewer"
              :data="getReadEffectPreview(operation.effect)"
              :deep="2"
              :show-line="false"
              :show-length="true"
              :show-double-quotes="true"
              :collapsed-on-click-brackets="true"
            />

            <div v-if="getWriteEffectRecords(operation.effect).length" class="audit-record-list">
              <div class="audit-record-list__summary">
                <span class="audit-chip">
                  {{ getWriteEffectSummary(operation.effect)?.changedRecordCount ?? getWriteEffectRecords(operation.effect).length }}
                  条记录出现变化
                </span>
              </div>

              <article
                v-for="record in getWriteEffectRecords(operation.effect)"
                :key="record.id"
                class="audit-record-card"
              >
                <header class="audit-record-card__header">
                  <div>
                    <p class="panel-caption">Entity</p>
                    <h5 class="panel-heading panel-heading--md">{{ record.id }}</h5>
                  </div>
                  <span class="audit-chip">{{ record.changes.length }} 个字段变化</span>
                </header>

                <div v-if="record.changes.length" class="audit-change-list">
                  <div v-for="change in record.changes" :key="change.field" class="audit-change-row">
                    <span class="audit-change-row__field">{{ change.field }}</span>
                    <div class="audit-change-row__values">
                      <code>{{ formatInlineAuditValue(change.before) }}</code>
                      <span>→</span>
                      <code>{{ formatInlineAuditValue(change.after) }}</code>
                    </div>
                  </div>
                </div>

                <p v-else class="muted">
                  没有字段级差异，可能是批量写入、脱敏后等价，或这次操作只暴露了聚合结果。
                </p>

                <details v-if="record.before || record.after" class="audit-detail-toggle">
                  <summary>查看 before / after 快照</summary>
                  <div class="audit-json-card-grid audit-json-card-grid--dual">
                    <article class="audit-json-card">
                      <div class="audit-json-card__header">
                        <p class="panel-caption">Before</p>
                        <h5 class="panel-heading panel-heading--md">变更前</h5>
                      </div>
                      <VueJsonPretty
                        class="audit-json-viewer"
                        :data="record.before"
                        :deep="2"
                        :show-line="false"
                        :show-length="true"
                        :show-double-quotes="true"
                        :collapsed-on-click-brackets="true"
                      />
                    </article>

                    <article class="audit-json-card">
                      <div class="audit-json-card__header">
                        <p class="panel-caption">After</p>
                        <h5 class="panel-heading panel-heading--md">变更后</h5>
                      </div>
                      <VueJsonPretty
                        class="audit-json-viewer"
                        :data="record.after"
                        :deep="2"
                        :show-line="false"
                        :show-length="true"
                        :show-double-quotes="true"
                        :collapsed-on-click-brackets="true"
                      />
                    </article>
                  </div>
                </details>
              </article>
            </div>

            <details v-if="hasOperationPayload(operation)" class="audit-detail-toggle">
              <summary>查看 query / mutation / result 快照</summary>
              <div class="audit-json-card-grid">
                <article
                  v-for="block in getOperationPayloadBlocks(operation)"
                  :key="block.key"
                  class="audit-json-card"
                >
                  <div class="audit-json-card__header">
                    <p class="panel-caption">{{ block.caption }}</p>
                    <h5 class="panel-heading panel-heading--md">{{ block.title }}</h5>
                  </div>
                  <VueJsonPretty
                    class="audit-json-viewer"
                    :data="block.value"
                    :deep="2"
                    :show-line="false"
                    :show-length="true"
                    :show-double-quotes="true"
                    :collapsed-on-click-brackets="true"
                  />
                </article>
              </div>
            </details>
          </article>
        </div>

        <el-empty v-else description="这次请求没有记录到数据库操作" />
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import type { RequestAuditOperationRecord, RequestAuditRecord } from '@rbac/api-common';
import {
  formatAuditAuthMode,
  formatAuditDuration,
  formatAuditTime,
  formatInlineAuditValue,
  formatOperationAccessKind,
  formatOperationEffectKind,
  getOperationLabel,
  getReadEffectPreview,
  getReadEffectSummary,
  getWriteEffectRecords,
  getWriteEffectSummary,
  hasMeaningfulAuditValue,
  shortenAuditId,
} from '../audit-display';

const props = defineProps<{
  visible: boolean;
  log: RequestAuditRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const requestPayloadBlocks = computed(() => [
  {
    key: 'query',
    caption: 'Query',
    title: '查询参数',
    value: props.log?.requestQuery,
  },
  {
    key: 'params',
    caption: 'Params',
    title: '路径参数',
    value: props.log?.requestParams,
  },
  {
    key: 'body',
    caption: 'Body',
    title: '请求体',
    value: props.log?.requestBody,
  },
].filter((block) => hasMeaningfulAuditValue(block.value)) as any[]);

const rolledBackWrites = computed(() =>
  props.log?.operations.filter(operation => operation.effectKind === 'WRITE' && !operation.committed).length ?? 0);

const formatReadResultType = (value?: string) => {
  switch (value) {
    case 'collection':
      return '集合';
    case 'single':
      return '单条';
    case 'count':
      return '计数';
    case 'empty':
      return '空结果';
    default:
      return value ?? '未知';
  }
};

const commitLabel = (operation: RequestAuditOperationRecord) => {
  if (operation.effectKind === 'READ') {
    return '只读';
  }

  return operation.committed ? '已提交' : '已回滚';
};

const hasOperationPayload = (operation: RequestAuditOperationRecord) => [
  operation.query,
  operation.mutation,
  operation.result,
].some(hasMeaningfulAuditValue);

const getOperationPayloadBlocks = (operation: RequestAuditOperationRecord): any => [
  {
    key: 'query',
    caption: 'Query',
    title: '查询快照',
    value: operation.query,
  },
  {
    key: 'mutation',
    caption: 'Mutation',
    title: '写入参数',
    value: operation.mutation,
  },
  {
    key: 'result',
    caption: 'Result',
    title: '返回结果',
    value: operation.result,
  },
].filter((block) => hasMeaningfulAuditValue(block.value));
</script>

<style scoped lang="scss">
:deep(.audit-detail-drawer .el-drawer__body) {
  padding-top: 0;
}

.audit-request-overview {
  gap: 14px;
}

.audit-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--line-soft);
  background: var(--surface-card-muted-bg);
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 600;
}

.audit-chip--warning {
  color: #9f5c00;
  border-color: color-mix(in srgb, #9f5c00 24%, var(--line-soft));
  background: color-mix(in srgb, #9f5c00 8%, var(--surface-card-bg));
}

.audit-json-card-grid {
  display: grid;
  gap: 12px;
}

.audit-json-card-grid--dual {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.audit-json-card,
.audit-operation-card,
.audit-record-card,
.audit-metric-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
  background: var(--surface-card-bg);
}

.audit-json-viewer {
  max-height: 340px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--surface-card-muted-bg);
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.audit-json-viewer :deep(.vjs-tree__node.is-highlight),
.audit-json-viewer :deep(.vjs-tree__content:hover) {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}

.audit-json-viewer :deep(.vjs-key),
.audit-json-viewer :deep(.vjs-value-string) {
  word-break: break-all;
}

.audit-json-card__header,
.audit-record-card__header,
.audit-operation-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.audit-operation-list,
.audit-record-list {
  display: grid;
  gap: 12px;
}

.audit-operation-card {
  background: linear-gradient(180deg, var(--surface-card-bg), var(--surface-card-muted-bg));
}

.audit-operation-card__copy {
  display: flex;
  gap: 12px;
}

.audit-operation-card__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 38px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-card-bg));
  color: var(--accent-strong);
  font-weight: 700;
}

.audit-operation-card__grid,
.audit-effect-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.audit-metric-card--full {
  grid-column: 1 / -1;
}

.audit-metric-card span {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.audit-metric-card strong {
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}

.audit-alert {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
}

.audit-alert strong {
  font-size: 14px;
}

.audit-alert--danger {
  border: 1px solid color-mix(in srgb, #b42318 24%, var(--line-soft));
  background: color-mix(in srgb, #b42318 8%, var(--surface-card-bg));
  color: #7a271a;
}

.audit-record-list__summary {
  display: flex;
  justify-content: flex-start;
}

.audit-change-list {
  display: grid;
  gap: 8px;
}

.audit-change-row {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface-card-muted-bg);
}

.audit-change-row__field {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-2);
}

.audit-change-row__values {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--ink-3);
}

.audit-change-row__values code {
  padding: 4px 8px;
  border-radius: 10px;
  background: var(--surface-card-bg);
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--ink-1);
  word-break: break-all;
}

.audit-detail-toggle {
  display: grid;
  gap: 12px;
}

.audit-detail-toggle summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-strong);
}

@media (max-width: 1080px) {
  .audit-json-card-grid--dual,
  .audit-operation-card__grid,
  .audit-effect-grid {
    grid-template-columns: 1fr;
  }

  .audit-json-card__header,
  .audit-record-card__header,
  .audit-operation-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .audit-operation-card__copy {
    width: 100%;
  }
}
</style>
