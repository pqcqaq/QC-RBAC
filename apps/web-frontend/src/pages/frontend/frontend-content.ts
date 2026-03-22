export const frontendNavItems = [
  { label: '项目首页', to: '/', eyebrow: '概览' },
  { label: '系统结构', to: '/architecture', eyebrow: '结构' },
  { label: '登录方式', to: '/authentication', eyebrow: '认证' },
] as const;

export const projectSignals = [
  { label: '登录方式', value: '3', note: '账号密码、邮箱验证码、手机验证码' },
  { label: '客户端', value: '2', note: '支持 Web 控制台与小程序接入' },
  { label: '管理对象', value: '4', note: '用户、角色、权限、菜单统一管理' },
  { label: '审计支持', value: '全链路', note: '关键操作可追踪' },
] as const;

export const capabilityCards = [
  {
    title: '控制台工作区',
    eyebrow: '工作台',
    description: '统一承载菜单、用户、角色和权限管理。',
    bullets: ['支持动态菜单装配', '页面、面包屑和标签页保持一致'],
  },
  {
    title: '多种登录方式',
    eyebrow: '认证',
    description: '根据当前配置展示可用的登录和注册方式。',
    bullets: ['支持账号密码、邮箱验证码、手机验证码', '本地环境可直接查看测试验证码'],
  },
  {
    title: '审计与追踪',
    eyebrow: '审计',
    description: '关键操作保留记录，便于排查和复核。',
    bullets: ['统一记录时间与操作人', '支持逻辑删除留痕'],
  },
] as const;

export const consoleHighlights = [
  {
    title: '菜单与页面联动',
    description: '菜单配置完成后，可直接映射到控制台页面。',
  },
  {
    title: '角色与权限管理',
    description: '用户、角色、权限支持统一维护、检索和编辑。',
  },
  {
    title: '按权限展示功能',
    description: '无权限操作会自动隐藏，减少误操作。',
  },
] as const;

export const architectureLayers = [
  {
    title: '公开页面',
    summary: '用于展示系统概览并提供控制台入口。',
    details: ['可直接访问首页、结构页和登录方式页', '统一承载导航和入口信息'],
  },
  {
    title: '控制台',
    summary: '承载实际业务操作和权限管理。',
    details: ['页面访问由菜单和权限共同决定', '保留标签页和面包屑等工作台能力'],
  },
  {
    title: '认证入口',
    summary: '统一提供登录、注册和验证码校验能力。',
    details: ['按配置展示可用方式', '支持区分不同客户端来源'],
  },
  {
    title: '审计记录',
    summary: '保留关键操作和数据变更的追踪信息。',
    details: ['关键动作可回看', '支持逻辑删除留痕'],
  },
] as const;

export const operatingPrinciples = [
  '首页只保留概览和入口，不堆叠说明性文案。',
  '控制台只聚焦实际操作，不混入介绍页内容。',
  '登录入口统一展示可用方式，流程保持简洁。',
  '关键权限与操作都要可追踪、可复核。',
] as const;

export const authStrategies = [
  {
    title: '用户名密码',
    code: 'username-password',
    identifier: '账号',
    credential: '密码',
    description: '适合固定账号的后台用户。',
  },
  {
    title: '邮箱验证码',
    code: 'email-code',
    identifier: '邮箱',
    credential: '验证码',
    description: '适合需要邮箱确认的场景。',
  },
  {
    title: '手机验证码',
    code: 'phone-code',
    identifier: '手机号',
    credential: '验证码',
    description: '适合移动端或短信触达场景。',
  },
] as const;

export const authJourney = [
  {
    title: '查看可用方式',
    body: '页面会根据当前配置展示可用的登录或注册方式。',
  },
  {
    title: '发送验证码',
    body: '需要验证码时，可直接发送并填写校验。',
  },
  {
    title: '完成身份校验',
    body: '账号或验证码校验通过后即可进入控制台。',
  },
  {
    title: '按权限展示内容',
    body: '登录后仅展示当前角色可用的菜单和操作。',
  },
] as const;
