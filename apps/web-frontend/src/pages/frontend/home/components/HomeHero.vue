<template>
  <section class="frontend-page__hero">
    <p class="frontend-page__eyebrow">Public Frontend</p>
    <h1>让默认 / 负责表达产品，让 /console 只负责工作台。</h1>
    <p>
      这个项目不再把用户一进站点就直接扔进后台壳子里。公开前台先解释系统边界、认证策略和控制台能力，
      真正需要操作的人再进入控制台，这样路由语义、用户预期和后续扩展都会更干净。
    </p>

    <div class="frontend-page__hero-actions">
      <RouterLink class="frontend-page__button is-primary" :to="consoleTarget">{{ consoleLabel }}</RouterLink>
      <RouterLink class="frontend-page__button is-secondary" to="/architecture">查看架构拆分</RouterLink>
    </div>

    <div class="hero-signal-grid">
      <article v-for="item in signals" :key="item.label" class="hero-signal">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.note }}</small>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  consoleTarget: string;
  consoleLabel: string;
  signals: Array<{ label: string; value: string; note: string }>;
}>();
</script>

<style scoped lang="scss">
.hero-signal-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 8px;
}

.hero-signal {
  display: grid;
  gap: 8px;
  padding: 18px;
  border: 1px solid rgba(39, 61, 77, 0.08);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.62);
}

.hero-signal span {
  color: #7a8b92;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-signal strong {
  color: #17384a;
  font-size: 28px;
  line-height: 1;
}

.hero-signal small {
  color: #586a73;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .hero-signal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
