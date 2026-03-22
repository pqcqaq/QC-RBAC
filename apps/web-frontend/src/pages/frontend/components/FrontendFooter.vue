<template>
  <footer class="frontend-footer">
    <div class="frontend-footer__inner">
      <section class="frontend-footer__intro">
        <p class="frontend-footer__eyebrow">权限控制台</p>
        <h2>简洁的入口，明确的操作区。</h2>
        <p>
          首页用于概览和入口，控制台用于实际管理。路径简单，信息清楚，适合继续扩展。
        </p>
      </section>

      <section class="frontend-footer__links">
        <div>
          <span>页面</span>
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
        </div>

        <div>
          <span>入口</span>
          <RouterLink :to="consoleTarget">{{ consoleLabel }}</RouterLink>
          <RouterLink to="/login">登录页</RouterLink>
        </div>
      </section>
    </div>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  navItems: Array<{ label: string; to: string; eyebrow: string }>;
  consoleTarget: string;
  consoleLabel: string;
}>();
</script>

<style scoped lang="scss">
.frontend-footer {
  margin-top: 48px;
  border-top: 1px solid rgba(39, 61, 77, 0.1);
  background:
    radial-gradient(circle at bottom right, rgba(43, 91, 112, 0.12), transparent 26%),
    linear-gradient(180deg, rgba(255, 249, 242, 0.54) 0%, rgba(239, 233, 224, 0.86) 100%);
}

.frontend-footer__inner {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 28px;
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 40px 0 56px;
}

.frontend-footer__intro {
  display: grid;
  gap: 12px;
}

.frontend-footer__eyebrow {
  margin: 0;
  color: #6d7a80;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.26em;
  text-transform: uppercase;
}

.frontend-footer__intro h2 {
  max-width: 680px;
  color: #17384a;
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1.1;
}

.frontend-footer__intro p:last-child {
  max-width: 680px;
  margin: 0;
  color: #51656f;
  line-height: 1.8;
}

.frontend-footer__links {
  display: grid;
  gap: 20px;
}

.frontend-footer__links div {
  display: grid;
  gap: 10px;
  padding: 18px 20px;
  border: 1px solid rgba(39, 61, 77, 0.08);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.58);
}

.frontend-footer__links span {
  color: #6d7a80;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.frontend-footer__links a {
  color: #17384a;
  font-weight: 700;
}

@media (max-width: 900px) {
  .frontend-footer__inner {
    grid-template-columns: 1fr;
  }
}
</style>
