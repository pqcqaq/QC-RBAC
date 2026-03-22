<template>
  <header class="frontend-header">
    <div class="frontend-header__inner">
      <RouterLink to="/" class="frontend-brand">
        <span class="frontend-brand__mark">RB</span>
        <span class="frontend-brand__copy">
          <strong>权限控制台</strong>
          <small>访问管理示例</small>
        </span>
      </RouterLink>

      <nav class="frontend-nav" aria-label="介绍页面导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="frontend-nav__item"
          :class="{ 'is-active': route.path === item.to }"
        >
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="frontend-header__actions">
        <span v-if="userLabel" class="frontend-user-badge">{{ userLabel }}</span>
        <RouterLink class="frontend-console-link" :to="consoleTarget">
          {{ consoleLabel }}
        </RouterLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

defineProps<{
  navItems: Array<{ label: string; to: string; eyebrow: string }>;
  consoleTarget: string;
  consoleLabel: string;
  userLabel: string;
}>();

const route = useRoute();
</script>

<style scoped lang="scss">
.frontend-header {
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(18px);
  background: rgba(247, 243, 236, 0.72);
  border-bottom: 1px solid rgba(39, 61, 77, 0.08);
}

.frontend-header__inner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 20px;
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 18px 0;
}

.frontend-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: #17384a;
}

.frontend-brand__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(145deg, #17384a 0%, #2e5d76 100%);
  color: #f7f3ec;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.frontend-brand__copy {
  display: grid;
  gap: 2px;
}

.frontend-brand__copy strong {
  font-size: 16px;
}

.frontend-brand__copy small {
  color: #6c7d86;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.frontend-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.frontend-nav__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 92px;
  padding: 10px 14px;
  border-radius: 16px;
  color: #445963;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.frontend-nav__item span {
  font-size: 13px;
  font-weight: 700;
}

.frontend-nav__item:hover,
.frontend-nav__item.is-active {
  background: rgba(23, 56, 74, 0.08);
  color: #17384a;
  transform: translateY(-1px);
}

.frontend-header__actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.frontend-user-badge {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.66);
  color: #445963;
  font-size: 12px;
  font-weight: 700;
}

.frontend-console-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, #17384a 0%, #2d627b 100%);
  color: #f8f4ed;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 18px 36px rgba(23, 56, 74, 0.18);
}

@media (max-width: 980px) {
  .frontend-header__inner {
    grid-template-columns: 1fr;
  }

  .frontend-nav {
    justify-content: flex-start;
  }

  .frontend-header__actions {
    justify-content: flex-start;
  }
}
</style>
