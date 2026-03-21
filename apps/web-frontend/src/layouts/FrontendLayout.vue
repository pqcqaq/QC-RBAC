<template>
  <div class="frontend-shell">
    <FrontendHeader
      :nav-items="navItems"
      :console-target="consoleTarget"
      :console-label="consoleLabel"
      :user-label="userLabel"
    />

    <main class="frontend-shell__main">
      <RouterView />
    </main>

    <FrontendFooter
      :nav-items="navItems"
      :console-target="consoleTarget"
      :console-label="consoleLabel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FrontendFooter from '@/pages/frontend/components/FrontendFooter.vue';
import FrontendHeader from '@/pages/frontend/components/FrontendHeader.vue';
import { frontendNavItems } from '@/pages/frontend/frontend-content';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';

const auth = useAuthStore();
const menus = useMenuStore();
const navItems = frontendNavItems.map((item) => ({ ...item }));
const consoleTarget = computed(() => {
  if (!auth.isAuthenticated) {
    return '/login';
  }

  return menus.ready ? menus.homePath : '/console';
});
const consoleLabel = computed(() => auth.isAuthenticated ? '进入控制台' : '登录控制台');
const userLabel = computed(() => auth.isAuthenticated ? `当前用户 · ${auth.user?.nickname ?? auth.user?.username ?? '已登录'}` : '');
</script>

<style scoped lang="scss">
.frontend-shell {
  min-height: 100vh;
  color: #17384a;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.82), transparent 28%),
    radial-gradient(circle at top right, rgba(242, 225, 187, 0.28), transparent 24%),
    linear-gradient(180deg, #f7f3ec 0%, #f2ede4 48%, #ece5da 100%);
}

.frontend-shell__main {
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding-top: 28px;
}

:deep(.frontend-page) {
  display: grid;
  gap: 24px;
}

:deep(.frontend-page__hero) {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 18px;
  padding: 32px;
  border: 1px solid rgba(39, 61, 77, 0.1);
  border-radius: 34px;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.76), transparent 30%),
    linear-gradient(135deg, rgba(255, 252, 247, 0.94) 0%, rgba(240, 231, 220, 0.84) 100%);
  box-shadow: 0 28px 64px rgba(34, 44, 57, 0.08);
}

:deep(.frontend-page__eyebrow) {
  margin: 0;
  color: #6d7a80;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

:deep(.frontend-page__hero h1) {
  max-width: 760px;
  font-size: clamp(34px, 5vw, 62px);
  line-height: 0.98;
}

:deep(.frontend-page__hero p) {
  max-width: 720px;
  margin: 0;
  color: #51656f;
  font-size: 15px;
  line-height: 1.85;
}

:deep(.frontend-page__hero-actions) {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
}

:deep(.frontend-page__button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  font-weight: 700;
}

:deep(.frontend-page__button.is-primary) {
  background: linear-gradient(135deg, #17384a 0%, #2d627b 100%);
  color: #f8f4ed;
}

:deep(.frontend-page__button.is-secondary) {
  border: 1px solid rgba(39, 61, 77, 0.12);
  background: rgba(255, 255, 255, 0.74);
  color: #17384a;
}

:deep(.frontend-page__section-grid) {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(12, minmax(0, 1fr));
}

:deep(.frontend-card) {
  display: grid;
  gap: 12px;
  padding: 22px;
  border: 1px solid rgba(39, 61, 77, 0.08);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 20px 44px rgba(32, 41, 54, 0.06);
}

:deep(.frontend-card__eyebrow) {
  color: #7b8a90;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

:deep(.frontend-card h2),
:deep(.frontend-card h3) {
  color: #17384a;
}

:deep(.frontend-card p) {
  margin: 0;
  color: #576972;
  line-height: 1.75;
}

@media (max-width: 900px) {
  .frontend-shell__main {
    padding-top: 20px;
  }

  :deep(.frontend-page__hero) {
    padding: 24px;
    border-radius: 26px;
  }

  :deep(.frontend-page__section-grid) {
    grid-template-columns: 1fr;
  }
}
</style>
