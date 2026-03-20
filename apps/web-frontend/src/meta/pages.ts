import type { RouteRecordRaw } from 'vue-router';

export type PageRegistryItem = {
  order: number;
  path: string;
  name: string;
  title: string;
  caption: string;
  description: string;
  permission: string;
  view: string;
  code: string;
  keepAlive: boolean;
};

const configModules = import.meta.glob('./pages/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, PageRegistryItem>;

const viewModules = import.meta.glob('../views/**/*.vue');

export const pageRegistry = Object.values(configModules)
  .sort((left, right) => left.order - right.order)
  .map((item) => {
    const component = viewModules[`../views/${item.view}`];
    if (!component) {
      throw new Error(`Missing page view: ${item.view}`);
    }
    return {
      ...item,
      component,
    };
  });

export const pageRegistryMap = Object.fromEntries(
  pageRegistry.map((item) => [item.path, item]),
);

export const pageRoutes: RouteRecordRaw[] = pageRegistry.map((item) => ({
  path: item.path,
  name: item.name,
  component: item.component,
  meta: {
    requiresAuth: true,
    permission: item.permission,
    keepAlive: item.keepAlive,
    title: item.title,
    caption: item.caption,
    description: item.description,
    code: item.code,
  },
}));
