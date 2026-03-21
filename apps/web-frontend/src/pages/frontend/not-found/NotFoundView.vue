<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">Not Found</p>
      <h1>这个地址不在当前前台或控制台路由结构里。</h1>
      <p>
        如果你要进入管理控制台，请从下方入口进入；如果只是想继续了解项目，可以返回首页查看前台介绍页。
      </p>

      <div class="frontend-page__hero-actions">
        <RouterLink class="frontend-page__button is-primary" :to="consoleTarget">{{ consoleLabel }}</RouterLink>
        <RouterLink class="frontend-page__button is-secondary" to="/">回到项目首页</RouterLink>
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
const consoleLabel = computed(() => auth.isAuthenticated ? '返回控制台' : '去登录');
</script>
