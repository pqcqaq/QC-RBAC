<template>
  <div class="auth-strategy-picker">
    <div v-if="strategies.length" class="auth-strategy-picker__head">
      <span>{{ label }}</span>
      <p>{{ selectedStrategy ? resolveStrategySummary(selectedStrategy) : '' }}</p>
    </div>

    <div v-if="strategies.length" class="auth-strategy-picker__group" role="listbox" :aria-label="label">
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

    <el-empty v-else :description="emptyText" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AuthStrategyDescriptor } from '@rbac/api-common';

const props = defineProps<{
  modelValue: string;
  label: string;
  strategies: AuthStrategyDescriptor[];
  emptyText: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const selectedStrategy = computed(() => props.strategies.find((item) => item.code === props.modelValue) ?? null);

const resolveStrategySummary = (strategy: AuthStrategyDescriptor) => {
  if (strategy.credentialType === 'PASSWORD') {
    return '使用账号和密码完成身份校验';
  }

  if (strategy.identifierType === 'EMAIL') {
    return '通过邮箱验证码完成登录或注册';
  }

  if (strategy.identifierType === 'PHONE') {
    return '通过手机验证码完成登录或注册';
  }

  return '通过验证码完成身份校验';
};
</script>

<style scoped lang="scss">
.auth-strategy-picker {
  display: grid;
  gap: 12px;
}

.auth-strategy-picker__head {
  display: grid;
  gap: 6px;
}

.auth-strategy-picker__head span {
  color: #7a847d;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.auth-strategy-picker__head p {
  color: #5c6d76;
  font-size: 13px;
  line-height: 1.65;
}

.auth-strategy-picker__group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.auth-strategy-pill {
  min-height: 38px;
  padding: 0 16px;
  border: 1px solid rgba(18, 43, 57, 0.08);
  border-radius: 999px;
  background: rgba(247, 243, 236, 0.9);
  color: #4f626d;
  font-size: 13px;
  font-weight: 700;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.auth-strategy-pill:hover {
  transform: translateY(-1px);
  border-color: rgba(23, 56, 74, 0.18);
  color: #17384a;
}

.auth-strategy-pill.is-active {
  border-color: rgba(23, 56, 74, 0.22);
  background: linear-gradient(135deg, rgba(23, 56, 74, 0.95) 0%, rgba(39, 79, 99, 0.92) 100%);
  color: #eef4f7;
  box-shadow: 0 14px 26px rgba(18, 43, 57, 0.14);
}

.auth-strategy-picker :deep(.el-empty) {
  min-height: 140px;
  border: 1px dashed rgba(18, 43, 57, 0.18);
  border-radius: 22px;
}
</style>
