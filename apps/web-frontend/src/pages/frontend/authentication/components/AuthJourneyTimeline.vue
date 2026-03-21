<template>
  <section class="frontend-page__section-grid">
    <article class="frontend-card journey-panel">
      <span class="frontend-card__eyebrow">Strategy Journey</span>
      <h2>前端只负责消费策略，不再自己发明认证流程。</h2>

      <div class="journey-list">
        <article v-for="(item, index) in items" :key="item.title" class="journey-item">
          <strong>{{ `0${index + 1}`.slice(-2) }}</strong>
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.body }}</p>
          </div>
        </article>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{ title: string; body: string }>;
}>();
</script>

<style scoped lang="scss">
.journey-panel {
  grid-column: span 12;
}

.journey-list {
  display: grid;
  gap: 14px;
}

.journey-item {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 14px;
  padding: 16px 0;
  border-top: 1px solid rgba(39, 61, 77, 0.08);
}

.journey-item:first-child {
  border-top: none;
  padding-top: 0;
}

.journey-item strong {
  display: inline-flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
  color: #17384a;
  font-size: 18px;
}

.journey-item div {
  display: grid;
  gap: 6px;
}
</style>
