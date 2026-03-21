<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">Authentication</p>
      <h1>同一个登录页，只是策略的承载体，不再是认证规则本身。</h1>
      <p>
        后端决定启用什么策略、如何发送验证码、是否允许 mock、如何写认证记录；
        前端负责读取这些策略并渲染合适的交互。这样登录与注册不再是硬编码页面，而是一个可持续扩展的认证入口。
      </p>
    </section>

    <AuthStrategyDeck :strategies="strategies" />
    <AuthJourneyTimeline :items="journey" />
  </div>
</template>

<script setup lang="ts">
import { authJourney, authStrategies } from '../frontend-content';
import AuthJourneyTimeline from './components/AuthJourneyTimeline.vue';
import AuthStrategyDeck from './components/AuthStrategyDeck.vue';

const strategies = authStrategies.map((item) => ({ ...item }));
const journey = authJourney.map((item) => ({ ...item }));
</script>
