import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import { useWorkbenchStore } from '@/stores/workbench';
import { pinia } from '@/stores';

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/FrontendLayout.vue'),
    children: [
      {
        path: '',
        name: 'frontend-home',
        component: () => import('@/pages/frontend/home/HomeView.vue'),
        meta: { publicPage: true, title: '项目首页' },
      },
      {
        path: 'architecture',
        name: 'frontend-architecture',
        component: () => import('@/pages/frontend/architecture/ArchitectureView.vue'),
        meta: { publicPage: true, title: '系统架构' },
      },
      {
        path: 'authentication',
        name: 'frontend-authentication',
        component: () => import('@/pages/frontend/authentication/AuthenticationView.vue'),
        meta: { publicPage: true, title: '认证策略' },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'frontend-not-found',
        component: () => import('@/pages/frontend/not-found/NotFoundView.vue'),
        meta: { publicPage: true, title: '页面未找到' },
      },
    ],
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/console/auth/LoginView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/console',
    name: 'console-root',
    component: () => import('@/layouts/ConsoleLayout.vue'),
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
  const isConsoleTarget = to.path === '/console' || to.path.startsWith('/console/');

  if (!auth.ready) {
    await auth.bootstrap();
  }

  if (!auth.isAuthenticated && isConsoleTarget) {
    menus.reset(router);
    return '/login';
  }

  if (auth.isAuthenticated && (isConsoleTarget || to.meta.guestOnly)) {
    await menus.bootstrap(router);
  }

  if (auth.isAuthenticated && isConsoleTarget && menus.hasPagePath(to.path) && to.name === 'frontend-not-found') {
    return to.fullPath;
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return menus.homePath;
  }

  if (auth.isAuthenticated && to.path === '/console' && menus.homePath !== '/console') {
    return menus.homePath;
  }

  if (auth.isAuthenticated && isConsoleTarget && to.path !== '/console' && !menus.hasPagePath(to.path)) {
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

  if (to.matched.some((record) => record.meta.requiresAuth) && menus.hasPagePath(to.path)) {
    workbench.addVisitedTab(to.path);
  }
});
