<template>
  <div class="auth-strategy-picker">
    <div v-if="strategies.length > 1" class="auth-strategy-picker__group" role="listbox" :aria-label="label">
      <button
        v-for="strategy in strategies"
        :key="strategy.code"
        class="auth-strategy-pill"
        :class="{ 'is-active': modelValue === strategy.code }"
        type="button"
        :aria-selected="modelValue === strategy.code"
        @click="emit('update:modelValue', strategy.code)"
      >
        {{ strategy.name }}
      </button>
    </div>

    <el-empty v-else-if="!strategies.length" :description="emptyText" />
  </div>
</template>

<script setup lang="ts">
import type { AuthStrategyDescriptor } from '@rbac/api-common';

defineProps<{
  modelValue: string;
  label: string;
  strategies: AuthStrategyDescriptor[];
  emptyText: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<style scoped lang="scss">
.auth-strategy-picker {
  display: grid;
  gap: 12px;
}

.auth-strategy-picker__group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.auth-strategy-pill {
  min-height: 38px;
  padding: 0 16px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-card-soft-bg);
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 700;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.auth-strategy-pill:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 22%, var(--line-strong));
  color: var(--accent-strong);
}

.auth-strategy-pill.is-active {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--line-strong));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 30%, var(--surface-1)) 0%,
    color-mix(in srgb, var(--accent) 18%, var(--surface-0)) 100%
  );
  color: var(--ink-1);
  box-shadow: var(--shadow-panel);
}

.auth-strategy-picker :deep(.el-empty) {
  min-height: 140px;
  border: 1px dashed color-mix(in srgb, var(--line-strong) 92%, transparent);
  border-radius: 22px;
}
</style>
