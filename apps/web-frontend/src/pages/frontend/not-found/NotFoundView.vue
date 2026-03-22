<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">页面不存在</p>
      <h1>当前页面不存在。</h1>
      <p>请返回首页，或通过下方入口进入控制台。</p>

      <div class="frontend-page__hero-actions">
        <RouterLink class="frontend-page__button is-primary" :to="consoleTarget">{{ consoleLabel }}</RouterLink>
        <RouterLink class="frontend-page__button is-secondary" to="/">回到首页</RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';

const auth = useAuthStore();
const menus = useMenuStore();
const consoleTarget = computed(() => auth.isAuthenticated ? (menus.ready ? menus.homePath : '/console') : '/login');
const consoleLabel = computed(() => auth.isAuthenticated ? '返回控制台' : '登录控制台');
</script>
