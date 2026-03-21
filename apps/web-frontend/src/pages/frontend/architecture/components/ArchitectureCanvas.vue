<template>
  <section class="frontend-page__section-grid">
    <article v-for="item in layers" :key="item.title" class="frontend-card architecture-layer">
      <span class="frontend-card__eyebrow">{{ item.title }}</span>
      <h3>{{ item.summary }}</h3>
      <ul class="architecture-points">
        <li v-for="detail in item.details" :key="detail">{{ detail }}</li>
      </ul>
    </article>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  layers: Array<{ title: string; summary: string; details: string[] }>;
}>();
</script>

<style scoped lang="scss">
.architecture-layer {
  grid-column: span 6;
}

.architecture-points {
  display: grid;
  gap: 8px;
  padding-left: 18px;
  margin: 0;
  color: #576972;
}

.architecture-points li {
  line-height: 1.75;
}

@media (max-width: 900px) {
  .architecture-layer {
    grid-column: auto;
  }
}
</style>
