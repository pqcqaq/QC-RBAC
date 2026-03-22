<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">系统结构</p>
      <h1>页面结构更清晰，入口更直接。</h1>
      <p>
        公开页面负责概览和入口，认证页负责登录与注册，控制台负责业务操作。不同场景各自独立，使用起来更直接。
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

