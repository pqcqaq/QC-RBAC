import type { MenuNodeFormPayload, MenuNodeRecord } from '@rbac/api-common';
import type { MenuNodeType, Permission, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../utils/errors.js';
import { toPermissionSummary } from '../utils/rbac-records.js';

const menuNodeInclude = {
  permission: true,
} satisfies Prisma.MenuNodeInclude;

type MenuNodeRow = Prisma.MenuNodeGetPayload<{
  include: typeof menuNodeInclude;
}>;

type MenuNodeIdentity = {
  id: string;
  parentId: string | null;
  type: MenuNodeType;
};

const compareRows = (left: Pick<MenuNodeRow, 'sortOrder' | 'createdAt' | 'code'>, right: Pick<MenuNodeRow, 'sortOrder' | 'createdAt' | 'code'>) => {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  if (left.createdAt.getTime() !== right.createdAt.getTime()) {
    return left.createdAt.getTime() - right.createdAt.getTime();
  }

  return left.code.localeCompare(right.code, 'zh-CN');
};

const mapMenuNode = (node: MenuNodeRow): MenuNodeRecord => ({
  id: node.id,
  code: node.code,
  type: node.type,
  title: node.title,
  caption: node.caption ?? undefined,
  description: node.description ?? undefined,
  icon: node.icon ?? undefined,
  path: node.path ?? undefined,
  viewKey: node.viewKey ?? undefined,
  sortOrder: node.sortOrder,
  parentId: node.parentId,
  permissionId: node.permissionId,
  permission: node.permission ? toPermissionSummary(node.permission) : undefined,
  children: [],
  createdAt: node.createdAt.toISOString(),
  updatedAt: node.updatedAt.toISOString(),
});

const buildMenuTree = (rows: MenuNodeRow[]): MenuNodeRecord[] => {
  const nodeMap = new Map<string, MenuNodeRecord>();

  rows.forEach((row) => {
    nodeMap.set(row.id, mapMenuNode(row));
  });

  const roots: MenuNodeRecord[] = [];
  rows
    .slice()
    .sort(compareRows)
    .forEach((row) => {
      const current = nodeMap.get(row.id);
      if (!current) {
        return;
      }

      if (row.parentId) {
        const parent = nodeMap.get(row.parentId);
        if (parent) {
          parent.children.push(current);
          return;
        }
      }

      roots.push(current);
    });

  const sortTree = (nodes: MenuNodeRecord[]) => {
    nodes.sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.code.localeCompare(right.code, 'zh-CN');
    });

    nodes.forEach((node) => sortTree(node.children));
  };

  sortTree(roots);
  return roots;
};

const normalizeOptionalString = (value?: string | null) => {
  const nextValue = value?.trim();
  return nextValue ? nextValue : null;
};

const assertParentType = (type: MenuNodeType, parentType: MenuNodeType | null) => {
  if (type === 'ACTION') {
    if (parentType !== 'PAGE') {
      throw badRequest('行为节点只能挂在页面节点下');
    }
    return;
  }

  if (type === 'PAGE' && parentType && parentType !== 'DIRECTORY') {
    throw badRequest('页面节点只能挂在目录节点下');
  }

  if (type === 'DIRECTORY' && parentType && parentType !== 'DIRECTORY') {
    throw badRequest('目录节点只能挂在目录节点下');
  }
};

const assertChildTypes = (type: MenuNodeType, childTypes: MenuNodeType[]) => {
  if (type === 'ACTION' && childTypes.length > 0) {
    throw badRequest('行为节点下不能再有子节点');
  }

  if (type === 'PAGE' && childTypes.some((item) => item !== 'ACTION')) {
    throw badRequest('页面节点下只能存在行为节点');
  }

  if (type === 'DIRECTORY' && childTypes.some((item) => item !== 'DIRECTORY' && item !== 'PAGE')) {
    throw badRequest('目录节点下只能存在目录或页面节点');
  }
};

const collectDescendantIds = (nodes: MenuNodeIdentity[], nodeId: string): Set<string> => {
  const childrenByParentId = new Map<string | null, MenuNodeIdentity[]>();

  nodes.forEach((node) => {
    const siblings = childrenByParentId.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParentId.set(node.parentId, siblings);
  });

  const visited = new Set<string>();
  const queue = [nodeId];

  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    const children = childrenByParentId.get(currentId) ?? [];
    children.forEach((child) => {
      queue.push(child.id);
    });
  }

  return visited;
};

const loadPermissionIfNeeded = async (permissionId: string | null) => {
  if (!permissionId) {
    return null;
  }

  const permission = await prisma.permission.findUnique({
    where: { id: permissionId },
  });

  if (!permission) {
    throw badRequest('关联的权限不存在');
  }

  return permission;
};

