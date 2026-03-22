<template>
  <section class="auth-access-panel">
    <div class="auth-access-panel__shell">
      <div class="auth-access-panel__topbar">
        <RouterLink to="/" class="auth-access-panel__back">返回首页</RouterLink>
        <span class="auth-access-panel__mark">控制台入口</span>
      </div>

      <div class="auth-access-panel__switch" role="tablist" aria-label="认证模式切换">
        <button
          type="button"
          class="auth-access-panel__switch-button"
          :class="{ 'is-active': currentTab === 'login' }"
          :aria-selected="currentTab === 'login'"
          @click="currentTab = 'login'"
        >
          登录
        </button>
        <button
          type="button"
          class="auth-access-panel__switch-button"
          :class="{ 'is-active': currentTab === 'register' }"
          :aria-selected="currentTab === 'register'"
          @click="currentTab = 'register'"
        >
          注册
        </button>
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

      <button type="button" class="auth-access-panel__swap" @click="toggleTab">
        {{ isLogin ? '没有账号？去注册' : '已有账号？去登录' }}
      </button>
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
const isLogin = computed(() => currentTab.value === 'login');

const toggleTab = () => {
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
    radial-gradient(circle at top center, rgba(255, 255, 255, 0.82), transparent 26%),
    linear-gradient(180deg, #f4efe8 0%, #eee5d8 100%);
}

.auth-access-panel__shell {
  display: grid;
  gap: 20px;
  width: min(100%, 540px);
  margin: 0 auto;
  padding: 28px;
  border: 1px solid rgba(19, 42, 57, 0.08);
  border-radius: 32px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 245, 239, 0.98) 100%);
  box-shadow: 0 34px 80px rgba(21, 38, 50, 0.13);
}

.auth-access-panel__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.auth-access-panel__back {
  color: #375a6d;
  font-size: 13px;
  font-weight: 700;
}

.auth-access-panel__mark {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(23, 56, 74, 0.06);
  color: #556973;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.auth-access-panel__switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 6px;
  border-radius: 18px;
  background: rgba(23, 56, 74, 0.06);
}

.auth-access-panel__switch-button {
  min-height: 42px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: #697a82;
  font-size: 14px;
  font-weight: 700;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.auth-access-panel__switch-button:hover {
  color: #17384a;
}

.auth-access-panel__switch-button.is-active {
  background: linear-gradient(135deg, #17384a 0%, #2d627b 100%);
  color: #f7f3ec;
  box-shadow: 0 14px 28px rgba(23, 56, 74, 0.18);
}

.auth-access-panel__intro {
  display: grid;
  gap: 8px;
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
  line-height: 1.75;
}

.auth-access-panel__surface {
  padding: 22px;
  border: 1px solid rgba(18, 43, 57, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
}

.auth-access-panel__stack {
  display: grid;
  gap: 18px;
}

.auth-access-panel__swap {
  justify-self: center;
  border: none;
  background: none;
  color: #375a6d;
  font-size: 13px;
  font-weight: 700;
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
