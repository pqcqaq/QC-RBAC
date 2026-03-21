<template>
  <section class="frontend-page__section-grid">
    <article v-for="item in strategies" :key="item.code" class="frontend-card strategy-card">
      <span class="frontend-card__eyebrow">{{ item.code }}</span>
      <h3>{{ item.title }}</h3>
      <div class="strategy-meta">
        <span>{{ item.identifier }}</span>
        <span>{{ item.credential }}</span>
      </div>
      <p>{{ item.description }}</p>
    </article>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  strategies: Array<{
    title: string;
    code: string;
    identifier: string;
    credential: string;
    description: string;
  }>;
}>();
</script>

<style scoped lang="scss">
.strategy-card {
  grid-column: span 4;
}

.strategy-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.strategy-meta span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(23, 56, 74, 0.08);
  color: #284e61;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

@media (max-width: 900px) {
  .strategy-card {
    grid-column: auto;
  }
}
</style>
