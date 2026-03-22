<template>
  <section class="auth-showcase-panel">
    <div class="auth-showcase-panel__inner">
      <div class="auth-showcase-panel__masthead">
        <span class="auth-showcase-panel__eyebrow">权限控制台</span>
        <h1>清晰的入口，专注的管理体验。</h1>
        <p>
          进入系统后统一管理用户、角色、权限、菜单和审计信息，页面会按当前权限自动展开。
        </p>
      </div>

      <div class="auth-showcase-panel__matrix">
        <article v-for="item in capabilityItems" :key="item.title" class="auth-showcase-panel__signal">
          <strong>{{ item.title }}</strong>
          <small>{{ item.copy }}</small>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  capabilityItems: Array<{ title: string; copy: string }>;
}>();
</script>

<style scoped lang="scss">
.auth-showcase-panel {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  color: #eef4f7;
  background:
    radial-gradient(circle at top left, rgba(113, 160, 185, 0.3), transparent 24%),
    radial-gradient(circle at bottom right, rgba(208, 177, 111, 0.18), transparent 22%),
    linear-gradient(160deg, #0d1c27 0%, #102737 42%, #17384a 100%);
}

.auth-showcase-panel::before,
.auth-showcase-panel::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.auth-showcase-panel::before {
  top: 40px;
  right: 52px;
  width: 220px;
  height: 220px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 36px;
  transform: rotate(14deg);
}

.auth-showcase-panel::after {
  bottom: -80px;
  left: -48px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, transparent 68%);
}

.auth-showcase-panel__inner {
  position: relative;
  z-index: 1;
  display: grid;
  align-content: center;
  gap: 34px;
  min-height: 100vh;
  padding: 72px 76px;
}

.auth-showcase-panel__masthead {
  display: grid;
  gap: 18px;
  max-width: 680px;
}

.auth-showcase-panel__eyebrow {
  color: rgba(238, 244, 247, 0.7);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.34em;
  text-transform: uppercase;
}

.auth-showcase-panel__masthead h1 {
  font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', 'STSong', serif;
  font-size: clamp(42px, 5vw, 70px);
  font-weight: 700;
  line-height: 0.98;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.auth-showcase-panel__masthead p {
  max-width: 560px;
  color: rgba(238, 244, 247, 0.78);
  font-size: 15px;
  line-height: 1.85;
}

.auth-showcase-panel__matrix {
  display: grid;
  gap: 14px;
  max-width: 560px;
}

.auth-showcase-panel__signal {
  display: grid;
  gap: 8px;
  padding: 20px 22px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(14px);
}

.auth-showcase-panel__signal strong {
  color: #f8fbfd;
  font-size: 18px;
  line-height: 1.2;
}

.auth-showcase-panel__signal small {
  color: rgba(238, 244, 247, 0.74);
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 1120px) {
  .auth-showcase-panel,
  .auth-showcase-panel__inner {
    min-height: auto;
  }

  .auth-showcase-panel__inner {
    padding: 34px 28px 24px;
  }
}
</style>
