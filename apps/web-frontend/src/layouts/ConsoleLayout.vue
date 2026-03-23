<template>
  <el-container
    class="admin-shell"
    :class="[
      `is-${workbench.layoutMode}`,
      {
        'is-sidebar-collapsed': isSidebarCollapsed,
        'is-sidebar-compact': isCompactViewport,
      },
    ]"
  >
    <el-aside
      v-if="workbench.layoutMode === 'sidebar'"
      class="admin-shell__aside"
      :class="{
        'is-collapsed': isSidebarCollapsed,
        'is-compact': isCompactViewport,
      }"
      :width="sidebarWidth"
    >
      <div class="admin-brand admin-brand--simple">
        <div class="admin-brand__copy">
          <h1>管理后台</h1>
          <span>RBAC Control</span>
        </div>

        <button
          class="admin-brand__toggle"
          type="button"
          :title="sidebarToggleTitle"
          :aria-label="sidebarToggleTitle"
          @click="handleSidebarToggle"
        >
          <UnoIcon :name="isSidebarCollapsed ? 'i-carbon-chevron-right' : 'i-carbon-chevron-left'" :size="18" />
        </button>
      </div>

      <el-scrollbar class="admin-shell__nav">
        <el-menu
          :default-active="route.path"
          :collapse="isSidebarCollapsed"
          :collapse-transition="false"
          class="admin-menu"
          router
        >
          <MenuTreeNav :items="navigationItems" />
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <el-container class="admin-shell__body">
      <el-header class="admin-shell__header" height="auto">
        <div
          class="shell-header__panel content-container"
          :class="{ 'has-secondary-nav': hasSecondaryNav }"
        >
          <div class="shell-header__inner">
            <div class="shell-header__left">
              <el-breadcrumb separator="/">
                <el-breadcrumb-item>RBAC Control</el-breadcrumb-item>
                <el-breadcrumb-item
                  v-for="item in breadcrumbs"
                  :key="item.id"
                >
                  {{ item.title }}
                </el-breadcrumb-item>
              </el-breadcrumb>
              <div class="shell-title-row">
                <h2>{{ pageMeta.title }}</h2>
              </div>
              <p v-if="pageMeta.description" class="header-description">
                {{ pageMeta.description }}
              </p>
            </div>

            <div class="shell-header__right">
              <input
                ref="avatarInputRef"
                class="header-avatar-input"
                type="file"
                accept="image/*"
                @change="handleAvatarInputChange"
              >

              <ThemeModeSwitch
                :model-value="workbench.themeMode"
                :resolved-mode="workbench.resolvedThemeMode"
                size="compact"
                @select="handleThemeModeSelect"
              />

              <button class="header-icon-button" type="button" title="工作台设置" @click="workbench.openSettings">
                <UnoIcon name="i-carbon-settings" title="工作台设置" :size="18" />
              </button>

              <el-dropdown
                trigger="click"
                placement="bottom-end"
                popper-class="header-user-dropdown"
                @command="handleUserCommand"
                @visible-change="handleUserDropdownVisibleChange"
              >
                <button class="header-user" :class="{ 'is-open': userDropdownVisible }" type="button">
                  <span class="header-user__avatar">
                    <div v-if="auth.user?.avatarUrl" class="user-avatar-frame">
                      <img :src="auth.user.avatarUrl" alt="avatar" class="user-avatar" />
                    </div>
                    <div v-else class="user-avatar-fallback">
                      {{ userInitial }}
                    </div>
                    <span v-permission="'file.upload'" class="user-avatar-badge" :class="{ 'is-loading': avatarUploading }">
                      <UnoIcon :name="avatarUploading ? 'i-carbon-time' : 'i-carbon-cloud-upload'" :size="10" />
                    </span>
                  </span>
                  <span class="user-meta">
                    <span class="user-meta__name">{{ auth.user?.nickname }}</span>
                    <small>{{ auth.user?.roles.map((item) => item.name).join(' / ') }}</small>
                  </span>
                  <span class="header-user__caret">
                    <UnoIcon name="i-carbon-chevron-right" :size="16" />
                  </span>
                </button>

                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-permission="'file.upload'" command="upload-avatar" :disabled="avatarUploading">
                      <span class="header-dropdown-item">
                        <span class="header-dropdown-item__icon">
                          <UnoIcon :name="avatarUploading ? 'i-carbon-time' : 'i-carbon-cloud-upload'" :size="16" />
                        </span>
                        <span class="header-dropdown-item__copy">
                          <strong>{{ avatarUploading ? '头像上传中' : '更换头像' }}</strong>
                          <small>{{ avatarUploading ? '请稍候，完成后会自动刷新' : '上传新的个人头像' }}</small>
                        </span>
                      </span>
                    </el-dropdown-item>
                    <el-dropdown-item command="dashboard">
                      <span class="header-dropdown-item">
                        <span class="header-dropdown-item__icon">
                          <UnoIcon name="i-carbon-home" :size="16" />
                        </span>
                        <span class="header-dropdown-item__copy">
                          <strong>返回总览</strong>
                          <small>回到首页与全局概览</small>
                        </span>
                      </span>
                    </el-dropdown-item>
                    <el-dropdown-item divided command="logout">
                      <span class="header-dropdown-item is-danger">
                        <span class="header-dropdown-item__icon">
                          <UnoIcon name="i-carbon-close" :size="16" />
                        </span>
                        <span class="header-dropdown-item__copy">
                          <strong>退出登录</strong>
                          <small>清除会话并返回登录页</small>
                        </span>
                      </span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <WorkbenchTabs
            v-if="showWorkbenchTabs"
            embedded
            :appearance="workbench.cachedTabDisplayMode"
          />

          <div v-else-if="workbench.layoutMode === 'tabs'" class="top-nav-strip top-nav-strip--embedded">
            <el-scrollbar>
              <div class="top-nav-strip__list">
                <RouterLink
                  v-for="item in topNavPages"
                  :key="item.id"
                  :to="item.path"
                  class="top-nav-item"
                  :class="{ 'is-active': route.path === item.path }"
                >
                  <span class="top-nav-item__icon">
                    <UnoIcon :name="resolveMenuNodeIcon(item)" :title="item.title" :size="16" />
                  </span>
                  <span class="top-nav-item__copy">
                    <small>{{ item.caption || item.code }}</small>
                    <strong>{{ item.title }}</strong>
                  </span>
                </RouterLink>
              </div>
            </el-scrollbar>
          </div>
        </div>
      </el-header>

      <el-main class="admin-shell__main">
        <div class="content-container">
          <router-view v-slot="{ Component, route: currentRoute }">
            <Transition :name="pageTransitionName" mode="out-in">
              <keep-alive :include="workbench.cacheInclude">
                <component
                  :is="Component"
                  :key="resolveRouteViewKey(currentRoute)"
                />
              </keep-alive>
            </Transition>
          </router-view>
        </div>
      </el-main>

      <el-footer class="admin-shell__footer">
        <div class="content-container">
          <div class="footer-strip">
            <span>{{ activeTheme?.label ?? '默认主题' }} · {{ themeModeLabel }}</span>
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router';
import { api } from '@/api/client';
import UnoIcon from '@/components/common/UnoIcon.vue';
import { resolveMenuNodeIcon } from '@/components/common/uno-icons';
import MenuTreeNav from '@/components/workbench/MenuTreeNav.vue';
import WorkbenchSettings from '@/components/workbench/WorkbenchSettings.vue';
import WorkbenchTabs from '@/components/workbench/WorkbenchTabs.vue';
import ThemeModeSwitch from '@/components/workbench/ThemeModeSwitch.vue';
import { findThemePreset, getThemeModeLabel, type ThemeMode } from '@/themes';
import { uploadAvatarFile } from '@/utils/direct-upload';
import { getErrorMessage } from '@/utils/errors';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import { useWorkbenchStore, type PageTransitionMode } from '@/stores/workbench';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const menus = useMenuStore();
const workbench = useWorkbenchStore();
const footerClock = ref(new Date().toLocaleString());
const isCompactViewport = ref(false);
const compactSidebarExpanded = ref(false);

