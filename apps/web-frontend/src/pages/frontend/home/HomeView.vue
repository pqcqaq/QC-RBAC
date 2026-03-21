<template>
  <div class="frontend-page">
    <HomeHero :console-target="consoleTarget" :console-label="consoleLabel" :signals="signals" />

    <section class="frontend-card intro-card">
      <span class="frontend-card__eyebrow">Why This Split Matters</span>
      <h2>先有清晰的结构，再有长期可维护的控制台。</h2>
      <p>
        公开前台承担认知建立、技术说明和入口引导；控制台承担高密度操作、权限控制和业务维护。
        这两块如果不拆开，最终往往会让路由、布局和页面职责都变得混乱。
      </p>
    </section>

    <HomeCapabilityGrid :cards="cards" />
    <HomeConsolePreview :highlights="highlights" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { capabilityCards, consoleHighlights, projectSignals } from '../frontend-content';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import HomeCapabilityGrid from './components/HomeCapabilityGrid.vue';
import HomeConsolePreview from './components/HomeConsolePreview.vue';
import HomeHero from './components/HomeHero.vue';

const auth = useAuthStore();
const menus = useMenuStore();
const signals = projectSignals.map((item) => ({ ...item }));
const cards = capabilityCards.map((item) => ({ ...item, bullets: [...item.bullets] }));
const highlights = consoleHighlights.map((item) => ({ ...item }));
const consoleTarget = computed(() => auth.isAuthenticated ? (menus.ready ? menus.homePath : '/console') : '/login');
const consoleLabel = computed(() => auth.isAuthenticated ? '直接进入控制台' : '登录后进入控制台');
</script>

<style scoped lang="scss">
.intro-card {
  max-width: 820px;
}

.intro-card h2 {
  font-size: clamp(26px, 3vw, 38px);
  line-height: 1.08;
}
</style>
