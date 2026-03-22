import type {
  UserPreferences,
  UserWorkbenchPreferences,
  WorkbenchVisitedTab,
} from '@rbac/api-common';
import { defineStore } from 'pinia';
import { api } from '@/api/client';
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

export type WorkbenchLayoutMode = UserWorkbenchPreferences['layoutMode'];
export type PageTransitionMode = UserWorkbenchPreferences['pageTransition'];
export type CachedTabDisplayMode = UserWorkbenchPreferences['cachedTabDisplayMode'];
export type VisitedTab = WorkbenchVisitedTab;

type WorkbenchSnapshot = UserWorkbenchPreferences & {
  cachedViewNames: string[];
  ownerUserId: string | null;
};

type ApplySnapshotOptions = {
  persistLocal?: boolean;
  syncRemote?: boolean;
};

const STORAGE_KEY = 'rbac-workbench';
const REMOTE_SYNC_DEBOUNCE_MS = 400;
let remoteSyncTimer: ReturnType<typeof setTimeout> | null = null;

const createDefaultPreferences = (): UserWorkbenchPreferences => ({
  themePresetId: defaultThemePresetId,
  sidebarAppearance: defaultSidebarAppearance,
  sidebarCollapsed: false,
  layoutMode: 'sidebar',
  pageTransition: 'fade',
  cachedTabDisplayMode: 'classic',
  visitedTabs: [],
  pageStateMap: {},
});

