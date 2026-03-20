<template>
  <div class="workbench-tabs">
    <div class="workbench-tabs__inner content-container">
      <el-scrollbar class="workbench-tabs__scroll">
        <div class="workbench-tabs__list">
          <RouterLink
            v-for="tab in workbench.visitedTabs"
            :key="tab.path"
            :to="tab.path"
            class="workbench-tab"
            :class="{ 'is-active': route.path === tab.path }"
          >
            <span class="workbench-tab__code">{{ tab.code }}</span>
            <span class="workbench-tab__title">{{ tab.title }}</span>
            <button
              v-if="tab.closable"
              class="workbench-tab__close"
              type="button"
              @click.prevent="closeTab(tab.path)"
            >
              ×
            </button>
          </RouterLink>
        </div>
      </el-scrollbar>

      <div class="workbench-tabs__tools">
        <el-dropdown trigger="click">
          <el-button plain>标签操作</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :disabled="route.path === '/dashboard'" @click="closeTab(route.path)">
                关闭当前
              </el-dropdown-item>
              <el-dropdown-item @click="closeOtherTabs">关闭其他</el-dropdown-item>
              <el-dropdown-item divided @click="closeAllTabs">关闭全部</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useWorkbenchStore } from '@/stores/workbench';

const route = useRoute();
const router = useRouter();
const workbench = useWorkbenchStore();

const closeTab = async (path: string) => {
  if (path === '/dashboard') {
    return;
  }

  const isActive = route.path === path;
  workbench.removeVisitedTab(path);

  if (isActive) {
    const fallback = workbench.visitedTabs.at(-1)?.path ?? '/dashboard';
    await router.push(fallback);
  }
};

const closeOtherTabs = async () => {
  workbench.closeOtherTabs(route.path);
  if (!workbench.visitedTabs.some((item) => item.path === route.path)) {
    await router.push('/dashboard');
  }
};

const closeAllTabs = async () => {
  workbench.closeAllTabs();
  if (route.path !== '/dashboard') {
    await router.push('/dashboard');
  }
};
</script>
