import type { PrismaClient, Permission, Role } from '@prisma/client';
import { permissionCatalog } from '@rbac/api-common';
import { withSnowflakeId, withSnowflakeIds } from '../utils/persistence';

type SystemRoleSeed = {
  code: string;
  name: string;
  description: string;
  permissionCodes: string[];
};

type SystemMenuSeedNode = {
  code: string;
  type: 'DIRECTORY' | 'PAGE' | 'ACTION';
  title: string;
  caption?: string;
  description?: string;
  icon?: string;
  path?: string;
  viewKey?: string;
  sortOrder: number;
  permissionCode?: string;
  children?: SystemMenuSeedNode[];
};

const managerExcludedPermissions = new Set([
  'permission.delete',
  'role.delete',
  'user.delete',
  'menu.read',
  'menu.create',
  'menu.update',
  'menu.delete',
  'menu.assign-permission',
]);

const buildSystemRoleSeeds = (permissions: Permission[]): SystemRoleSeed[] => {
  const allPermissionCodes = permissions.map((item) => item.code);
  const managerPermissionCodes = permissions
    .filter((item) => !managerExcludedPermissions.has(item.code))
    .map((item) => item.code);
  const memberPermissionCodes = permissions
    .filter((item) => item.code === 'dashboard.view')
    .map((item) => item.code);

  return [
    {
      code: 'super-admin',
      name: '超级管理员',
      description: '拥有系统所有权限。',
      permissionCodes: allPermissionCodes,
    },
    {
      code: 'ops-manager',
      name: '运营经理',
      description: '可管理用户、角色并查看权限来源。',
      permissionCodes: managerPermissionCodes,
    },
    {
      code: 'member',
      name: '普通成员',
      description: '可登录并查看自己的权限信息。',
      permissionCodes: memberPermissionCodes,
    },
  ];
};

