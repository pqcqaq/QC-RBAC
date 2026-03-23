import type { MenuNodeFormPayload, MenuNodeRecord } from '@rbac/api-common';

export type MenuNodeType = MenuNodeFormPayload['type'];
export type EditorMode = 'create' | 'edit';
export type RootCreatableNodeType = Extract<MenuNodeType, 'DIRECTORY' | 'PAGE'>;

export const typeLabels: Record<MenuNodeType, string> = {
  DIRECTORY: '目录',
  PAGE: '页面',
  ACTION: '行为',
};

export const typeOptions = [
  { value: 'DIRECTORY', label: '目录' },
  { value: 'PAGE', label: '页面' },
  { value: 'ACTION', label: '行为' },
] satisfies Array<{ value: MenuNodeType; label: string }>;

export const resolveTypeLabel = (type: MenuNodeType) => typeLabels[type];

export const resolveEntityLabel = (type: MenuNodeType) => {
  if (type === 'ACTION') {
    return '行为';
  }

  if (type === 'PAGE') {
    return '页面';
  }

  return '目录';
};

export const resolveNameFieldLabel = (type: MenuNodeType) => {
  if (type === 'ACTION') {
    return '行为名称';
  }

  if (type === 'PAGE') {
    return '页面标题';
  }

  return '目录名称';
};

export const resolveCodeFieldLabel = (type: Exclude<MenuNodeType, 'ACTION'>) =>
  type === 'PAGE' ? '页面标识' : '目录标识';

export const resolveCodePlaceholder = (type: Exclude<MenuNodeType, 'ACTION'>) =>
  type === 'PAGE' ? '如 users / menus' : '如 system / operations';

export const deriveActionCodeFromPermissionCode = (permissionCode: string) => {
  const normalized = permissionCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'action';
};

export const flattenNodes = (nodes: MenuNodeRecord[]): MenuNodeRecord[] => nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);

export const findNodeById = (nodes: MenuNodeRecord[], id: string | null): MenuNodeRecord | null => {
  if (!id) {
    return null;
  }

  const queue = [...nodes];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.id === id) {
      return current;
    }

    queue.push(...current.children);
  }

  return null;
};

export const findNodePath = (nodes: MenuNodeRecord[], id: string | null): MenuNodeRecord[] => {
  if (!id) {
    return [];
  }

  for (const node of nodes) {
    if (node.id === id) {
      return [node];
    }

    const childPath = findNodePath(node.children, id);
    if (childPath.length) {
      return [node, ...childPath];
    }
  }

  return [];
};

export const collectExpandableIds = (nodes: MenuNodeRecord[]) => flattenNodes(nodes)
  .filter((node) => node.children.length > 0)
  .map((node) => node.id);

export const resolveNodeSubtitle = (node: Pick<MenuNodeRecord, 'type' | 'caption' | 'description' | 'permission'>) => {
  const caption = node.caption?.trim();
  if (caption) {
    return caption;
  }

  const description = node.description?.trim();
  if (description) {
    return description;
  }

  if (node.type === 'PAGE') {
    return '路由页面入口';
  }

  if (node.type === 'ACTION') {
    return node.permission?.name || '页面内操作权限';
  }

  return '用于组织页面分组与目录层级';
};

export const resolveStructureHint = (type: MenuNodeType) => {
  if (type === 'DIRECTORY') {
    return '目录下只能继续挂目录或页面，且目录本身不能绑定权限。';
  }

  if (type === 'PAGE') {
    return '页面节点必须配置 path 与 viewKey，且页面下只能挂行为节点。';
  }

  return '行为节点只能挂在页面下，建议直接关联一个权限；缺少权限时先新建权限再回填。';
};

export const resolvePermissionSummary = (node: Pick<MenuNodeRecord, 'type' | 'permission'>) => {
  if (node.type === 'DIRECTORY') {
    return '目录节点不绑定权限';
  }

  if (node.permission) {
    return `${node.permission.name} (${node.permission.code})`;
  }

  return '未绑定权限';
};

export const countDescendants = (node: MenuNodeRecord): number => node.children.reduce(
  (sum, child) => sum + 1 + countDescendants(child),
  0,
);

export const filterTree = (nodes: MenuNodeRecord[], query: string): MenuNodeRecord[] => {
  const keywordValue = query.trim().toLowerCase();
  if (!keywordValue) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const children = filterTree(node.children, query);
    const searchable = [
      node.title,
      node.caption ?? '',
      node.description ?? '',
      node.code,
      node.icon ?? '',
      node.path ?? '',
      node.viewKey ?? '',
      node.permission?.code ?? '',
    ].join(' ').toLowerCase();

    if (!searchable.includes(keywordValue) && !children.length) {
      return [];
    }

    return [{ ...node, children }];
  });
};

export const collectDescendantIds = (node: MenuNodeRecord | null): Set<string> => {
  if (!node) {
    return new Set<string>();
  }

  const ids = new Set<string>([node.id]);
  const queue = [...node.children];

  while (queue.length) {
    const current = queue.shift();
    if (!current || ids.has(current.id)) {
      continue;
    }

    ids.add(current.id);
    queue.push(...current.children);
  }

  return ids;
};
