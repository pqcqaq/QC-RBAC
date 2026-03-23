<template>
  <section class="auth-access-panel">
    <div class="auth-access-panel__shell">
      <div class="auth-access-panel__topbar">
        <RouterLink to="/" class="auth-access-panel__back">返回首页</RouterLink>
        <span class="auth-access-panel__mark">控制台入口</span>
      </div>

      <div class="auth-access-panel__intro">
        <p class="auth-access-panel__eyebrow">{{ isLogin ? '欢迎回来' : '创建账号' }}</p>
        <h2>{{ isLogin ? '登录控制台' : '注册后进入控制台' }}</h2>
        <p class="auth-access-panel__copy">
          {{ isLogin ? '输入账号信息后继续。' : '填写基础信息后即可创建账号并进入系统。' }}
        </p>
      </div>

      <div class="auth-access-panel__surface">
        <Transition name="auth-panel-fade" mode="out-in">
          <div :key="currentTab" class="auth-access-panel__stack">
            <slot v-if="isLogin" name="login" />
            <slot v-else name="register" />
          </div>
        </Transition>
      </div>

      <button v-if="canSwap" type="button" class="auth-access-panel__swap" @click="toggleTab">
        {{ isLogin ? '没有账号？去注册' : '已有账号？去登录' }}
      </button>

      <div v-if="$slots.footer" class="auth-access-panel__footer">
        <slot name="footer" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  tab: string;
  canSwitchToLogin?: boolean;
  canSwitchToRegister?: boolean;
}>(), {
  canSwitchToLogin: true,
  canSwitchToRegister: true,
});

const emit = defineEmits<{
  'update:tab': [value: string];
}>();

const currentTab = computed({
  get: () => props.tab,
  set: (value: string) => emit('update:tab', value),
});
const isLogin = computed(() => currentTab.value === 'login');
const canSwap = computed(() => (isLogin.value ? props.canSwitchToRegister : props.canSwitchToLogin));

const toggleTab = () => {
  if (!canSwap.value) {
    return;
  }

  currentTab.value = isLogin.value ? 'register' : 'login';
};
</script>

<style scoped lang="scss">
.auth-access-panel {
  display: grid;
  align-items: center;
  min-height: 100vh;
  padding: 42px 40px;
  background:
    radial-gradient(circle at top center, rgba(var(--accent-rgb), 0.14), transparent 28%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-1) 96%, var(--surface-2)) 0%,
      color-mix(in srgb, var(--surface-2) 92%, var(--surface-3)) 100%
    );
}

.auth-access-panel__shell {
  display: grid;
  gap: 20px;
  width: min(100%, 540px);
  margin: 0 auto;
  padding: 28px;
  border: 1px solid var(--line-soft);
  border-radius: 32px;
  background: var(--surface-card-bg);
  box-shadow: var(--shadow-deep);
}

.auth-access-panel__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.auth-access-panel__back {
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 700;
}

.auth-access-panel__mark {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--surface-accent-soft);
  color: var(--ink-2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.auth-access-panel__intro {
  display: grid;
  gap: 8px;
}

.auth-access-panel__eyebrow {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.auth-access-panel__intro h2 {
  color: var(--ink-1);
  font-size: 34px;
  line-height: 1.02;
}

.auth-access-panel__copy {
  color: var(--ink-2);
  line-height: 1.75;
}

.auth-access-panel__surface {
  padding: 22px;
  border: 1px solid var(--line-soft);
  border-radius: 24px;
  background: var(--surface-float-bg);
}

.auth-access-panel__stack {
  display: grid;
  gap: 18px;
}

.auth-access-panel__swap {
  justify-self: center;
  border: none;
  background: none;
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 700;
}

.auth-access-panel__footer {
  display: grid;
  gap: 12px;
 }

.auth-panel-fade-enter-active,
.auth-panel-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.auth-panel-fade-enter-from,
.auth-panel-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
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

  .auth-access-panel__surface {
    padding: 18px;
  }
}

@media (max-width: 560px) {
  .auth-access-panel__topbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
