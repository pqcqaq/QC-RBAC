import { defineStore } from 'pinia';
import {
  applySidebarAppearance,
  applyThemePreset,
  defaultSidebarAppearance,
  defaultThemePresetId,
  type SidebarAppearance,
} from '@/themes';
import { pageRegistryMap } from '@/meta/pages';
import { resolveMenuNodeIcon } from '@/components/common/uno-icons';
import { useMenuStore } from '@/stores/menus';

export type WorkbenchLayoutMode = 'sidebar' | 'tabs';

export type VisitedTab = {
  path: string;
  name: string;
  title: string;
  code: string;
  icon: string;
  closable: boolean;
};

type WorkbenchSnapshot = {
  themePresetId: string;
  sidebarAppearance: SidebarAppearance;
  sidebarCollapsed: boolean;
  layoutMode: WorkbenchLayoutMode;
  visitedTabs: VisitedTab[];
  cachedViewNames: string[];
  pageStateMap: Record<string, unknown>;
};

const STORAGE_KEY = 'rbac-workbench';

const createDefaultState = (): WorkbenchSnapshot => ({
  themePresetId: defaultThemePresetId,
  sidebarAppearance: defaultSidebarAppearance,
  sidebarCollapsed: false,
  layoutMode: 'sidebar',
  visitedTabs: [],
  cachedViewNames: [],
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
  const pageDefinition = pageRegistryMap[routeName];
  return pageDefinition?.cacheName ?? '';
};

const buildTabFromPath = (path: string): VisitedTab | null => {
  const menus = useMenuStore();
  const page = menus.getPageByPath(path);
  if (!page) {
    return null;
  }

  return {
    path,
    name: page.viewKey,
    title: page.title,
    code: page.code,
    icon: resolveMenuNodeIcon(page),
    closable: path !== menus.homePath,
  };
};

const normalizeVisitedTabs = (tabs: VisitedTab[] = []) => {
  const menus = useMenuStore();
  const normalized: VisitedTab[] = [];
  const seen = new Set<string>();
  const homeTab = menus.homePath ? buildTabFromPath(menus.homePath) : null;

  if (homeTab) {
    normalized.push(homeTab);
    seen.add(homeTab.path);
  }

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

type TabStateStore = {
  visitedTabs: VisitedTab[];
  persist: () => void;
  syncCacheFromTabs: () => void;
};

const syncTabState = (store: TabStateStore) => {
  store.visitedTabs = normalizeVisitedTabs(store.visitedTabs);
  store.syncCacheFromTabs();
  store.persist();
};

export const useWorkbenchStore = defineStore('workbench', {
  state: () => ({
    initialized: false,
    settingsVisible: false,
    themePresetId: defaultThemePresetId,
    sidebarAppearance: defaultSidebarAppearance as SidebarAppearance,
    sidebarCollapsed: false,
    layoutMode: 'sidebar' as WorkbenchLayoutMode,
    visitedTabs: [] as VisitedTab[],
    cachedViewNames: [] as string[],
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
        sidebarAppearance: this.sidebarAppearance,
        sidebarCollapsed: this.sidebarCollapsed,
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

      const menus = useMenuStore();
      const snapshot = safeParse();
      this.themePresetId = snapshot.themePresetId;
      this.sidebarAppearance = snapshot.sidebarAppearance === 'light' ? 'light' : 'dark';
      this.sidebarCollapsed = Boolean(snapshot.sidebarCollapsed);
      this.layoutMode = snapshot.layoutMode === 'tabs' ? 'tabs' : 'sidebar';
      this.visitedTabs = menus.ready ? normalizeVisitedTabs(snapshot.visitedTabs) : (snapshot.visitedTabs ?? []);
      this.cachedViewNames = menus.ready ? resolveCacheNames(this.visitedTabs) : (snapshot.cachedViewNames ?? []);
      this.pageStateMap = snapshot.pageStateMap ?? {};
      applyThemePreset(this.themePresetId);
      applySidebarAppearance(this.sidebarAppearance);
      this.initialized = true;
      this.persist();
    },
    syncWithMenus() {
      if (!this.initialized) {
        return;
      }

      this.visitedTabs = normalizeVisitedTabs(this.visitedTabs);
      this.syncCacheFromTabs();
      this.persist();
    },
    setThemePreset(themePresetId: string) {
      this.themePresetId = themePresetId;
      applyThemePreset(themePresetId);
      this.persist();
    },
    setSidebarAppearance(sidebarAppearance: SidebarAppearance) {
      this.sidebarAppearance = sidebarAppearance;
      applySidebarAppearance(sidebarAppearance);
      this.persist();
    },
    setSidebarCollapsed(sidebarCollapsed: boolean) {
      this.sidebarCollapsed = sidebarCollapsed;
      this.persist();
    },
    toggleSidebarCollapsed() {
      this.setSidebarCollapsed(!this.sidebarCollapsed);
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
    addVisitedTab(path: string) {
      const next = buildTabFromPath(path);
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
      const menus = useMenuStore();
      if (path === menus.homePath) {
        return;
      }

      this.visitedTabs = this.visitedTabs.filter((item) => item.path !== path);
      syncTabState(this);
    },
    closeLeftTabs(path: string) {
      const menus = useMenuStore();
      const targetIndex = this.visitedTabs.findIndex((item) => item.path === path);
      if (targetIndex <= 0) {
        return;
      }

      this.visitedTabs = this.visitedTabs.filter((item, index) => index >= targetIndex || item.path === menus.homePath);
      syncTabState(this);
    },
    closeRightTabs(path: string) {
      const menus = useMenuStore();
      const targetIndex = this.visitedTabs.findIndex((item) => item.path === path);
      if (targetIndex === -1) {
        return;
      }

      this.visitedTabs = this.visitedTabs.filter((item, index) => index <= targetIndex || item.path === menus.homePath);
      syncTabState(this);
    },
    closeOtherTabs(path: string) {
      const menus = useMenuStore();
      this.visitedTabs = this.visitedTabs.filter((item) => item.path === menus.homePath || item.path === path);
      syncTabState(this);
    },
    closeAllTabs() {
      const homeTab = buildTabFromPath(useMenuStore().homePath);
      this.visitedTabs = homeTab ? [homeTab] : [];
      syncTabState(this);
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
      const homeTab = buildTabFromPath(useMenuStore().homePath);
      if (homeTab) {
        next.visitedTabs.push(homeTab);
      }

      const activeTab = activePath ? buildTabFromPath(activePath) : null;
      if (activeTab && !next.visitedTabs.some((tab) => tab.path === activeTab.path)) {
        next.visitedTabs.push(activeTab);
      }
      next.cachedViewNames = resolveCacheNames(next.visitedTabs);

      this.themePresetId = next.themePresetId;
      this.sidebarAppearance = next.sidebarAppearance;
      this.sidebarCollapsed = next.sidebarCollapsed;
      this.layoutMode = next.layoutMode;
      this.visitedTabs = next.visitedTabs.map((tab) => ({ ...tab }));
      this.cachedViewNames = [...next.cachedViewNames];
      this.pageStateMap = {};
      applyThemePreset(this.themePresetId);
      applySidebarAppearance(this.sidebarAppearance);
      this.persist();
    },
  },
});