const validateMenuPayload = async (
  payload: MenuNodeFormPayload,
  currentNodeId?: string,
) => {
  const code = payload.code.trim();
  const title = payload.title.trim();
  const caption = normalizeOptionalString(payload.caption);
  const description = normalizeOptionalString(payload.description);
  const icon = normalizeOptionalString(payload.icon);
  const path = normalizeOptionalString(payload.path);
  const viewKey = normalizeOptionalString(payload.viewKey);
  const parentId = normalizeOptionalString(payload.parentId);
  const permissionId = normalizeOptionalString(payload.permissionId);
  const allNodes = await prisma.menuNode.findMany({
    select: {
      id: true,
      parentId: true,
      type: true,
    },
  });

  const currentChildren = currentNodeId
    ? allNodes.filter((node) => node.parentId === currentNodeId).map((node) => node.type)
    : [];

  if (currentNodeId && parentId === currentNodeId) {
    throw badRequest('父节点不能选择自己');
  }

  let parentType: MenuNodeType | null = null;
  if (parentId) {
    const parent = allNodes.find((node) => node.id === parentId);
    if (!parent) {
      throw badRequest('父节点不存在');
    }
    parentType = parent.type;

    if (currentNodeId) {
      const descendantIds = collectDescendantIds(allNodes, currentNodeId);
      if (descendantIds.has(parentId)) {
        throw badRequest('父节点不能选择当前节点的子孙节点');
      }
    }
  }

  assertParentType(payload.type, parentType);
  assertChildTypes(payload.type, currentChildren);

  if (!code) {
    throw badRequest('节点编码不能为空');
  }
  if (!title) {
    throw badRequest('节点标题不能为空');
  }
  if (!Number.isInteger(payload.sortOrder)) {
    throw badRequest('排序值必须是整数');
  }

  if (payload.type === 'DIRECTORY') {
    if (path || viewKey || permissionId) {
      throw badRequest('目录节点不能配置页面路径、视图或权限');
    }
  }

  if (payload.type === 'PAGE') {
    if (!path || !path.startsWith('/')) {
      throw badRequest('页面节点必须配置以 / 开头的路径');
    }
    if (!viewKey) {
      throw badRequest('页面节点必须配置视图标识');
    }
  }

  if (payload.type === 'ACTION' && (path || viewKey)) {
    throw badRequest('行为节点不能配置页面路径或视图');
  }

  await loadPermissionIfNeeded(permissionId);

  return {
    code,
    type: payload.type,
    title,
    caption,
    description,
    icon,
    path: payload.type === 'PAGE' ? path : null,
    viewKey: payload.type === 'PAGE' ? viewKey : null,
    sortOrder: payload.sortOrder,
    parentId,
    permissionId: payload.type === 'DIRECTORY' ? null : permissionId,
  } satisfies Prisma.MenuNodeUncheckedCreateInput;
};

export const getMenuTree = async () => {
  const rows = await prisma.menuNode.findMany({
    include: menuNodeInclude,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { code: 'asc' }],
  });

  return buildMenuTree(rows);
};

export const getCurrentUserMenuTree = async (permissionCodes: string[]) => {
  const allowedPermissions = new Set(permissionCodes);

  const filterNodes = (nodes: MenuNodeRecord[]): MenuNodeRecord[] => nodes.flatMap((node) => {
    const children = filterNodes(node.children);

    if (node.type === 'DIRECTORY') {
      if (!children.length) {
        return [];
      }

      return [{ ...node, children }];
    }

    const permissionCode = node.permission?.code;
    const canAccess = !permissionCode || allowedPermissions.has(permissionCode);

    if (!canAccess) {
      return [];
    }

    return [{ ...node, children: node.type === 'PAGE' ? children : [] }];
  });

  return filterNodes(await getMenuTree());
};

export const getMenuNodeOrThrow = async (menuId: string) => {
  const tree = await getMenuTree();
  const queue = [...tree];

  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.id === menuId) {
      return current;
    }

    queue.push(...current.children);
  }

  throw notFound('菜单节点不存在');
};

export const createMenuNode = async (payload: MenuNodeFormPayload) => {
  const data = await validateMenuPayload(payload);
  const created = await prisma.menuNode.create({ data });
  return getMenuNodeOrThrow(created.id);
};

export const updateMenuNode = async (menuId: string, payload: MenuNodeFormPayload) => {
  const existed = await prisma.menuNode.findUnique({
    where: { id: menuId },
    select: { id: true },
  });

  if (!existed) {
    throw notFound('菜单节点不存在');
  }

  const data = await validateMenuPayload(payload, menuId);
  await prisma.menuNode.update({
    where: { id: menuId },
    data,
  });

  return getMenuNodeOrThrow(menuId);
};

export const deleteMenuNode = async (menuId: string) => {
  const nodes = await prisma.menuNode.findMany({
    select: {
      id: true,
      parentId: true,
      type: true,
    },
  });

  if (!nodes.some((node) => node.id === menuId)) {
    throw notFound('菜单节点不存在');
  }

  const ids = [...collectDescendantIds(nodes, menuId)];
  await prisma.menuNode.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  });

  return ids;
};
