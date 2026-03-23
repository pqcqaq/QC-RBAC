import {
  REALTIME_TOPICS,
  type RbacUpdatedPayload,
  type RealtimeSyncTarget,
} from '@rbac/api-common';
import type { Router } from 'vue-router';
import { watch } from 'vue';
import { wsClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import { useWorkbenchStore } from '@/stores/workbench';
import { pinia } from '@/stores';

const SYNC_DEBOUNCE_MS = 120;

const hasStatus = (error: unknown): error is { status: number } =>
  typeof error === 'object'
  && error !== null
  && typeof Reflect.get(error, 'status') === 'number';

const getDefaultTargets = (): RealtimeSyncTarget[] => ['menus', 'user'];

export const installAdminRealtimeSync = (router: Router) => {
  const auth = useAuthStore(pinia);
  const menus = useMenuStore(pinia);
  const workbench = useWorkbenchStore(pinia);
  const pendingTargets = new Set<RealtimeSyncTarget>();
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  let syncInFlight = false;
  let rerunRequested = false;
  let stopTopicSubscription: (() => void) | null = null;

  const clearSyncTimer = () => {
    if (!syncTimer) {
      return;
    }

    clearTimeout(syncTimer);
    syncTimer = null;
  };

  const reconcileConsoleRoute = async () => {
    const currentRoute = router.currentRoute.value;
    if (!auth.isAuthenticated || !currentRoute.path.startsWith('/console')) {
      return;
    }

    if (currentRoute.path === '/console') {
      if (menus.homePath !== '/console') {
        await router.replace(menus.homePath);
      }
      return;
    }

    if (!menus.hasPagePath(currentRoute.path)) {
      await router.replace(menus.homePath);
      return;
    }

    if (typeof currentRoute.meta.permission === 'string' && !auth.hasPermission(currentRoute.meta.permission)) {
      await router.replace(menus.homePath);
    }
  };

  const handleUnauthorizedSync = async () => {
    menus.reset(router);
    await auth.logout().catch(() => {
      auth.clearSession();
    });
    await router.replace('/login');
  };

  const flushSync = async () => {
    clearSyncTimer();

    if (syncInFlight) {
      rerunRequested = true;
      return;
    }

    if (!auth.isAuthenticated || !auth.user?.id) {
      pendingTargets.clear();
      return;
    }

    const targets = pendingTargets.size
      ? [...pendingTargets]
      : getDefaultTargets();
    pendingTargets.clear();
    syncInFlight = true;

    try {
      if (targets.includes('user')) {
        await auth.syncCurrentUser();
      }

      if (targets.includes('menus')) {
        await menus.refresh(router);
        workbench.syncWithMenus();
      }

      await reconcileConsoleRoute();
    } catch (error) {
      if (hasStatus(error) && (error.status === 401 || error.status === 403)) {
        await handleUnauthorizedSync();
      }
    } finally {
      syncInFlight = false;

      if (rerunRequested || pendingTargets.size) {
        rerunRequested = false;
        void flushSync();
      }
    }
  };

  const scheduleSync = (targets: RealtimeSyncTarget[] = getDefaultTargets()) => {
    targets.forEach((target) => {
      pendingTargets.add(target);
    });

    clearSyncTimer();
    syncTimer = setTimeout(() => {
      void flushSync();
    }, SYNC_DEBOUNCE_MS);
  };

  watch(
    () => auth.user?.id ?? '',
    (userId) => {
      stopTopicSubscription?.();
      stopTopicSubscription = null;
      pendingTargets.clear();
      clearSyncTimer();
      rerunRequested = false;

      if (!userId) {
        return;
      }

      stopTopicSubscription = wsClient.onTopic<RbacUpdatedPayload>(
        REALTIME_TOPICS.userRbacUpdated(userId),
        ({ payload }) => {
          scheduleSync(payload.targets?.length ? payload.targets : getDefaultTargets());
        },
      );
    },
    {
      immediate: true,
    },
  );
};
