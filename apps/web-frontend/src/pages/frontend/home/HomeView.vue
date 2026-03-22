<template>
  <div class="frontend-page">
    <HomeHero :console-target="consoleTarget" :console-label="consoleLabel" :signals="signals" />

    <section class="frontend-card intro-card">
      <span class="frontend-card__eyebrow">使用方式</span>
      <h2>首页看概览，控制台做操作。</h2>
      <p>
        公开页面用于说明系统和提供入口，控制台用于实际管理。信息更少，路径更清楚，操作也更直接。
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
const consoleLabel = computed(() => auth.isAuthenticated ? '进入控制台' : '登录控制台');
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
