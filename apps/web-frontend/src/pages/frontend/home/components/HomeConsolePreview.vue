<template>
  <section class="frontend-page__section-grid">
    <article class="frontend-card console-preview console-preview--lead">
      <span class="frontend-card__eyebrow">控制台</span>
      <h2>控制台聚焦实际管理。</h2>
      <p>
        页面内容围绕用户、角色、权限和审计，进入后就可以直接开始操作。
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

