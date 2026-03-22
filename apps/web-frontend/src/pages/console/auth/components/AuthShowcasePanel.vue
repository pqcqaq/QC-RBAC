<template>
  <section class="auth-showcase-panel">
    <div class="auth-showcase-panel__inner">
      <div class="auth-showcase-panel__masthead">
        <span class="auth-showcase-panel__eyebrow">控制台登录</span>
        <h1>欢迎使用权限控制台</h1>
        <p>
          登录后可管理用户、角色、权限和审计信息。
        </p>
      </div>

      <div class="auth-showcase-panel__matrix">
        <article v-for="item in capabilityItems" :key="item.title" class="auth-showcase-panel__signal">
          <span>{{ item.eyebrow }}</span>
          <strong>{{ item.title }}</strong>
          <small>{{ item.copy }}</small>
        </article>
      </div>

      <div class="auth-showcase-panel__brief">
        <div class="auth-showcase-panel__brief-head">
          <span>演示信息</span>
          <strong>本地测试可用</strong>
        </div>

        <div class="auth-showcase-panel__brief-grid">
          <article v-for="item in credentialItems" :key="item.label" class="auth-showcase-panel__credential">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.note }}</small>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  capabilityItems: Array<{ eyebrow: string; title: string; copy: string }>;
  credentialItems: Array<{ label: string; value: string; note: string }>;
}>();
</script>

<style scoped lang="scss">
.auth-showcase-panel {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  color: #eef4f7;
  background:
    radial-gradient(circle at top left, rgba(113, 160, 185, 0.34), transparent 24%),
    radial-gradient(circle at bottom right, rgba(208, 177, 111, 0.2), transparent 22%),
    linear-gradient(160deg, #0d1c27 0%, #102737 42%, #17384a 100%);
}

.auth-showcase-panel::before,
.auth-showcase-panel::after {
  content: '';
  position: absolute;
  inset: auto;
  pointer-events: none;
}

.auth-showcase-panel::before {
  top: 28px;
  right: 40px;
  width: 220px;
  height: 220px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 32px;
  transform: rotate(18deg);
}

.auth-showcase-panel::after {
  bottom: -60px;
  left: -40px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, transparent 68%);
}

.auth-showcase-panel__inner {
  position: relative;
  z-index: 1;
  display: grid;
  align-content: center;
  gap: 30px;
  min-height: 100vh;
  padding: 64px 72px;
}

.auth-showcase-panel__masthead {
  display: grid;
  gap: 18px;
  max-width: 760px;
}

.auth-showcase-panel__eyebrow {
  color: rgba(238, 244, 247, 0.68);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.34em;
  text-transform: uppercase;
}

.auth-showcase-panel__masthead h1 {
  font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', 'STSong', serif;
  font-size: clamp(44px, 5vw, 72px);
  font-weight: 700;
  line-height: 0.96;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.auth-showcase-panel__masthead p {
  max-width: 620px;
  color: rgba(238, 244, 247, 0.8);
  font-size: 15px;
  line-height: 1.9;
}

.auth-showcase-panel__matrix {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.auth-showcase-panel__signal,
.auth-showcase-panel__credential {
  display: grid;
  gap: 10px;
  padding: 20px 22px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(16px);
}

.auth-showcase-panel__signal span,
.auth-showcase-panel__brief-head span,
.auth-showcase-panel__credential span {
  color: rgba(238, 244, 247, 0.62);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.auth-showcase-panel__signal strong,
.auth-showcase-panel__credential strong {
  color: #f8fbfd;
  font-size: 20px;
  line-height: 1.2;
}

.auth-showcase-panel__signal small,
.auth-showcase-panel__credential small {
  color: rgba(238, 244, 247, 0.74);
  font-size: 13px;
  line-height: 1.75;
}

.auth-showcase-panel__brief {
  display: grid;
  gap: 16px;
  padding: 22px 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 28px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
  box-shadow: 0 28px 56px rgba(2, 9, 15, 0.18);
}

.auth-showcase-panel__brief-head {
  display: grid;
  gap: 6px;
}

.auth-showcase-panel__brief-head strong {
  font-size: 22px;
}

.auth-showcase-panel__brief-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 1120px) {
  .auth-showcase-panel,
  .auth-showcase-panel__inner {
    min-height: auto;
  }

  .auth-showcase-panel__inner {
    padding: 36px 28px 26px;
  }
}

@media (max-width: 840px) {
  .auth-showcase-panel__matrix,
  .auth-showcase-panel__brief-grid {
    grid-template-columns: 1fr;
  }
}
</style>
