import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { defineStore } from 'pinia';
import { applyThemePreset, defaultThemePresetId } from '@/themes';
import { pageRegistryMap } from '@/meta/pages';

export type WorkbenchLayoutMode = 'sidebar' | 'tabs';

export type VisitedTab = {
  path: string;
  name: string;
  title: string;
  code: string;
  closable: boolean;
};

type WorkbenchSnapshot = {
  themePresetId: string;
  layoutMode: WorkbenchLayoutMode;
  visitedTabs: VisitedTab[];
  cachedViewNames: string[];
  pageStateMap: Record<string, unknown>;
};

const STORAGE_KEY = 'rbac-workbench';

const dashboardTab: VisitedTab = {
  path: '/dashboard',
  name: 'dashboard',
  title: '战略总览',
  code: 'OV',
  closable: false,
};

const createDefaultState = (): WorkbenchSnapshot => ({
  themePresetId: defaultThemePresetId,
  layoutMode: 'sidebar',
  visitedTabs: [{ ...dashboardTab }],
  cachedViewNames: ['DashboardView'],
  pageStateMap: {},
});

const safeParse = (): WorkbenchSnapshot => {
  if (typeof window === 'undefined') {
    return createDefaultState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    return {
      ...createDefaultState(),
      ...JSON.parse(raw),
    } satisfies WorkbenchSnapshot;
  } catch {
    return createDefaultState();
  }
};

const toComponentName = (routeName?: string) => {
  if (!routeName) {
    return '';
  }
  return `${routeName.charAt(0).toUpperCase()}${routeName.slice(1)}View`;
};

const buildTabFromPath = (path: string): VisitedTab | null => {
  if (path === dashboardTab.path) {
    return { ...dashboardTab };
  }

  const registry = pageRegistryMap[path];
  if (!registry) {
    return null;
  }

  return {
    path,
    name: registry.name,
    title: registry.title,
    code: registry.code,
    closable: true,
  };
};

const normalizeVisitedTabs = (tabs: VisitedTab[] = []) => {
  const normalized: VisitedTab[] = [{ ...dashboardTab }];
  const seen = new Set<string>([dashboardTab.path]);

  tabs.forEach((tab) => {
    const next = buildTabFromPath(tab.path);
    if (!next || seen.has(next.path)) {
      return;
    }
    normalized.push(next);
    seen.add(next.path);
  });

  return normalized;
};

const resolveCacheNames = (tabs: VisitedTab[]) => Array.from(
  new Set(
    tabs
      .map((tab) => toComponentName(tab.name))
      .filter((item): item is string => Boolean(item)),
  ),
);

export const useWorkbenchStore = defineStore('workbench', {
  state: () => ({
    initialized: false,
    settingsVisible: false,
    themePresetId: defaultThemePresetId,
    layoutMode: 'sidebar' as WorkbenchLayoutMode,
    visitedTabs: [{ ...dashboardTab }] as VisitedTab[],
    cachedViewNames: ['DashboardView'] as string[],
    pageStateMap: {} as Record<string, unknown>,
  }),
  getters: {
    cacheInclude: (state) => state.cachedViewNames,
  },
  actions: {
    persist() {
      if (typeof window === 'undefined') {
        return;
      }

      const snapshot: WorkbenchSnapshot = {
        themePresetId: this.themePresetId,
        layoutMode: this.layoutMode,
        visitedTabs: this.visitedTabs,
        cachedViewNames: this.cachedViewNames,
        pageStateMap: this.pageStateMap,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    },
    syncCacheFromTabs() {
      this.cachedViewNames = resolveCacheNames(this.visitedTabs);
    },
    bootstrap() {
      if (this.initialized) {
        return;
      }

      const snapshot = safeParse();
      this.themePresetId = snapshot.themePresetId;
      this.layoutMode = snapshot.layoutMode === 'tabs' ? 'tabs' : 'sidebar';
      this.visitedTabs = normalizeVisitedTabs(snapshot.visitedTabs);
      this.syncCacheFromTabs();
      this.pageStateMap = snapshot.pageStateMap ?? {};
      applyThemePreset(this.themePresetId);
      this.initialized = true;
      this.persist();
    },
    setThemePreset(themePresetId: string) {
      this.themePresetId = themePresetId;
      applyThemePreset(themePresetId);
      this.persist();
    },
    setLayoutMode(layoutMode: WorkbenchLayoutMode) {
      this.layoutMode = layoutMode;
      this.persist();
    },
    openSettings() {
      this.settingsVisible = true;
    },
    closeSettings() {
      this.settingsVisible = false;
    },
    toggleSettings() {
      this.settingsVisible = !this.settingsVisible;
    },
    addVisitedTab(route: RouteLocationNormalizedLoaded) {
      const next = buildTabFromPath(route.path);
      if (!next) {
        return;
      }

      if (!this.visitedTabs.some((item) => item.path === next.path)) {
        this.visitedTabs.push(next);
        this.visitedTabs = normalizeVisitedTabs(this.visitedTabs);
      }

      this.syncCacheFromTabs();
      this.persist();
    },
    removeVisitedTab(path: string) {
      if (path === dashboardTab.path) {
        return;
      }

      this.visitedTabs = normalizeVisitedTabs(
        this.visitedTabs.filter((item) => item.path !== path),
      );
      this.syncCacheFromTabs();
      this.persist();
    },
    closeOtherTabs(path: string) {
      this.visitedTabs = normalizeVisitedTabs(
        this.visitedTabs.filter((item) => item.path === dashboardTab.path || item.path === path),
      );
      this.syncCacheFromTabs();
      this.persist();
    },
    closeAllTabs() {
      this.visitedTabs = [{ ...dashboardTab }];
      this.syncCacheFromTabs();
      this.persist();
    },
    setPageState(key: string, payload: unknown) {
      this.pageStateMap[key] = payload;
      this.persist();
    },
    getPageState<T>(key: string) {
      return this.pageStateMap[key] as T | undefined;
    },
    resetWorkbenchPreferences(activePath?: string) {
      const next = createDefaultState();
      const activeTab = activePath ? buildTabFromPath(activePath) : null;
      if (activeTab && activeTab.path !== dashboardTab.path) {
        next.visitedTabs.push(activeTab);
        next.cachedViewNames = resolveCacheNames(next.visitedTabs);
      }

      this.themePresetId = next.themePresetId;
      this.layoutMode = next.layoutMode;
      this.visitedTabs = next.visitedTabs.map((tab) => ({ ...tab }));
      this.cachedViewNames = [...next.cachedViewNames];
      this.pageStateMap = {};
      applyThemePreset(this.themePresetId);
      this.persist();
    },
  },
});
