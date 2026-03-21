<template>
  <section class="frontend-page__section-grid">
    <article class="frontend-card console-preview console-preview--lead">
      <span class="frontend-card__eyebrow">Console Preview</span>
      <h2>控制台仍然是系统核心，但它不应该承担“项目介绍页”的职责。</h2>
      <p>
        当默认 / 负责解释系统是什么、能做什么、为什么这样设计之后，控制台本身就可以更专注于操作密度、
        权限边界和工作流效率。
      </p>
    </article>

    <article v-for="item in highlights" :key="item.title" class="frontend-card console-preview">
      <h3>{{ item.title }}</h3>
      <p>{{ item.description }}</p>
    </article>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  highlights: Array<{ title: string; description: string }>;
}>();
</script>

<style scoped lang="scss">
.console-preview--lead {
  grid-column: span 5;
  background: linear-gradient(145deg, rgba(23, 56, 74, 0.94) 0%, rgba(45, 98, 123, 0.9) 100%);
}

.console-preview--lead,
.console-preview--lead h2,
.console-preview--lead p {
  color: #f8f4ed;
}

.console-preview:not(.console-preview--lead) {
  grid-column: span 7;
}

@media (max-width: 900px) {
  .console-preview--lead,
  .console-preview:not(.console-preview--lead) {
    grid-column: auto;
  }
}
</style>
