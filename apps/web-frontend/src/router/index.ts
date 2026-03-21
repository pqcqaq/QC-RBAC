import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import { useWorkbenchStore } from '@/stores/workbench';
import { pinia } from '@/stores';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/',
    name: 'shell',
    component: () => import('@/layouts/ShellLayout.vue'),
    meta: { requiresAuth: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia);
  const menus = useMenuStore(pinia);

  if (!auth.ready) {
    await auth.bootstrap();
  }

  if (!auth.isAuthenticated && to.path !== '/login') {
    menus.reset(router);
    return '/login';
  }

  if (auth.isAuthenticated) {
    await menus.bootstrap(router);
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return menus.homePath;
  }

  if (auth.isAuthenticated && to.path === '/') {
    return menus.homePath;
  }

  if (auth.isAuthenticated && menus.hasPagePath(to.path) && !to.name) {
    return to.fullPath;
  }

  if (auth.isAuthenticated && to.path !== '/login' && to.path !== '/' && !menus.hasPagePath(to.path) && !to.name) {
    return menus.homePath;
  }

  if (typeof to.meta.permission === 'string' && !auth.hasPermission(to.meta.permission)) {
    return menus.homePath;
  }

  return true;
});

router.afterEach((to) => {
  const menus = useMenuStore(pinia);
  const workbench = useWorkbenchStore(pinia);
  workbench.bootstrap();

  if (menus.ready) {
    workbench.syncWithMenus();
  }

  if (to.meta.requiresAuth && menus.hasPagePath(to.path)) {
    workbench.addVisitedTab(to.path);
  }
});
