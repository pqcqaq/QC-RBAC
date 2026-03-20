<template>
  <div class="auth-layout">
    <section class="auth-showcase">
      <p class="hero-label">Enterprise RBAC Console</p>
      <h1>正式后台，不只是表格，更是权限治理工作台。</h1>
      <p class="auth-copy">
        用户、角色、权限、审计和实时协作被收束在同一套管理外壳里。Web 与 App 端共享同一套 DTO、
        请求适配器和双 token 会话逻辑。
      </p>

      <div class="auth-highlight-grid">
        <article class="auth-highlight">
          <span>DEFAULT ADMIN</span>
          <strong>admin@example.com</strong>
          <small>Admin123!</small>
        </article>
        <article class="auth-highlight">
          <span>STACK</span>
          <strong>Vue 3 + Vite 8</strong>
          <small>Element Plus / Pinia / Router / Prisma</small>
        </article>
      </div>
    </section>

    <section class="auth-panel">
      <p class="panel-caption">Access Portal</p>
      <h2 class="panel-heading panel-heading--xl">登录控制台</h2>

      <el-tabs v-model="tab">
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" label-position="top" @submit.prevent="submitLogin">
            <el-form-item label="账号">
              <el-input v-model="loginForm.account" placeholder="邮箱或用户名" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="loginForm.password" show-password placeholder="请输入密码" />
            </el-form-item>
            <el-button type="primary" style="width: 100%" @click="submitLogin" :loading="submitting">
              进入系统
            </el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <div class="form-grid">
            <el-form-item label="用户名">
              <el-input v-model="registerForm.username" />
            </el-form-item>
            <el-form-item label="昵称">
              <el-input v-model="registerForm.nickname" />
            </el-form-item>
            <el-form-item label="邮箱" class="full-span">
              <el-input v-model="registerForm.email" />
            </el-form-item>
            <el-form-item label="密码" class="full-span">
              <el-input v-model="registerForm.password" show-password />
            </el-form-item>
          </div>
          <el-button type="primary" style="width: 100%" @click="submitRegister" :loading="submitting">
            创建成员并登录
          </el-button>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();
const tab = ref('login');
const submitting = ref(false);

const loginForm = reactive({
  account: 'admin@example.com',
  password: 'Admin123!',
});

const registerForm = reactive({
  username: '',
  nickname: '',
  email: '',
  password: '',
});

const submitLogin = async () => {
  try {
    submitting.value = true;
    await auth.login(loginForm);
    ElMessage.success('登录成功');
    await router.push('/dashboard');
  } catch (error: any) {
    ElMessage.error(error?.message ?? '登录失败');
  } finally {
    submitting.value = false;
  }
};

const submitRegister = async () => {
  try {
    submitting.value = true;
    await auth.register(registerForm);
    ElMessage.success('注册成功');
    await router.push('/dashboard');
  } catch (error: any) {
    ElMessage.error(error?.message ?? '注册失败');
  } finally {
    submitting.value = false;
  }
};
</script>
