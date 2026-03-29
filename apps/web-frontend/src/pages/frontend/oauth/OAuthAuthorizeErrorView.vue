<template>
  <div class="frontend-page oauth-authorize-error-page">
    <section class="frontend-page__hero oauth-authorize-error-page__hero">
      <p class="frontend-page__eyebrow">OAuth 授权结果</p>
      <h1>授权未完成</h1>
      <p>{{ displayDescription }}</p>

      <div class="frontend-page__hero-actions">
        <RouterLink class="frontend-page__button is-secondary" to="/">回到首页</RouterLink>
        <RouterLink class="frontend-page__button is-primary" to="/login">前往登录</RouterLink>
      </div>
    </section>

    <section class="frontend-card oauth-authorize-error-page__card">
      <p class="frontend-card__eyebrow">错误信息</p>
      <h3>{{ displayError }}</h3>
      <p>如需继续，请从业务应用重新发起 OAuth 授权流程。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const displayError = computed(() => {
  const value = typeof route.query.error === 'string' ? route.query.error.trim() : '';
  return value || 'authorization_failed';
});

const displayDescription = computed(() => {
  const value = typeof route.query.error_description === 'string'
    ? route.query.error_description.trim()
    : '';
  return value || '授权流程未成功完成。';
});
</script>

<style scoped lang="scss">
.oauth-authorize-error-page {
  padding-bottom: 24px;
}

.oauth-authorize-error-page__hero h1 {
  margin: 0;
}

.oauth-authorize-error-page__card {
  gap: 10px;
  border-color: rgba(150, 70, 44, 0.18);
  background: rgba(255, 248, 244, 0.85);
}

.oauth-authorize-error-page__card h3 {
  margin: 0;
  color: #8a3b28;
}
</style>
