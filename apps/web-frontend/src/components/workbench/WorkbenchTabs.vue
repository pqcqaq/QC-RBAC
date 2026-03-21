<template>
  <div class="workbench-tabs" :class="{ 'is-embedded': embedded }">
    <div class="workbench-tabs__inner" :class="{ 'content-container': !embedded, 'is-embedded': embedded }">
      <el-scrollbar class="workbench-tabs__scroll">
        <ContextMenuHost :items="tabContextMenuItems" manual>
          <template #default="{ open }">
            <div class="workbench-tabs__list">
              <RouterLink
                v-for="tab in workbench.visitedTabs"
                :key="tab.path"
                :to="tab.path"
                class="workbench-tab"
                :class="{ 'is-active': route.path === tab.path }"
                @contextmenu="open($event, tab)"
                @mousedown.middle.prevent
                @auxclick="handleTabAuxClick($event, tab)"
              >
                <span class="workbench-tab__icon">
                  <UnoIcon :name="tab.icon" :title="tab.title" :size="15" />
                </span>
                <span class="workbench-tab__title">{{ tab.title }}</span>
                <button
                  v-if="tab.closable"
                  class="workbench-tab__close"
                  type="button"
                  @click.prevent.stop="closeTab(tab.path)"
                >
                  ×
                </button>
              </RouterLink>
            </div>
          </template>
        </ContextMenuHost>
      </el-scrollbar>

      <div class="workbench-tabs__tools">
        <el-dropdown trigger="click">
          <button class="workbench-tabs__action" type="button" title="标签操作" aria-label="标签操作">
            <UnoIcon name="i-carbon-overflow-menu-horizontal" :size="18" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :disabled="!canCloseTab(route.path)" @click="closeTab(route.path)">
                关闭此标签
              </el-dropdown-item>
              <el-dropdown-item :disabled="!canCloseTabsToLeft(route.path)" @click="closeLeftTabs(route.path)">
                关闭左侧
              </el-dropdown-item>
              <el-dropdown-item :disabled="!canCloseTabsToRight(route.path)" @click="closeRightTabs(route.path)">
                关闭右侧
              </el-dropdown-item>
              <el-dropdown-item :disabled="!canCloseOtherTabs(route.path)" @click="closeOtherTabs(route.path)">
                关闭其他
              </el-dropdown-item>
              <el-dropdown-item divided :disabled="!hasClosableTabs" @click="closeAllTabs">关闭全部</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import UnoIcon from '@/components/common/UnoIcon.vue';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import type { ContextMenuItem } from '@/components/common/context-menu';
import { useMenuStore } from '@/stores/menus';
import type { VisitedTab } from '@/stores/workbench';
import { useWorkbenchStore } from '@/stores/workbench';

const route = useRoute();
const router = useRouter();
const menus = useMenuStore();
const workbench = useWorkbenchStore();
const homePath = computed(() => menus.homePath || '/');
const hasClosableTabs = computed(() => workbench.visitedTabs.some((item) => item.closable));

withDefaults(defineProps<{
  embedded?: boolean;
}>(), {
  embedded: false,
});

const getTabIndex = (path: string) => workbench.visitedTabs.findIndex((item) => item.path === path);
const hasTab = (path: string) => workbench.visitedTabs.some((item) => item.path === path);
const canCloseTab = (path: string) => path !== homePath.value && hasTab(path);
const canCloseTabsToLeft = (path: string) => {
  const targetIndex = getTabIndex(path);
  return workbench.visitedTabs.some((item, index) => item.closable && index < targetIndex);
};
const canCloseTabsToRight = (path: string) => {
  const targetIndex = getTabIndex(path);
  return workbench.visitedTabs.some((item, index) => item.closable && index > targetIndex);
};
const canCloseOtherTabs = (path: string) => workbench.visitedTabs.some((item) => item.closable && item.path !== path);

const resolveNeighborPath = (path: string) => {
  const index = getTabIndex(path);
  if (index === -1) {
    return homePath.value;
  }

  return workbench.visitedTabs[index + 1]?.path ?? workbench.visitedTabs[index - 1]?.path ?? homePath.value;
};

const ensureRouteAvailability = async (preferredPath?: string, forcePreferred = false) => {
  if (preferredPath && forcePreferred && hasTab(preferredPath)) {
    if (route.path !== preferredPath) {
      await router.push(preferredPath);
    }
    return;
  }

  if (hasTab(route.path)) {
    return;
  }

  const fallback = preferredPath && hasTab(preferredPath)
    ? preferredPath
    : workbench.visitedTabs.at(-1)?.path ?? homePath.value;

  if (route.path !== fallback) {
    await router.push(fallback);
  }
};

const tabContextMenuItems = [
  {
    key: 'close',
    label: (tab) => `关闭“${tab.title}”`,
    description: (tab) => tab.closable ? '支持鼠标中键直接关闭' : undefined,
    disabled: (tab) => !tab.closable,
    onSelect: (tab) => closeTab(tab.path),
  },
  {
    key: 'close-left',
    label: '关闭左侧',
    disabled: (tab) => !canCloseTabsToLeft(tab.path),
    onSelect: (tab) => closeLeftTabs(tab.path),
  },
  {
    key: 'close-right',
    label: '关闭右侧',
    disabled: (tab) => !canCloseTabsToRight(tab.path),
    onSelect: (tab) => closeRightTabs(tab.path),
  },
  {
    key: 'close-divider',
    type: 'divider',
  },
  {
    key: 'close-others',
    label: '关闭其他',
    disabled: (tab) => !canCloseOtherTabs(tab.path),
    onSelect: (tab) => closeOtherTabs(tab.path, true),
  },
  {
    key: 'close-all',
    label: '关闭全部',
    disabled: () => !hasClosableTabs.value,
    danger: true,
    onSelect: () => closeAllTabs(),
  },
] satisfies ContextMenuItem<VisitedTab>[];

const closeTab = async (path: string) => {
  if (!canCloseTab(path)) {
    return;
  }

  const fallback = route.path === path ? resolveNeighborPath(path) : undefined;
  workbench.removeVisitedTab(path);
  await ensureRouteAvailability(fallback);
};

const closeLeftTabs = async (path: string) => {
  if (!canCloseTabsToLeft(path)) {
    return;
  }

  workbench.closeLeftTabs(path);
  await ensureRouteAvailability(path);
};

const closeRightTabs = async (path: string) => {
  if (!canCloseTabsToRight(path)) {
    return;
  }

  workbench.closeRightTabs(path);
  await ensureRouteAvailability(path);
};

const closeOtherTabs = async (path = route.path, activatePreferred = false) => {
  if (!hasTab(path)) {
    return;
  }

  workbench.closeOtherTabs(path);
  await ensureRouteAvailability(path, activatePreferred);
};

const closeAllTabs = async () => {
  workbench.closeAllTabs();
  await ensureRouteAvailability(homePath.value, true);
};

const handleTabAuxClick = async (event: MouseEvent, tab: VisitedTab) => {
  if (event.button !== 1 || !tab.closable) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  await closeTab(tab.path);
};
</script>