const createDefaultState = (): WorkbenchSnapshot => ({
  ...createDefaultPreferences(),
  cachedViewNames: [],
  ownerUserId: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isVisitedTab = (value: unknown): value is VisitedTab => {
  if (!isRecord(value)) {
    return false;
  }

  return [
    typeof value.path === 'string',
    typeof value.name === 'string',
    typeof value.title === 'string',
    typeof value.code === 'string',
    typeof value.icon === 'string',
    typeof value.closable === 'boolean',
  ].every(Boolean);
};

const normalizeVisitedTabPayload = (value: unknown): VisitedTab[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isVisitedTab).map((tab) => ({ ...tab }));
};

const normalizePageStateMap = (value: unknown) => (isRecord(value) ? value : {});

const normalizePreferences = (value?: Partial<UserWorkbenchPreferences> | null): UserWorkbenchPreferences => ({
  themePresetId: typeof value?.themePresetId === 'string' && value.themePresetId ? value.themePresetId : defaultThemePresetId,
  sidebarAppearance: value?.sidebarAppearance === 'light' ? 'light' : defaultSidebarAppearance,
  sidebarCollapsed: Boolean(value?.sidebarCollapsed),
  layoutMode: value?.layoutMode === 'tabs' ? 'tabs' : 'sidebar',
  pageTransition: value?.pageTransition === 'none' || value?.pageTransition === 'slide' ? value.pageTransition : 'fade',
  cachedTabDisplayMode: value?.cachedTabDisplayMode === 'hidden' || value?.cachedTabDisplayMode === 'browser'
    ? value.cachedTabDisplayMode
    : 'classic',
  visitedTabs: normalizeVisitedTabPayload(value?.visitedTabs),
  pageStateMap: normalizePageStateMap(value?.pageStateMap),
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

    const parsed = JSON.parse(raw) as Partial<WorkbenchSnapshot>;
    return {
      ...createDefaultState(),
      ...normalizePreferences(parsed),
      cachedViewNames: Array.isArray(parsed.cachedViewNames)
        ? parsed.cachedViewNames.filter((item): item is string => typeof item === 'string')
        : [],
      ownerUserId: typeof parsed.ownerUserId === 'string' ? parsed.ownerUserId : null,
    };
  } catch {
    return createDefaultState();
  }
};

const toComponentName = (routeName?: string) => {
  if (!routeName) {
    return '';
  }
  const pageDefinition = pageRegistryMap[routeName];
  return pageDefinition?.keepAlive ? pageDefinition.cacheName : '';
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

const serializePreferences = (preferences: UserWorkbenchPreferences) => JSON.stringify(preferences);

type TabStateStore = {
  visitedTabs: VisitedTab[];
  persist: (options?: { syncRemote?: boolean }) => void;
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
    pageTransition: 'fade' as PageTransitionMode,
    cachedTabDisplayMode: 'classic' as CachedTabDisplayMode,
    visitedTabs: [] as VisitedTab[],
    cachedViewNames: [] as string[],
    pageStateMap: {} as Record<string, unknown>,
    activeUserId: null as string | null,
    localSnapshotOwnerId: null as string | null,
    lastRemotePreferencesFingerprint: '',
  }),
  getters: {
    cacheInclude: (state) => state.cachedViewNames,
  },
  actions: {
    buildPreferences(): UserWorkbenchPreferences {
      return {
        themePresetId: this.themePresetId,
        sidebarAppearance: this.sidebarAppearance,
        sidebarCollapsed: this.sidebarCollapsed,
        layoutMode: this.layoutMode,
        pageTransition: this.pageTransition,
        cachedTabDisplayMode: this.cachedTabDisplayMode,
        visitedTabs: this.visitedTabs.map((tab) => ({ ...tab })),
        pageStateMap: { ...this.pageStateMap },
      };
    },
    cancelRemoteSync() {
      if (!remoteSyncTimer) {
        return;
      }

      clearTimeout(remoteSyncTimer);
      remoteSyncTimer = null;
    },
    async pushPreferencesToRemote() {
      if (!this.activeUserId) {
        return;
      }

      const userId = this.activeUserId;
      const payload: UserPreferences = {
        workbench: this.buildPreferences(),
      };

      try {
        const preferences = await api.auth.updatePreferences(payload);
        if (this.activeUserId !== userId) {
          return;
        }

        this.lastRemotePreferencesFingerprint = serializePreferences(
          normalizePreferences(preferences.workbench ?? payload.workbench),
        );
      } catch {
        // Keep local state and retry on the next change.
      }
    },
    scheduleRemoteSync() {
      if (typeof window === 'undefined' || !this.activeUserId) {
        return;
      }

      const nextPreferences = this.buildPreferences();
      const nextFingerprint = serializePreferences(nextPreferences);
      if (nextFingerprint === this.lastRemotePreferencesFingerprint) {
        return;
      }

      this.cancelRemoteSync();
      remoteSyncTimer = setTimeout(() => {
        remoteSyncTimer = null;
        void this.pushPreferencesToRemote();
      }, REMOTE_SYNC_DEBOUNCE_MS);
    },
    persist(options: { syncRemote?: boolean } = {}) {
      if (typeof window !== 'undefined') {
        const snapshot: WorkbenchSnapshot = {
          ...this.buildPreferences(),
          cachedViewNames: [...this.cachedViewNames],
          ownerUserId: this.localSnapshotOwnerId,
        };

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      }

      if (options.syncRemote !== false) {
        this.scheduleRemoteSync();
      }
    },
    syncCacheFromTabs() {
      this.cachedViewNames = resolveCacheNames(this.visitedTabs);
    },
    applySnapshot(snapshot: Partial<UserWorkbenchPreferences> | null | undefined, options: ApplySnapshotOptions = {}) {
      const menus = useMenuStore();
      const next = normalizePreferences(snapshot);

      this.themePresetId = next.themePresetId;
      this.sidebarAppearance = next.sidebarAppearance;
      this.sidebarCollapsed = next.sidebarCollapsed;
      this.layoutMode = next.layoutMode;
      this.pageTransition = next.pageTransition;
      this.cachedTabDisplayMode = next.cachedTabDisplayMode;
      this.visitedTabs = menus.ready ? normalizeVisitedTabs(next.visitedTabs) : next.visitedTabs;
      this.cachedViewNames = resolveCacheNames(this.visitedTabs);
      this.pageStateMap = { ...next.pageStateMap };
      applyThemePreset(this.themePresetId);
      applySidebarAppearance(this.sidebarAppearance);

      if (options.persistLocal !== false) {
        this.persist({ syncRemote: options.syncRemote });
      }
    },
    bootstrap() {
      if (this.initialized) {
        return;
      }

      const snapshot = safeParse();
      this.localSnapshotOwnerId = snapshot.ownerUserId;
      this.applySnapshot(snapshot, { persistLocal: false, syncRemote: false });
      this.initialized = true;
      this.persist({ syncRemote: false });
    },
    hydrateUserPreferences(userId: string, preferences: UserPreferences = {}) {
      if (!this.initialized) {
        this.bootstrap();
      }

      this.cancelRemoteSync();
      this.activeUserId = userId;

      if (preferences.workbench) {
        this.localSnapshotOwnerId = userId;
        this.applySnapshot(preferences.workbench, { syncRemote: false });
        this.lastRemotePreferencesFingerprint = serializePreferences(this.buildPreferences());
        return;
      }

      if (this.localSnapshotOwnerId !== userId) {
        this.localSnapshotOwnerId = userId;
        this.applySnapshot(createDefaultPreferences(), { syncRemote: false });
      }

      this.lastRemotePreferencesFingerprint = '';
      this.scheduleRemoteSync();
    },
    clearUserPreferencesContext() {
      this.cancelRemoteSync();
      this.activeUserId = null;
      this.lastRemotePreferencesFingerprint = '';
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
    setPageTransition(pageTransition: PageTransitionMode) {
      this.pageTransition = pageTransition;
      this.persist();
    },
    setCachedTabDisplayMode(cachedTabDisplayMode: CachedTabDisplayMode) {
      this.cachedTabDisplayMode = cachedTabDisplayMode;
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
      const next = createDefaultPreferences();
      const homeTab = buildTabFromPath(useMenuStore().homePath);
      if (homeTab) {
        next.visitedTabs.push(homeTab);
      }

      const activeTab = activePath ? buildTabFromPath(activePath) : null;
      if (activeTab && !next.visitedTabs.some((tab) => tab.path === activeTab.path)) {
        next.visitedTabs.push(activeTab);
      }

      this.applySnapshot(next);
    },
  },
});