const defaultMenuTree: SystemMenuSeedNode[] = [
  {
    code: 'dashboard',
    type: 'PAGE',
    title: '战略总览',
    caption: 'Overview',
    description: '查看核心指标、角色分布、最近成员和审计动态。',
    icon: 'i-carbon-dashboard',
    path: '/dashboard',
    viewKey: 'dashboard',
    sortOrder: 10,
    permissionCode: 'dashboard.view',
  },
  {
    code: 'identity',
    type: 'DIRECTORY',
    title: '身份与授权',
    caption: 'Identity',
    description: '围绕用户、角色、权限与来源分析的统一管理区。',
    icon: 'i-carbon-user-role',
    sortOrder: 20,
    children: [
      {
        code: 'users',
        type: 'PAGE',
        title: '用户控制中心',
        caption: 'Users',
        description: '统一管理成员目录、角色绑定、账号状态和权限来源。',
        icon: 'i-carbon-user-multiple',
        path: '/users',
        viewKey: 'users',
        sortOrder: 10,
        permissionCode: 'user.read',
        children: [
          { code: 'users-create', type: 'ACTION', title: '创建用户', icon: 'i-carbon-add', sortOrder: 10, permissionCode: 'user.create' },
          { code: 'users-update', type: 'ACTION', title: '编辑用户', icon: 'i-carbon-edit', sortOrder: 20, permissionCode: 'user.update' },
          { code: 'users-delete', type: 'ACTION', title: '删除用户', icon: 'i-carbon-trash-can', sortOrder: 30, permissionCode: 'user.delete' },
          { code: 'users-assign-role', type: 'ACTION', title: '分配角色', icon: 'i-carbon-user-role', sortOrder: 40, permissionCode: 'user.assign-role' },
          { code: 'users-upload-avatar', type: 'ACTION', title: '上传头像', icon: 'i-carbon-cloud-upload', sortOrder: 50, permissionCode: 'file.upload' },
        ],
      },
      {
        code: 'roles',
        type: 'PAGE',
        title: '角色构造器',
        caption: 'Roles',
        description: '按职责组合权限，统一查看角色成员数、权限数和变更影响。',
        icon: 'i-carbon-badge',
        path: '/roles',
        viewKey: 'roles',
        sortOrder: 20,
        permissionCode: 'role.read',
        children: [
          { code: 'roles-create', type: 'ACTION', title: '创建角色', icon: 'i-carbon-add', sortOrder: 10, permissionCode: 'role.create' },
          { code: 'roles-update', type: 'ACTION', title: '编辑角色', icon: 'i-carbon-edit', sortOrder: 20, permissionCode: 'role.update' },
          { code: 'roles-delete', type: 'ACTION', title: '删除角色', icon: 'i-carbon-trash-can', sortOrder: 30, permissionCode: 'role.delete' },
          { code: 'roles-assign-permission', type: 'ACTION', title: '分配权限', icon: 'i-carbon-license', sortOrder: 40, permissionCode: 'role.assign-permission' },
        ],
      },
      {
        code: 'permissions',
        type: 'PAGE',
        title: '权限目录',
        caption: 'Permissions',
        description: '维护系统能力节点，区分系统种子权限与自定义权限。',
        icon: 'i-carbon-license',
        path: '/permissions',
        viewKey: 'permissions',
        sortOrder: 30,
        permissionCode: 'permission.read',
        children: [
          { code: 'permissions-create', type: 'ACTION', title: '创建权限', icon: 'i-carbon-add', sortOrder: 10, permissionCode: 'permission.create' },
          { code: 'permissions-update', type: 'ACTION', title: '编辑权限', icon: 'i-carbon-edit', sortOrder: 20, permissionCode: 'permission.update' },
          { code: 'permissions-delete', type: 'ACTION', title: '删除权限', icon: 'i-carbon-trash-can', sortOrder: 30, permissionCode: 'permission.delete' },
        ],
      },
      {
        code: 'explorer',
        type: 'PAGE',
        title: '权限来源分析',
        caption: 'Trace',
        description: '按用户拆解有效权限的角色来源，用于排查过度授权。',
        icon: 'i-carbon-search',
        path: '/explorer',
        viewKey: 'explorer',
        sortOrder: 40,
        permissionCode: 'rbac.explorer',
      },
    ],
  },
  {
    code: 'operations',
    type: 'DIRECTORY',
    title: '运行态',
    caption: 'Runtime',
    description: '查看系统审计、消息流和实时事件。',
    icon: 'i-carbon-activity',
    sortOrder: 30,
    children: [
      {
        code: 'audit',
        type: 'PAGE',
        title: '审计日志',
        caption: 'Audit',
        description: '检索登录、授权、删除、实时消息等全链路留痕记录。',
        icon: 'i-carbon-cloud-auditing',
        path: '/audit',
        viewKey: 'audit',
        sortOrder: 10,
        permissionCode: 'audit.read',
      },
      {
        code: 'live',
        type: 'PAGE',
        title: '实时协作台',
        caption: 'Live',
        description: '查看在线事件、团队广播和协同消息流。',
        icon: 'i-carbon-flash',
        path: '/live',
        viewKey: 'live',
        sortOrder: 20,
        permissionCode: 'realtime.read',
        children: [
          { code: 'live-send', type: 'ACTION', title: '发送实时消息', icon: 'i-carbon-chevron-right', sortOrder: 10, permissionCode: 'realtime.send' },
        ],
      },
    ],
  },
  {
    code: 'system',
    type: 'DIRECTORY',
    title: '系统配置',
    caption: 'System',
    description: '维护系统自身的导航结构与操作映射。',
    icon: 'i-carbon-settings',
    sortOrder: 40,
    children: [
      {
        code: 'menus',
        type: 'PAGE',
        title: '菜单结构管理',
        caption: 'Menus',
        description: '管理目录、页面和行为节点，并给页面与行为分配权限。',
        icon: 'i-carbon-tree-view-alt',
        path: '/menus',
        viewKey: 'menus',
        sortOrder: 10,
        permissionCode: 'menu.read',
        children: [
          { code: 'menus-create', type: 'ACTION', title: '创建菜单节点', icon: 'i-carbon-add', sortOrder: 10, permissionCode: 'menu.create' },
          { code: 'menus-update', type: 'ACTION', title: '编辑菜单节点', icon: 'i-carbon-edit', sortOrder: 20, permissionCode: 'menu.update' },
          { code: 'menus-delete', type: 'ACTION', title: '删除菜单节点', icon: 'i-carbon-trash-can', sortOrder: 30, permissionCode: 'menu.delete' },
          { code: 'menus-assign-permission', type: 'ACTION', title: '分配菜单权限', icon: 'i-carbon-license', sortOrder: 40, permissionCode: 'menu.assign-permission' },
        ],
      },
      {
        code: 'clients',
        type: 'PAGE',
        title: '客户端管理',
        caption: 'Clients',
        description: '维护 Web、小程序与 App 客户端身份、密钥与差异化配置。',
        icon: 'i-carbon-device-accessibility',
        path: '/clients',
        viewKey: 'clients',
        sortOrder: 20,
        permissionCode: 'client.read',
        children: [
          { code: 'clients-create', type: 'ACTION', title: '创建客户端', icon: 'i-carbon-add', sortOrder: 10, permissionCode: 'client.create' },
          { code: 'clients-update', type: 'ACTION', title: '编辑客户端', icon: 'i-carbon-edit', sortOrder: 20, permissionCode: 'client.update' },
          { code: 'clients-delete', type: 'ACTION', title: '删除客户端', icon: 'i-carbon-trash-can', sortOrder: 30, permissionCode: 'client.delete' },
        ],
      },
    ],
  },
];

