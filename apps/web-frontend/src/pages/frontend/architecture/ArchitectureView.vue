<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">Architecture</p>
      <h1>路由分域之后，前台、控制台、认证入口终于各司其职。</h1>
      <p>
        这次调整的关键不只是把页面放进不同目录，而是把“默认访问者”和“已登录操作者”放进不同的路由空间里，
        让两类体验都能为自己的目标服务，而不是互相迁就。
      </p>
    </section>

    <ArchitectureCanvas :layers="layers" />
    <ArchitectureOperatingModel :principles="principles" />
  </div>
</template>

<script setup lang="ts">
import { architectureLayers, operatingPrinciples } from '../frontend-content';
import ArchitectureCanvas from './components/ArchitectureCanvas.vue';
import ArchitectureOperatingModel from './components/ArchitectureOperatingModel.vue';

const layers = architectureLayers.map((item) => ({ ...item, details: [...item.details] }));
const principles = [...operatingPrinciples];
</script>
