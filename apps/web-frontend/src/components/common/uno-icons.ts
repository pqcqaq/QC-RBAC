export type UnoIconOption = {
  value: string;
  label: string;
  group: string;
  keywords: string[];
};

export type MenuIconLike = {
  code: string;
  type: 'DIRECTORY' | 'PAGE' | 'ACTION';
  icon?: string | null;
};

export const menuIconCatalog = [
  { value: 'i-carbon-home', label: '首页', group: '导航', keywords: ['home', 'landing', 'index'] },
  { value: 'i-carbon-dashboard', label: '仪表盘', group: '导航', keywords: ['dashboard', 'overview', 'summary'] },
  { value: 'i-carbon-apps', label: '应用矩阵', group: '导航', keywords: ['apps', 'grid', 'workspace'] },
  { value: 'i-carbon-grid', label: '网格', group: '导航', keywords: ['grid', 'layout'] },
  { value: 'i-carbon-folder', label: '目录', group: '导航', keywords: ['folder', 'directory'] },
  { value: 'i-carbon-folder-open', label: '展开目录', group: '导航', keywords: ['folder', 'open'] },
  { value: 'i-carbon-folder-tree', label: '树目录', group: '导航', keywords: ['folder', 'tree', 'menu'] },
  { value: 'i-carbon-tree-view-alt', label: '树视图', group: '导航', keywords: ['tree', 'menu', 'navigation'] },
  { value: 'i-carbon-document', label: '页面文档', group: '内容', keywords: ['document', 'page', 'view'] },
  { value: 'i-carbon-document-view', label: '文档预览', group: '内容', keywords: ['document', 'view', 'page'] },
  { value: 'i-carbon-catalog', label: '目录册', group: '内容', keywords: ['catalog', 'library', 'collection'] },
  { value: 'i-carbon-search', label: '搜索', group: '内容', keywords: ['search', 'explorer', 'trace'] },
  { value: 'i-carbon-user-avatar', label: '用户', group: '身份', keywords: ['user', 'profile', 'member'] },
  { value: 'i-carbon-user-multiple', label: '多用户', group: '身份', keywords: ['users', 'members', 'team'] },
  { value: 'i-carbon-user-role', label: '角色', group: '身份', keywords: ['role', 'identity'] },
  { value: 'i-carbon-badge', label: '徽章', group: '身份', keywords: ['badge', 'role', 'permission'] },
  { value: 'i-carbon-license', label: '许可', group: '身份', keywords: ['permission', 'license', 'grant'] },
  { value: 'i-carbon-security', label: '安全', group: '身份', keywords: ['security', 'auth', 'guard'] },
  { value: 'i-carbon-locked', label: '锁定', group: '身份', keywords: ['lock', 'secure', 'permission'] },
  { value: 'i-carbon-activity', label: '活动', group: '运行', keywords: ['activity', 'operations', 'runtime'] },
  { value: 'i-carbon-cloud-auditing', label: '审计', group: '运行', keywords: ['audit', 'history', 'log'] },
  { value: 'i-carbon-flash', label: '实时', group: '运行', keywords: ['live', 'realtime', 'flash'] },
  { value: 'i-carbon-time', label: '时间', group: '运行', keywords: ['time', 'schedule', 'clock'] },
  { value: 'i-carbon-chart-column', label: '柱状图', group: '运行', keywords: ['chart', 'analytics', 'metrics'] },
  { value: 'i-carbon-chart-ring', label: '环形图', group: '运行', keywords: ['chart', 'ratio', 'metrics'] },
  { value: 'i-carbon-settings', label: '设置', group: '系统', keywords: ['settings', 'system', 'config'] },
  { value: 'i-carbon-settings-services', label: '服务设置', group: '系统', keywords: ['settings', 'services', 'system'] },
  { value: 'i-carbon-data-base', label: '数据', group: '系统', keywords: ['database', 'data', 'storage'] },
  { value: 'i-carbon-api', label: '接口', group: '系统', keywords: ['api', 'endpoint', 'service'] },
  { value: 'i-carbon-code', label: '代码', group: '系统', keywords: ['code', 'developer', 'action'] },
  { value: 'i-carbon-cloud-upload', label: '上传', group: '动作', keywords: ['upload', 'file', 'avatar'] },
  { value: 'i-carbon-add', label: '新增', group: '动作', keywords: ['add', 'create', 'new'] },
  { value: 'i-carbon-edit', label: '编辑', group: '动作', keywords: ['edit', 'update', 'write'] },
  { value: 'i-carbon-trash-can', label: '删除', group: '动作', keywords: ['delete', 'remove', 'trash'] },
  { value: 'i-carbon-checkmark', label: '确认', group: '动作', keywords: ['check', 'confirm', 'success'] },
  { value: 'i-carbon-close', label: '关闭', group: '动作', keywords: ['close', 'dismiss', 'cancel'] },
  { value: 'i-carbon-chevron-right', label: '跳转', group: '动作', keywords: ['next', 'goto', 'arrow'] },
  { value: 'i-carbon-dot-mark', label: '动作点', group: '动作', keywords: ['dot', 'action'] },
] satisfies UnoIconOption[];

export const menuIconPrefetchList = Array.from(
  new Set(menuIconCatalog.map((item) => item.value)),
);

const menuIconLookup = new Map<string, UnoIconOption>(
  menuIconCatalog.map((item) => [item.value, item]),
);

const menuCodeIconMap: Record<string, string> = {
  dashboard: 'i-carbon-dashboard',
  identity: 'i-carbon-user-role',
  users: 'i-carbon-user-multiple',
  roles: 'i-carbon-badge',
  permissions: 'i-carbon-license',
  explorer: 'i-carbon-search',
  operations: 'i-carbon-activity',
  audit: 'i-carbon-cloud-auditing',
  live: 'i-carbon-flash',
  system: 'i-carbon-settings',
  menus: 'i-carbon-tree-view-alt',
};

const menuTypeFallbackIconMap = {
  DIRECTORY: 'i-carbon-folder',
  PAGE: 'i-carbon-document',
  ACTION: 'i-carbon-dot-mark',
} satisfies Record<MenuIconLike['type'], string>;

export const findMenuIconOption = (value?: string | null) => {
  const nextValue = value?.trim();
  if (!nextValue) {
    return null;
  }

  return menuIconLookup.get(nextValue) ?? null;
};

export const resolveMenuNodeIcon = (node: MenuIconLike) => {
  const storedIcon = node.icon?.trim();
  if (storedIcon) {
    return storedIcon;
  }

  return menuCodeIconMap[node.code] ?? menuTypeFallbackIconMap[node.type];
};