const ensureSeedPermissions = async (prisma: PrismaClient) => {
  const permissions: Permission[] = [];

  for (const permission of permissionCatalog) {
    const persisted = await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        module: permission.module,
        action: permission.action,
        description: `${permission.module} / ${permission.action}`,
      },
      create: withSnowflakeId({
        code: permission.code,
        name: permission.name,
        module: permission.module,
        action: permission.action,
        description: `${permission.module} / ${permission.action}`,
      }),
    });

    permissions.push(persisted);
  }

  return new Map(permissions.map((permission) => [permission.code, permission]));
};

const ensureSystemRoles = async (prisma: PrismaClient, permissionByCode: Map<string, Permission>) => {
  const roleByCode = new Map<string, Role>();

  for (const seed of buildSystemRoleSeeds([...permissionByCode.values()])) {
    const role = await prisma.role.upsert({
      where: { code: seed.code },
      update: {
        name: seed.name,
        description: seed.description,
        isSystem: true,
      },
      create: withSnowflakeId({
        code: seed.code,
        name: seed.name,
        description: seed.description,
        isSystem: true,
      }),
    });

    roleByCode.set(role.code, role);

    const desiredPermissionIds = seed.permissionCodes
      .map((code) => permissionByCode.get(code)?.id)
      .filter((permissionId): permissionId is string => Boolean(permissionId));
    const existingLinks = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    const existingIds = new Set(existingLinks.map((item) => item.permissionId));
    const missingIds = desiredPermissionIds.filter((permissionId) => !existingIds.has(permissionId));

    if (missingIds.length) {
      await prisma.rolePermission.createMany({
        data: withSnowflakeIds(missingIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        }))),
        skipDuplicates: true,
      });
    }
  }

  return roleByCode;
};

const ensureMenuTree = async (
  prisma: PrismaClient,
  nodes: SystemMenuSeedNode[],
  permissionByCode: Map<string, Permission>,
  parentId: string | null = null,
) => {
  for (const node of nodes) {
    const existed = await prisma.menuNode.findUnique({
      where: { code: node.code },
      select: { id: true },
    });
    const created = existed
      ? { id: existed.id }
      : await prisma.menuNode.create({
          data: withSnowflakeId({
            code: node.code,
            type: node.type,
            title: node.title,
            caption: node.caption,
            description: node.description,
            icon: node.icon,
            path: node.type === 'PAGE' ? node.path : null,
            viewKey: node.type === 'PAGE' ? node.viewKey : null,
            sortOrder: node.sortOrder,
            parentId,
            permissionId: node.permissionCode ? permissionByCode.get(node.permissionCode)?.id : null,
          }),
        });

    if (node.children?.length) {
      await ensureMenuTree(prisma, node.children, permissionByCode, created.id);
    }
  }
};

const ensureDefaultMenuTree = async (prisma: PrismaClient, permissionByCode: Map<string, Permission>) => {
  await ensureMenuTree(prisma, defaultMenuTree, permissionByCode);
};

export const bootstrapSystemRbac = async (prisma: PrismaClient) => {
  const permissionByCode = await ensureSeedPermissions(prisma);
  const roleByCode = await ensureSystemRoles(prisma, permissionByCode);
  await ensureDefaultMenuTree(prisma, permissionByCode);

  return {
    permissionByCode,
    roleByCode,
  };
};
