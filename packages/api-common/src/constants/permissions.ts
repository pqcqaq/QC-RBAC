export const permissionCatalog = [
  { module: 'dashboard', code: 'dashboard.view', name: '查看仪表盘', action: 'read' },
  { module: 'audit', code: 'audit.read', name: '查看审计日志', action: 'read' },
  { module: 'user', code: 'user.read', name: '查看用户', action: 'read' },
  { module: 'user', code: 'user.create', name: '创建用户', action: 'create' },
  { module: 'user', code: 'user.update', name: '编辑用户', action: 'update' },
  { module: 'user', code: 'user.delete', name: '删除用户', action: 'delete' },
  { module: 'user', code: 'user.assign-role', name: '分配用户角色', action: 'assign' },
  { module: 'role', code: 'role.read', name: '查看角色', action: 'read' },
  { module: 'role', code: 'role.create', name: '创建角色', action: 'create' },
  { module: 'role', code: 'role.update', name: '编辑角色', action: 'update' },
  { module: 'role', code: 'role.delete', name: '删除角色', action: 'delete' },
  { module: 'role', code: 'role.assign-permission', name: '分配角色权限', action: 'assign' },
  { module: 'permission', code: 'permission.read', name: '查看权限', action: 'read' },
  { module: 'permission', code: 'permission.create', name: '创建权限', action: 'create' },
  { module: 'permission', code: 'permission.update', name: '编辑权限', action: 'update' },
  { module: 'permission', code: 'permission.delete', name: '删除权限', action: 'delete' },
  { module: 'rbac', code: 'rbac.explorer', name: '查看权限来源', action: 'read' },
  { module: 'file', code: 'file.upload', name: '上传文件', action: 'create' },
  { module: 'realtime', code: 'realtime.read', name: '查看实时频道', action: 'read' },
  { module: 'realtime', code: 'realtime.send', name: '发送实时消息', action: 'create' },
] as const;

export type PermissionCode = (typeof permissionCatalog)[number]['code'];

export const permissionsByModule = permissionCatalog.reduce<Record<string, Array<(typeof permissionCatalog)[number]>>>(
  (grouped, permission) => {
    grouped[permission.module] ??= [];
    grouped[permission.module].push(permission);
    return grouped;
  },
  {},
);