const navigationItems = computed(() => menus.navigationTree);
const topNavPages = computed(() => menus.pages);
const canUploadAvatar = computed(() => auth.hasPermission('file.upload'));
const userInitial = computed(() => (auth.user?.nickname?.slice(0, 1) ?? '?').toUpperCase());
const breadcrumbs = computed(() => menus.getBreadcrumbs(route.path));
const pageMeta = computed(() => {
  const currentPage = menus.getPageByPath(route.path);

  return {
    title: currentPage?.title || String(route.meta.title ?? '控制台'),
    caption: currentPage?.caption || String(route.meta.caption ?? 'RBAC Admin'),
    description: currentPage?.description || String(route.meta.description ?? route.meta.caption ?? ''),
  };
});
const activeTheme = computed(() => findThemePreset(workbench.themePresetId));
const themeModeLabel = computed(() => {
  if (workbench.themeMode !== 'auto') {
    return getThemeModeLabel(workbench.themeMode);
  }

  return `自动·${getThemeModeLabel(workbench.resolvedThemeMode)}`;
});
const avatarInputRef = ref<HTMLInputElement | null>(null);
const userDropdownVisible = ref(false);
const avatarUploading = ref(false);
type HeaderUserCommand = 'upload-avatar' | 'dashboard' | 'logout';
const SIDEBAR_AUTO_COLLAPSE_BREAKPOINT = 1280;
const pageTransitionNameMap: Record<PageTransitionMode, string> = {
  none: 'shell-page-none',
  fade: 'shell-page-fade',
  slide: 'shell-page-slide',
};

