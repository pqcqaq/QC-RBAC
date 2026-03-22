<template>
  <section class="auth-oauth-providers">
    <p class="auth-oauth-providers__title">使用第三方登录</p>

    <div class="auth-oauth-providers__list">
      <button
        v-for="provider in providers"
        :key="provider.id"
        type="button"
        class="auth-oauth-providers__item"
        :disabled="loading"
        :title="provider.name"
        @click="$emit('select', provider.code)"
      >
        <img
          v-if="provider.logoUrl"
          :src="provider.logoUrl"
          :alt="provider.name"
          class="auth-oauth-providers__logo"
        />
        <span v-else class="auth-oauth-providers__fallback">{{ provider.name.slice(0, 1) }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { OAuthProviderPublicSummary } from '@rbac/api-common';

defineProps<{
  providers: OAuthProviderPublicSummary[];
  loading?: boolean;
}>();

defineEmits<{
  select: [providerCode: string];
}>();
</script>

<style scoped lang="scss">
.auth-oauth-providers {
  display: grid;
  gap: 12px;
}

.auth-oauth-providers__title {
  color: #7a818a;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
}

.auth-oauth-providers__list {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.auth-oauth-providers__item {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(18, 43, 57, 0.1);
  border-radius: 14px;
  background: #fff;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.auth-oauth-providers__item:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(18, 43, 57, 0.18);
  box-shadow: 0 12px 24px rgba(17, 24, 39, 0.08);
}

.auth-oauth-providers__item:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.auth-oauth-providers__logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.auth-oauth-providers__fallback {
  color: #1f2937;
  font-size: 15px;
  font-weight: 700;
}
</style>
