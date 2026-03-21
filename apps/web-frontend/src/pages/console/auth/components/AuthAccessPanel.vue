<template>
  <section class="auth-access-panel">
    <div class="auth-access-panel__shell">
      <div class="auth-access-panel__topbar">
        <RouterLink to="/" class="auth-access-panel__back">返回项目前台</RouterLink>
        <div class="auth-access-panel__chips">
          <span>策略驱动</span>
          <span>客户端校验</span>
          <span>RBAC Console</span>
        </div>
      </div>

      <div class="auth-access-panel__intro">
        <p class="auth-access-panel__eyebrow">Secure Entry</p>
        <h2>登录与注册</h2>
        <p class="auth-access-panel__copy">
          选择当前启用的认证策略后继续。右侧只负责进入系统，认证规则本身由后端维护。
        </p>
      </div>

      <el-tabs v-model="currentTab" class="auth-access-panel__tabs">
        <el-tab-pane label="登录" name="login">
          <div class="auth-access-panel__stack">
            <slot name="login" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <div class="auth-access-panel__stack">
            <slot name="register" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  tab: string;
}>();

const emit = defineEmits<{
  'update:tab': [value: string];
}>();

const currentTab = computed({
  get: () => props.tab,
  set: (value: string) => emit('update:tab', value),
});
</script>

<style scoped lang="scss">
.auth-access-panel {
  display: grid;
  align-items: center;
  min-height: 100vh;
  padding: 42px 36px;
  background:
    radial-gradient(circle at top center, rgba(255, 255, 255, 0.72), transparent 22%),
    linear-gradient(180deg, #f4efe8 0%, #efe7dc 100%);
}

.auth-access-panel__shell {
  display: grid;
  gap: 22px;
  width: min(100%, 560px);
  margin: 0 auto;
  padding: 28px;
  border: 1px solid rgba(19, 42, 57, 0.08);
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 247, 241, 0.98) 100%);
  box-shadow: 0 30px 80px rgba(21, 38, 50, 0.12);
}

.auth-access-panel__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.auth-access-panel__back {
  color: #375a6d;
  font-size: 13px;
  font-weight: 700;
}

.auth-access-panel__chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.auth-access-panel__chips span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(23, 56, 74, 0.06);
  color: #4b6675;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.auth-access-panel__intro {
  display: grid;
  gap: 10px;
}

.auth-access-panel__eyebrow {
  color: #8a8f86;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.auth-access-panel__intro h2 {
  color: #122b39;
  font-size: 34px;
  line-height: 1.02;
}

.auth-access-panel__copy {
  color: #5d6e77;
  line-height: 1.8;
}

.auth-access-panel__stack {
  display: grid;
  gap: 18px;
  min-height: 430px;
}

.auth-access-panel__tabs :deep(.el-tabs__header) {
  margin-bottom: 18px;
}

.auth-access-panel__tabs :deep(.el-tabs__nav-wrap::after) {
  background: rgba(18, 43, 57, 0.08);
}

.auth-access-panel__tabs :deep(.el-tabs__item) {
  height: 42px;
  color: #6f7d84;
  font-size: 14px;
  font-weight: 700;
}

.auth-access-panel__tabs :deep(.el-tabs__item.is-active) {
  color: #17384a;
}

.auth-access-panel__tabs :deep(.el-tabs__active-bar) {
  height: 3px;
  border-radius: 999px;
}

@media (max-width: 1120px) {
  .auth-access-panel {
    min-height: auto;
    padding: 22px 18px 34px;
  }

  .auth-access-panel__shell {
    width: 100%;
    padding: 22px 18px;
    border-radius: 24px;
  }
}

@media (max-width: 640px) {
  .auth-access-panel__topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .auth-access-panel__chips {
    justify-content: flex-start;
  }
}
</style>
