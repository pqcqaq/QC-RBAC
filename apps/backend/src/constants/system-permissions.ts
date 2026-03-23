export type SystemPermissionSeed = {
  module: string;
  code: string;
  name: string;
  action: string;
};

export const systemPermissionCatalog: readonly SystemPermissionSeed[] = [
  { module: 'dashboard', code: 'dashboard.view', name: '查看仪表盘', action: 'read' },
  { module: 'audit', code: 'audit.read', name: '查看审计日志', action: 'read' },
  { module: 'menu', code: 'menu.read', name: '查看菜单管理', action: 'read' },
  { module: 'menu', code: 'menu.create', name: '创建菜单节点', action: 'create' },
  { module: 'menu', code: 'menu.update', name: '编辑菜单节点', action: 'update' },
  { module: 'menu', code: 'menu.delete', name: '删除菜单节点', action: 'delete' },
  { module: 'menu', code: 'menu.assign-permission', name: '分配菜单权限', action: 'assign' },
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
  { module: 'client', code: 'client.read', name: '查看客户端', action: 'read' },
  { module: 'client', code: 'client.create', name: '创建客户端', action: 'create' },
  { module: 'client', code: 'client.update', name: '编辑客户端', action: 'update' },
  { module: 'client', code: 'client.delete', name: '删除客户端', action: 'delete' },
  { module: 'oauth-provider', code: 'oauth-provider.read', name: '查看 OAuth 供应商', action: 'read' },
  { module: 'oauth-provider', code: 'oauth-provider.create', name: '创建 OAuth 供应商', action: 'create' },
  { module: 'oauth-provider', code: 'oauth-provider.update', name: '编辑 OAuth 供应商', action: 'update' },
  { module: 'oauth-provider', code: 'oauth-provider.delete', name: '删除 OAuth 供应商', action: 'delete' },
  { module: 'oauth-application', code: 'oauth-application.read', name: '查看 OAuth 应用', action: 'read' },
  { module: 'oauth-application', code: 'oauth-application.create', name: '创建 OAuth 应用', action: 'create' },
  { module: 'oauth-application', code: 'oauth-application.update', name: '编辑 OAuth 应用', action: 'update' },
  { module: 'oauth-application', code: 'oauth-application.delete', name: '删除 OAuth 应用', action: 'delete' },
  { module: 'rbac', code: 'rbac.explorer', name: '查看权限来源', action: 'read' },
  { module: 'file', code: 'file.read', name: '查看附件', action: 'read' },
  { module: 'file', code: 'file.upload', name: '上传文件', action: 'create' },
  { module: 'file', code: 'file.update', name: '编辑附件', action: 'update' },
  { module: 'file', code: 'file.delete', name: '删除附件', action: 'delete' },
  { module: 'realtime', code: 'realtime.read', name: '查看实时频道', action: 'read' },
  { module: 'realtime', code: 'realtime.send', name: '发送实时消息', action: 'create' },
] as const;
