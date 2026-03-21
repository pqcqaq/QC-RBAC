import { createRouter, createWebHistory } from 'vue-router';
import { pageRoutes, pageRegistryMap } from '@/meta/pages';
import { useAuthStore } from '@/stores/auth';
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
    component: () => import('@/layouts/ShellLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      ...pageRoutes,
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia);
  if (!auth.ready) {
    await auth.bootstrap();
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return '/dashboard';
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return '/login';
  }

  if (typeof to.meta.permission === 'string' && !auth.hasPermission(to.meta.permission)) {
    return '/dashboard';
  }

  return true;
});

router.afterEach((to) => {
  const workbench = useWorkbenchStore(pinia);
  workbench.bootstrap();

  if (to.meta.requiresAuth && pageRegistryMap[to.path]) {
    workbench.addVisitedTab(to.path);
  }
});
