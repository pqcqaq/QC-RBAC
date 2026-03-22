<template>
  <section class="frontend-page__section-grid">
    <article class="frontend-card principle-panel">
      <span class="frontend-card__eyebrow">页面约定</span>
      <h2>信息分层更清楚，操作入口更直接。</h2>

      <ol class="principle-list">
        <li v-for="item in principles" :key="item">{{ item }}</li>
      </ol>
    </article>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  principles: string[];
}>();
</script>

<style scoped lang="scss">
.principle-panel {
  grid-column: span 12;
}

.principle-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding-left: 20px;
  color: #576972;
}

.principle-list li {
  line-height: 1.8;
}
</style>
