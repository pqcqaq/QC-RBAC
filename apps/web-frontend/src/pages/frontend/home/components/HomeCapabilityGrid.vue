<template>
  <div class="frontend-page__section-grid">
    <article v-for="item in cards" :key="item.title" class="frontend-card capability-card">
      <span class="frontend-card__eyebrow">{{ item.eyebrow }}</span>
      <h3>{{ item.title }}</h3>
      <p>{{ item.description }}</p>

      <ul class="capability-list">
        <li v-for="bullet in item.bullets" :key="bullet">{{ bullet }}</li>
      </ul>
    </article>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  cards: Array<{ title: string; eyebrow: string; description: string; bullets: string[] }>;
}>();
</script>

<style scoped lang="scss">
.capability-card {
  grid-column: span 4;
}

.capability-list {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.capability-list li {
  position: relative;
  padding-left: 16px;
  color: #576972;
  line-height: 1.7;
}

.capability-list li::before {
  content: '';
  position: absolute;
  top: 10px;
  left: 0;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #2d627b;
}

@media (max-width: 900px) {
  .capability-card {
    grid-column: auto;
  }
}
</style>
