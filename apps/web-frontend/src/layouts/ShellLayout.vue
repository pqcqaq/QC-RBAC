<template>
  <el-container class="admin-shell" :class="`is-${workbench.layoutMode}`">
    <el-aside
      v-if="workbench.layoutMode === 'sidebar'"
      class="admin-shell__aside"
      width="248px"
    >
      <div class="admin-brand admin-brand--simple">
        <h1>管理后台</h1>
        <span>RBAC Control</span>
      </div>

      <el-scrollbar class="admin-shell__nav">
        <el-menu :default-active="route.path" class="admin-menu" router>
          <el-menu-item
            v-for="item in visibleItems"
            :key="item.path"
            :index="item.path"
          >
            <span class="menu-code">{{ item.code }}</span>
            <span class="menu-copy">
              <span class="menu-copy__title">{{ item.title }}</span>
              <small>{{ item.caption }}</small>
            </span>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <el-container class="admin-shell__body">
      <el-header class="admin-shell__header">
        <div class="shell-header__inner content-container">
          <div class="shell-header__left">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item>RBAC Control</el-breadcrumb-item>
              <el-breadcrumb-item>{{ pageMeta.title }}</el-breadcrumb-item>
            </el-breadcrumb>
            <div class="shell-title-row">
              <h2>{{ pageMeta.title }}</h2>
              <span class="header-subtitle">{{ pageMeta.caption }}</span>
            </div>
          </div>

          <div class="shell-header__right">
            <el-button plain @click="workbench.openSettings">设置</el-button>

            <el-upload
              v-if="canUploadAvatar"
              :show-file-list="false"
              :http-request="uploadAvatar"
              accept="image/*"
            >
              <el-button plain>头像</el-button>
            </el-upload>

            <el-dropdown trigger="click">
              <button class="header-user" type="button">
                <div v-if="auth.user?.avatar" class="user-avatar-frame">
                  <img :src="auth.user.avatar" alt="avatar" class="user-avatar" />
                </div>
                <div v-else class="user-avatar-fallback">
                  {{ userInitial }}
                </div>
                <span class="user-meta">
                  <span class="user-meta__name">{{ auth.user?.nickname }}</span>
                  <small>{{ auth.user?.roles.map((item) => item.name).join(' / ') }}</small>
                </span>
              </button>

              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="goDashboard">返回总览</el-dropdown-item>
                  <el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>

      <div v-if="workbench.layoutMode === 'tabs'" class="top-nav-strip">
        <div class="content-container">
          <el-scrollbar>
            <div class="top-nav-strip__list">
              <RouterLink
                v-for="item in visibleItems"
                :key="item.path"
                :to="item.path"
                class="top-nav-item"
                :class="{ 'is-active': route.path === item.path }"
              >
                <span>{{ item.code }}</span>
                <strong>{{ item.title }}</strong>
              </RouterLink>
            </div>
          </el-scrollbar>
        </div>
      </div>

      <WorkbenchTabs />

      <el-main class="admin-shell__main">
        <div class="content-container">
          <router-view v-slot="{ Component, route: currentRoute }">
            <keep-alive :include="workbench.cacheInclude">
              <component
                :is="Component"
                v-if="currentRoute.meta.keepAlive"
                :key="String(currentRoute.name)"
              />
            </keep-alive>
            <component
              :is="Component"
              v-if="!currentRoute.meta.keepAlive"
              :key="currentRoute.fullPath"
            />
          </router-view>
        </div>
      </el-main>

      <el-footer class="admin-shell__footer">
        <div class="content-container">
          <div class="footer-strip">
            <span>{{ activeTheme?.label ?? '默认主题' }}</span>
            <span>{{ workbench.layoutMode === 'sidebar' ? 'Sidebar' : 'Tabs' }} · {{ workbench.visitedTabs.length }} tabs</span>
            <span>{{ footerClock }}</span>
          </div>
        </div>
      </el-footer>
    </el-container>

    <WorkbenchSettings />
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { UploadProgressEvent, UploadRequestOptions } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import WorkbenchSettings from '@/components/workbench/WorkbenchSettings.vue';
import WorkbenchTabs from '@/components/workbench/WorkbenchTabs.vue';
import { pageRegistry, pageRegistryMap } from '@/meta/pages';
import { findThemePreset } from '@/themes';
import { uploadAvatarFile } from '@/utils/direct-upload';
import { useAuthStore } from '@/stores/auth';
import { useWorkbenchStore } from '@/stores/workbench';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const workbench = useWorkbenchStore();
const footerClock = ref(new Date().toLocaleString());

const visibleItems = computed(() => pageRegistry.filter((item) => auth.hasPermission(item.permission)));
const canUploadAvatar = computed(() => auth.hasPermission('file.upload'));
const userInitial = computed(() => (auth.user?.nickname?.slice(0, 1) ?? '?').toUpperCase());
const pageMeta = computed(() => pageRegistryMap[route.path] ?? {
  title: '控制台',
  caption: 'RBAC Admin',
});
const activeTheme = computed(() => findThemePreset(workbench.themePresetId));

let clockTimer: ReturnType<typeof setInterval> | null = null;

const tickClock = () => {
  footerClock.value = new Date().toLocaleString();
};

const goDashboard = async () => {
  await router.push('/dashboard');
};

const logout = async () => {
  await auth.logout();
  await router.push('/login');
};

const uploadAvatar = async (options: UploadRequestOptions) => {
  try {
    const result = await uploadAvatarFile(options.file, (percent) => {
      options.onProgress?.({ percent } as UploadProgressEvent);
    });
    await auth.syncCurrentUser();
    ElMessage.success('头像已更新');
    options.onSuccess?.({ ok: true, url: result.url });
  } catch (error: any) {
    ElMessage.error(error?.message ?? '头像上传失败');
    options.onError?.(error);
  }
};

onMounted(() => {
  tickClock();
  clockTimer = setInterval(tickClock, 60_000);
});

onUnmounted(() => {
  if (clockTimer) {
    clearInterval(clockTimer);
  }
});
</script>
