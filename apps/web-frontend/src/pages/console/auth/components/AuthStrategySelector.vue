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
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.auth-strategy-pill {
  display: grid;
  gap: 10px;
  padding: 18px 18px 16px;
  border: 1px solid rgba(18, 43, 57, 0.08);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(247, 243, 236, 0.88) 100%);
  color: #51636d;
  text-align: left;
  box-shadow: 0 18px 36px rgba(18, 43, 57, 0.05);
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.auth-strategy-pill:hover {
  transform: translateY(-2px);
  border-color: rgba(23, 56, 74, 0.2);
  box-shadow: 0 24px 42px rgba(18, 43, 57, 0.08);
}

.auth-strategy-pill.is-active {
  border-color: rgba(23, 56, 74, 0.22);
  background:
    linear-gradient(135deg, rgba(23, 56, 74, 0.95) 0%, rgba(39, 79, 99, 0.92) 100%);
  box-shadow: 0 26px 52px rgba(12, 26, 35, 0.18);
}

.auth-strategy-pill__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.auth-strategy-pill__head strong {
  color: #17384a;
  font-size: 15px;
}

.auth-strategy-pill__head span,
.auth-strategy-pill > span {
  font-size: 12px;
  line-height: 1.7;
}

.auth-strategy-pill__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(236, 245, 239, 0.92);
  color: #0d6e5c;
  font-weight: 700;
}

.auth-strategy-pill.is-active .auth-strategy-pill__head strong,
.auth-strategy-pill.is-active .auth-strategy-pill__head span,
.auth-strategy-pill.is-active > span {
  color: #eef4f7;
}

.auth-strategy-pill.is-active .auth-strategy-pill__badge {
  background: rgba(238, 244, 247, 0.16);
  color: #eef4f7;
}

.auth-strategy-picker :deep(.el-empty) {
  grid-column: 1 / -1;
  min-height: 180px;
  border: 1px dashed rgba(18, 43, 57, 0.18);
  border-radius: 22px;
}
</style>
