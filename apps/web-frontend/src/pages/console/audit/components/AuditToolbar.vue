<template>
  <section class="surface-card audit-toolbar">
    <div class="audit-toolbar__intro">
      <div class="audit-toolbar__copy">
        <p class="panel-caption">Audit Scope</p>
        <h3 class="panel-heading panel-heading--md">审计检索工作台</h3>
        <p class="muted">
          先按请求、模型和操作快速收敛范围，再进入单条请求查看 effect diff、事务提交状态和原始上下文。
        </p>
      </div>

      <div class="audit-toolbar__summary">
        <span class="audit-toolbar__summary-label">
          {{ activeFilters.length ? `已启用 ${activeFilters.length} 个过滤条件` : '当前未限制范围' }}
        </span>
        <div v-if="activeFilters.length" class="detail-chip-list audit-toolbar__chips">
          <span v-for="item in activeFilters" :key="item.key" class="audit-filter-chip">
            <strong>{{ item.label }}</strong>
            <span>{{ item.value }}</span>
          </span>
        </div>
        <span v-else class="muted">将返回全部请求，适合从最近日志开始排查。</span>
      </div>
    </div>

    <el-form label-position="top" class="audit-toolbar__form" @submit.prevent>
      <el-form-item label="关键词" class="audit-toolbar__field audit-toolbar__field--wide">
        <el-input
          v-model="filters.q"
          clearable
          placeholder="请求 ID / 操作者 / 路径 / 模型 / 操作"
          @keyup.enter="emit('apply')"
        />
      </el-form-item>

      <el-form-item label="方法" class="audit-toolbar__field">
        <el-select v-model="filters.method" clearable placeholder="全部方法">
          <el-option label="GET" value="GET" />
          <el-option label="POST" value="POST" />
          <el-option label="PUT" value="PUT" />
          <el-option label="DELETE" value="DELETE" />
        </el-select>
      </el-form-item>

      <el-form-item label="模型" class="audit-toolbar__field">
        <el-input
          v-model="filters.model"
          clearable
          placeholder="如 User"
          @keyup.enter="emit('apply')"
        />
      </el-form-item>

      <el-form-item label="操作" class="audit-toolbar__field">
        <el-input
          v-model="filters.operation"
          clearable
          placeholder="如 update / findMany"
          @keyup.enter="emit('apply')"
        />
      </el-form-item>

      <el-form-item label="结果" class="audit-toolbar__field">
        <el-select v-model="filters.status" clearable placeholder="全部结果">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failure" />
        </el-select>
      </el-form-item>
    </el-form>

    <div class="audit-toolbar__footer">
      <div class="audit-toolbar__quick">
        <span class="panel-caption">快捷方法</span>
        <el-space wrap>
          <el-button size="small" :type="filters.method ? 'default' : 'primary'" plain @click="toggleMethod('')">
            全部
          </el-button>
          <el-button size="small" :type="filters.method === 'GET' ? 'primary' : 'default'" plain @click="toggleMethod('GET')">
            GET
          </el-button>
          <el-button size="small" :type="filters.method === 'POST' ? 'primary' : 'default'" plain @click="toggleMethod('POST')">
            POST
          </el-button>
          <el-button size="small" :type="filters.method === 'PUT' ? 'primary' : 'default'" plain @click="toggleMethod('PUT')">
            PUT
          </el-button>
          <el-button size="small" :type="filters.method === 'DELETE' ? 'primary' : 'default'" plain @click="toggleMethod('DELETE')">
            DELETE
          </el-button>
        </el-space>
      </div>

      <div class="audit-toolbar__quick">
        <span class="panel-caption">快捷结果</span>
        <el-space wrap>
          <el-button size="small" :type="filters.status ? 'default' : 'primary'" plain @click="toggleStatus('')">
            全部
          </el-button>
          <el-button size="small" :type="filters.status === 'success' ? 'primary' : 'default'" plain @click="toggleStatus('success')">
            仅成功
          </el-button>
          <el-button size="small" :type="filters.status === 'failure' ? 'primary' : 'default'" plain @click="toggleStatus('failure')">
            仅失败
          </el-button>
        </el-space>
      </div>

      <div class="audit-toolbar__actions">
        <el-button :disabled="loading" @click="emit('reset')">清空条件</el-button>
        <el-button type="primary" plain :loading="loading" @click="emit('apply')">刷新结果</el-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AuditFilters } from '../audit-display';
import { getActiveAuditFilterTokens } from '../audit-display';

const props = defineProps<{
  filters: AuditFilters;
  loading: boolean;
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();

const activeFilters = computed(() => getActiveAuditFilterTokens(props.filters));

const toggleMethod = (value: AuditFilters['method']) => {
  props.filters.method = props.filters.method === value ? '' : value;
  emit('apply');
};

const toggleStatus = (value: AuditFilters['status']) => {
  props.filters.status = props.filters.status === value ? '' : value;
  emit('apply');
};
</script>

<style scoped lang="scss">
.audit-toolbar {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.audit-toolbar__intro {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 16px;
  align-items: start;
}

.audit-toolbar__copy {
  display: grid;
  gap: 6px;
}

.audit-toolbar__summary {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, var(--surface-card-bg), var(--surface-card-muted-bg));
}

.audit-toolbar__summary-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
}

.audit-toolbar__chips {
  gap: 10px;
}

.audit-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--surface-card-bg);
  border: 1px solid var(--line-soft);
  color: var(--ink-2);
  font-size: 12px;
}

.audit-filter-chip strong {
  color: var(--ink-1);
}

.audit-toolbar__form {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.audit-toolbar__field {
  margin-bottom: 0;
}

.audit-toolbar__field--wide {
  grid-column: span 2;
}

.audit-toolbar__footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.audit-toolbar__quick {
  display: grid;
  gap: 8px;
}

.audit-toolbar__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

@media (max-width: 1180px) {
  .audit-toolbar__intro,
  .audit-toolbar__form,
  .audit-toolbar__footer {
    grid-template-columns: 1fr;
  }

  .audit-toolbar__field--wide {
    grid-column: auto;
  }

  .audit-toolbar__actions {
    justify-content: flex-start;
  }
}
</style>
