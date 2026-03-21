import type { MenuNodeRecord } from '@rbac/api-common';
import type { RouteRecordRaw, Router } from 'vue-router';
import { defineStore } from 'pinia';
import { api } from '@/api/client';
import { pageRegistryMap } from '@/meta/pages';

const CONSOLE_NAMESPACE = '/console';

const toConsolePath = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedPath === '/' ? CONSOLE_NAMESPACE : `${CONSOLE_NAMESPACE}${normalizedPath}`;
};

const mapConsoleNamespace = (nodes: MenuNodeRecord[]): MenuNodeRecord[] => nodes.map((node) => ({
  ...node,
  path: node.path ? toConsolePath(node.path) : node.path,
  children: mapConsoleNamespace(node.children),
}));

const flattenPages = (nodes: MenuNodeRecord[]): MenuNodeRecord[] => nodes.flatMap((node) => {
  if (node.type === 'PAGE') {
    return [node, ...flattenPages(node.children)];
  }

  return flattenPages(node.children);
});

const stripActionNodes = (nodes: MenuNodeRecord[]): MenuNodeRecord[] => nodes.flatMap((node) => {
  if (node.type === 'ACTION') {
    return [];
  }

  if (node.type === 'DIRECTORY') {
    const children = stripActionNodes(node.children);
    if (!children.length) {
      return [];
    }

    return [{ ...node, children }];
  }

  return [{ ...node, children: [] }];
});

const buildPageLookup = (nodes: MenuNodeRecord[]) => Object.fromEntries(
  flattenPages(nodes)
    .filter((node): node is MenuNodeRecord & { path: string; viewKey: string } => Boolean(node.path && node.viewKey))
    .map((node) => [node.path, node]),
) as Record<string, MenuNodeRecord & { path: string; viewKey: string }>;

const buildBreadcrumbMap = (nodes: MenuNodeRecord[]) => {
  const breadcrumbMap: Record<string, MenuNodeRecord[]> = {};

  const visit = (items: MenuNodeRecord[], parents: MenuNodeRecord[]) => {
    items.forEach((node) => {
      const nextParents = [...parents, node];

      if (node.path) {
        breadcrumbMap[node.path] = nextParents;
      }

      if (node.children.length) {
        visit(node.children, nextParents);
      }
    });
  };

  visit(nodes, []);
  return breadcrumbMap;
};

const toRouteName = (menuNode: MenuNodeRecord) => `menu:${menuNode.id}`;

export const useMenuStore = defineStore('menus', {
  state: () => ({
    ready: false,
    loading: false,
    tree: [] as MenuNodeRecord[],
    addedRouteNames: [] as string[],
  }),
  getters: {
    routedTree: (state) => mapConsoleNamespace(state.tree),
    navigationTree(): MenuNodeRecord[] {
      return stripActionNodes(this.routedTree);
    },
    pageMapByPath(): Record<string, MenuNodeRecord & { path: string; viewKey: string }> {
      return buildPageLookup(this.routedTree);
    },
    breadcrumbsByPath(): Record<string, MenuNodeRecord[]> {
      return buildBreadcrumbMap(this.routedTree);
    },
    pages(): Array<MenuNodeRecord & { path: string; viewKey: string }> {
      return Object.values(this.pageMapByPath);
    },
    homePath(): string {
      return this.pages[0]?.path ?? CONSOLE_NAMESPACE;
    },
    hasPagePath(): (path: string) => boolean {
      return (path: string) => Boolean(this.pageMapByPath[path]);
    },
    getPageByPath(): (path: string) => (MenuNodeRecord & { path: string; viewKey: string }) | undefined {
      return (path: string) => this.pageMapByPath[path];
    },
    getBreadcrumbs(): (path: string) => MenuNodeRecord[] {
      return (path: string) => this.breadcrumbsByPath[path] ?? [];
    },
  },
  actions: {
    removeDynamicRoutes(router: Router) {
      this.addedRouteNames.forEach((name) => {
        if (router.hasRoute(name)) {
          router.removeRoute(name);
        }
      });
      this.addedRouteNames = [];
    },
    syncRoutes(router: Router) {
      this.removeDynamicRoutes(router);

      const nextRouteNames: string[] = [];
      this.pages.forEach((node) => {
        const pageDefinition = pageRegistryMap[node.viewKey];
        if (!pageDefinition) {
          throw new Error(`Missing page definition for viewKey: ${node.viewKey}`);
        }

        const routeName = toRouteName(node);
        const routeRecord: RouteRecordRaw = {
          path: node.path,
          name: routeName,
          component: pageDefinition.component,
          meta: {
            requiresAuth: true,
            menuId: node.id,
            viewKey: node.viewKey,
            permission: node.permission?.code,
            keepAlive: pageDefinition.keepAlive,
            cacheName: pageDefinition.cacheName,
            title: node.title || pageDefinition.title || '控制台',
            caption: node.caption || pageDefinition.caption || 'Workbench',
            description: node.description || pageDefinition.description || '',
            code: node.code || pageDefinition.code || '',
          },
        };

        router.addRoute('console-root', routeRecord);
        nextRouteNames.push(routeName);
      });

      this.addedRouteNames = nextRouteNames;
    },
    async refresh(router: Router) {
      this.loading = true;

      try {
        this.tree = await api.menus.current();
        this.syncRoutes(router);
        this.ready = true;
      } finally {
        this.loading = false;
      }
    },
    async bootstrap(router: Router) {
      if (this.ready || this.loading) {
        return;
      }

      await this.refresh(router);
    },
    reset(router?: Router) {
      if (router) {
        this.removeDynamicRoutes(router);
      }

      this.ready = false;
      this.loading = false;
      this.tree = [];
    },
  },
});
