<template>
  <div class="auth-strategy-picker">
    <button
      v-for="strategy in strategies"
      :key="strategy.code"
      class="auth-strategy-pill"
      :class="{ 'is-active': modelValue === strategy.code }"
      type="button"
      @click="emit('update:modelValue', strategy.code)"
    >
      <div class="auth-strategy-pill__head">
        <strong>{{ strategy.name }}</strong>
        <span v-if="strategy.mockEnabled" class="auth-strategy-pill__badge">Mock</span>
      </div>
      <span>{{ strategy.description || resolveStrategySummary(strategy) }}</span>
    </button>

    <el-empty v-if="!strategies.length" :description="emptyText" />
  </div>
</template>

<script setup lang="ts">
import type { AuthStrategyDescriptor } from '@rbac/api-common';

defineProps<{
  modelValue: string;
  strategies: AuthStrategyDescriptor[];
  emptyText: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const resolveStrategySummary = (strategy: AuthStrategyDescriptor) => {
  if (strategy.credentialType === 'PASSWORD') {
    return '使用静态凭据完成认证';
  }

  return '先发送验证码，再校验身份';
};
</script>

<style scoped lang="scss">
.auth-strategy-picker {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.auth-strategy-pill {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--line-soft) 92%, white);
  border-radius: 18px;
  background: color-mix(in srgb, white 92%, var(--surface-2));
  color: var(--ink-2);
  text-align: left;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.auth-strategy-pill:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 28%, var(--line-strong));
}

.auth-strategy-pill.is-active {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--line-strong));
  background: color-mix(in srgb, white 84%, var(--accent) 10%);
  box-shadow: var(--shadow-panel);
}

.auth-strategy-pill__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.auth-strategy-pill__head strong {
  color: var(--ink-1);
  font-size: 14px;
}

.auth-strategy-pill__head span,
.auth-strategy-pill > span {
  font-size: 12px;
  line-height: 1.6;
}

.auth-strategy-pill__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, #0f9d80 16%, white);
  color: #0d6e5c;
  font-weight: 700;
}

.auth-strategy-picker :deep(.el-empty) {
  grid-column: 1 / -1;
  min-height: 180px;
  border: 1px dashed var(--line-strong);
  border-radius: 18px;
}
</style>