let clockTimer: ReturnType<typeof setInterval> | null = null;

const isSidebarCollapsed = computed(() => {
  if (workbench.layoutMode !== 'sidebar') {
    return false;
  }

  if (isCompactViewport.value) {
    return !compactSidebarExpanded.value;
  }

  return workbench.sidebarCollapsed;
});

const sidebarWidth = computed(() => (isSidebarCollapsed.value ? '84px' : '248px'));
const sidebarToggleTitle = computed(() => (isSidebarCollapsed.value ? '展开侧栏' : '折叠侧栏'));
const pageTransitionName = computed(() => pageTransitionNameMap[workbench.pageTransition]);
const showWorkbenchTabs = computed(
  () => workbench.layoutMode === 'sidebar' && workbench.cachedTabDisplayMode !== 'hidden',
);
const hasSecondaryNav = computed(() => showWorkbenchTabs.value || workbench.layoutMode === 'tabs');

const tickClock = () => {
  footerClock.value = new Date().toLocaleString();
};

const resolveRouteViewKey = (currentRoute: RouteLocationNormalizedLoaded) =>
  currentRoute.meta.keepAlive ? String(currentRoute.name ?? currentRoute.path) : currentRoute.fullPath;

const syncSidebarViewport = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const nextCompact = window.innerWidth <= SIDEBAR_AUTO_COLLAPSE_BREAKPOINT;
  if (nextCompact !== isCompactViewport.value) {
    compactSidebarExpanded.value = false;
  }
  isCompactViewport.value = nextCompact;
};

const handleSidebarToggle = () => {
  if (workbench.layoutMode !== 'sidebar') {
    return;
  }

  if (isCompactViewport.value) {
    compactSidebarExpanded.value = !compactSidebarExpanded.value;
    return;
  }

  workbench.toggleSidebarCollapsed();
};

const goDashboard = async () => {
  await router.push(menus.homePath);
};

const logout = async () => {
  await auth.logout();
  menus.reset(router);
  workbench.resetWorkbenchPreferences();
  await router.push('/login');
};

const handleUserDropdownVisibleChange = (visible: boolean) => {
  userDropdownVisible.value = visible;
};

const openAvatarPicker = () => {
  if (!canUploadAvatar.value || avatarUploading.value) {
    return;
  }

  const input = avatarInputRef.value;
  if (!input) {
    return;
  }

  input.value = '';
  window.setTimeout(() => {
    input.click();
  }, 0);
};

const handleUserCommand = async (command: HeaderUserCommand | string | number) => {
  if (command === 'upload-avatar') {
    openAvatarPicker();
    return;
  }

  if (command === 'dashboard') {
    await goDashboard();
    return;
  }

  if (command === 'logout') {
    await logout();
  }
};

const handleAvatarInputChange = async (event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const file = target.files?.[0];
  if (!file) {
    return;
  }

  try {
    avatarUploading.value = true;
    const uploaded = await uploadAvatarFile(file);
    const currentUser = await api.auth.updateAvatar(uploaded.fileId);
    auth.setUser(currentUser, { syncWorkbench: false });
    ElMessage.success('头像已更新');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '头像上传失败'));
  } finally {
    avatarUploading.value = false;
    target.value = '';
  }
};

const handleThemeModeSelect = (payload: { value: ThemeMode; trigger: HTMLElement | null }) => {
  workbench.setThemeMode(payload.value, {
    animate: true,
    origin: payload.trigger,
  });
};

watch(
  () => route.path,
  () => {
    if (isCompactViewport.value) {
      compactSidebarExpanded.value = false;
    }
  },
);

onMounted(() => {
  tickClock();
  syncSidebarViewport();
  clockTimer = setInterval(tickClock, 60_000);
  window.addEventListener('resize', syncSidebarViewport, { passive: true });
});

onUnmounted(() => {
  if (clockTimer) {
    clearInterval(clockTimer);
  }

  window.removeEventListener('resize', syncSidebarViewport);
});
</script>
